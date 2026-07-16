// Bu controller genel tarafindaki public invites.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import crypto from "crypto";
import { Request, Response } from "express";
import { EntityManager } from "typeorm";
import { AppDataSource } from "../data-source";
import { Invite, InviteStatus } from "../entities/invite.entity";
import { User, UserRole } from "../entities/user.entity";
import { Account } from "../entities/account.entity";
import { MembershipPaymentStatus, SalonMembership, SalonMembershipStatus } from "../entities/salon-membership.entity";
import { NotificationEvent, NotificationEventStatus } from "../entities/notification-event.entity";
import { AppError } from "../errors/AppError";
import { AuditLogService } from "../services/audit-log.service";
import { hashPassword, verifyPassword } from "../services/password.service";
import { MobileNotificationService } from "../services/mobile-notification.service";

const MEMBER_PAYMENT_REQUEST = "MEMBER_PAYMENT_REQUEST";

export class PublicInvitesController {
  private static async safeQueuePush(input: Parameters<typeof MobileNotificationService.queuePush>[0]) {
    try {
      await MobileNotificationService.queuePush(input);
    } catch (error) {
      console.error("Public invite push notification error:", error);
    }
  }

  private static hashToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  private static isEmail(value: string) {
    return value.includes("@");
  }

  private static normalizePhone(raw: unknown) {
    return String(raw ?? "").replace(/\D/g, "");
  }

  private static async generateUniqueQrCode(tenantId: string, role: UserRole, manager?: EntityManager) {
    const repo = manager ? manager.getRepository(User) : AppDataSource.getRepository(User);
    const prefix = role === UserRole.TRAINER ? "TRN" : role === UserRole.MEMBER ? "MEM" : "ADM";
    for (let i = 0; i < 8; i += 1) {
      const code = `${prefix}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      const exists = await repo.findOne({ where: { tenant_id: tenantId, qr_code: code } });
      if (!exists) return code;
    }
    throw new AppError("QR_GENERATION_FAILED", 500, "QR kodu olusturulamadi");
  }

  private static async resolveInviteByToken(token: string) {
    const tokenHash = PublicInvitesController.hashToken(token);
    const invite = await AppDataSource.getRepository(Invite).findOne({ where: { token_hash: tokenHash } });
    if (!invite) {
      throw new AppError("INVITE_NOT_FOUND", 404, "Davet bulunamadi");
    }

    if (invite.status === InviteStatus.CANCELED) {
      throw new AppError("INVITE_CANCELED", 400, "Davet iptal edilmis");
    }
    if (invite.status === InviteStatus.ACCEPTED) {
      throw new AppError("INVITE_ALREADY_ACCEPTED", 409, "Davet zaten kabul edilmis");
    }
    if (invite.expires_at < new Date()) {
      if (invite.status === InviteStatus.PENDING) {
        invite.status = InviteStatus.EXPIRED;
        await AppDataSource.getRepository(Invite).save(invite);
      }
      throw new AppError("INVITE_EXPIRED", 410, "Davet suresi dolmus");
    }

    return invite;
  }

  private static async resolveInviteByTokenForUpdate(token: string, manager: EntityManager) {
    const tokenHash = PublicInvitesController.hashToken(token);
    const invite = await manager.getRepository(Invite).findOne({
      where: { token_hash: tokenHash },
      lock: { mode: "pessimistic_write" },
    });
    if (!invite) {
      throw new AppError("INVITE_NOT_FOUND", 404, "Davet bulunamadi");
    }

    if (invite.status === InviteStatus.CANCELED) {
      throw new AppError("INVITE_CANCELED", 400, "Davet iptal edilmis");
    }
    if (invite.status === InviteStatus.ACCEPTED) {
      throw new AppError("INVITE_ALREADY_ACCEPTED", 409, "Davet zaten kabul edilmis");
    }
    if (invite.expires_at < new Date()) {
      if (invite.status === InviteStatus.PENDING) {
        invite.status = InviteStatus.EXPIRED;
        await manager.getRepository(Invite).save(invite);
      }
      throw new AppError("INVITE_EXPIRED", 410, "Davet suresi dolmus");
    }

    return invite;
  }

  private static async runWriteTransaction<T>(task: (manager: EntityManager) => Promise<T>) {
    if (AppDataSource.isInitialized) {
      return AppDataSource.transaction(task);
    }
    return task({
      getRepository: AppDataSource.getRepository.bind(AppDataSource),
    } as EntityManager);
  }

  // --- GET /api/public/invites/:token/preview ---
  static async preview(req: Request, res: Response) {
    try {
      const token = String(req.params.token ?? "").trim();
      if (!token) {
        throw new AppError("VALIDATION_ERROR", 400, "token zorunlu");
      }

      const invite = await PublicInvitesController.resolveInviteByToken(token);
      const meta = (invite.meta || {}) as Record<string, unknown>;
      return res.json({
        data: {
          id: invite.id,
          role: invite.role,
          identity_hint: invite.email_or_phone,
          expires_at: invite.expires_at,
          status: invite.status,
          kind: typeof meta.kind === "string" ? meta.kind : null,
          tenant_name: typeof meta.tenant_name === "string" ? meta.tenant_name : null,
          package_title: typeof meta.package_title === "string" ? meta.package_title : null,
          amount: typeof meta.amount === "number" ? meta.amount : null,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Public invite preview error:", error);
      throw new AppError("PUBLIC_INVITE_PREVIEW_ERROR", 500, "Davet onizlemesi getirilemedi");
    }
  }

  // --- POST /api/public/invites/accept ---
  static async accept(req: Request, res: Response) {
    try {
      const token = String(req.body?.token ?? "").trim();
      if (!token) {
        throw new AppError("VALIDATION_ERROR", 400, "token zorunlu");
      }

      const firstName = String(req.body?.first_name ?? "").trim();
      const lastName = String(req.body?.last_name ?? "").trim();
      const password = String(req.body?.password ?? "");
      if (!firstName || !lastName || password.length < 6) {
        throw new AppError("VALIDATION_ERROR", 400, "first_name, last_name ve min 6 karakter password zorunlu");
      }

      const outcome = await PublicInvitesController.runWriteTransaction(async (manager) => {
        const invite = AppDataSource.isInitialized
          ? await PublicInvitesController.resolveInviteByTokenForUpdate(token, manager)
          : await PublicInvitesController.resolveInviteByToken(token);
        const isDuoPartnerInvite = String((invite.meta as Record<string, unknown> | undefined)?.kind || "").toUpperCase() === "DUO_PARTNER";

        const invitedIdentity = String(invite.email_or_phone ?? "").trim().toLowerCase();
        let email = "";
        let phone = "";

        if (PublicInvitesController.isEmail(invitedIdentity)) {
          email = invitedIdentity;
          phone = PublicInvitesController.normalizePhone(req.body?.phone);
        } else {
          phone = PublicInvitesController.normalizePhone(invitedIdentity);
          email = String(req.body?.email ?? "").trim().toLowerCase();
          if (!email || !email.includes("@")) {
            throw new AppError("VALIDATION_ERROR", 400, "Email zorunlu ve gecerli olmalidir");
          }
        }

        const userRepo = manager.getRepository(User);
        const existing = await userRepo.findOne({
          where: { tenant_id: invite.tenant_id, email, role: invite.role },
        });
        const accountRepo = manager.getRepository(Account);
        let account = isDuoPartnerInvite ? await accountRepo.findOne({ where: { email } }) : null;
        if (existing && !isDuoPartnerInvite) {
          throw new AppError("EMAIL_ALREADY_EXISTS", 409, "Bu email zaten kullaniliyor");
        }
        if (account) {
          const passwordMatches = await verifyPassword(password, account.password_hash);
          if (!passwordMatches) {
            throw new AppError("INVALID_LOGIN", 401, "Mevcut hesap icin email/sifre hatali");
          }
          phone = phone || PublicInvitesController.normalizePhone(account.phone);
        }
        if (PublicInvitesController.isEmail(invitedIdentity) && (!phone || phone.length < 7 || phone.length > 15)) {
          throw new AppError("VALIDATION_ERROR", 400, "Telefon zorunlu ve gecerli olmalidir");
        }

        const passwordHash = account?.password_hash || (await hashPassword(password));
        let user = existing || null;
        if (!user) {
          user = userRepo.create({
            tenant_id: invite.tenant_id,
            email,
            password_hash: passwordHash,
            first_name: account?.first_name || firstName,
            last_name: account?.last_name || lastName,
            role: invite.role,
            phone,
            is_active: true,
            qr_code: await PublicInvitesController.generateUniqueQrCode(invite.tenant_id, invite.role, manager),
          });
        } else if (isDuoPartnerInvite) {
          user.password_hash = passwordHash;
          user.first_name = user.first_name || account?.first_name || firstName;
          user.last_name = user.last_name || account?.last_name || lastName;
          user.role = UserRole.MEMBER;
          user.phone = user.phone || phone;
          user.is_active = true;
          user.qr_code = user.qr_code || (await PublicInvitesController.generateUniqueQrCode(invite.tenant_id, invite.role, manager));
        }
        await userRepo.save(user);

        const pushQueue: Array<Parameters<typeof MobileNotificationService.queuePush>[0]> = [];

        if (isDuoPartnerInvite) {
          const meta = (invite.meta || {}) as Record<string, any>;
          if (!account) {
            account = accountRepo.create({
              email,
              password_hash: passwordHash,
              first_name: firstName,
              last_name: lastName,
              phone,
              global_role_default: UserRole.MEMBER,
              is_active: true,
            });
            await accountRepo.save(account);
          }

          const membershipRepo = manager.getRepository(SalonMembership);
          let membership = await membershipRepo.findOne({
            where: { account_id: account.id, tenant_id: invite.tenant_id, role: UserRole.MEMBER },
          });
          if (!membership) {
            membership = membershipRepo.create({
              account_id: account.id,
              tenant_id: invite.tenant_id,
              user_id: user.id,
              role: UserRole.MEMBER,
              status: SalonMembershipStatus.ACTIVE,
              payment_status: MembershipPaymentStatus.UNPAID,
              joined_at: new Date(),
              is_active_context: true,
            });
          } else {
            membership.user_id = user.id;
            membership.status = SalonMembershipStatus.ACTIVE;
            membership.payment_status = MembershipPaymentStatus.UNPAID;
            membership.left_at = null;
            membership.joined_at = membership.joined_at || new Date();
            membership.is_active_context = true;
          }
          await membershipRepo.save(membership);

          const selectedPackages = Array.isArray(meta.selected_packages) ? meta.selected_packages : [];
          const partnerAmount = typeof meta.amount === "number" ? meta.amount : Number(meta.amount || 0);
          const partnerSelectedPackages = selectedPackages.map((item: any) => ({
            ...item,
            package_price: partnerAmount || item?.package_price || null,
          }));
          const payload = {
            account_id: account.id,
            member_user_id: user.id,
            active_membership_id: membership.id,
            request_scope: "ACTIVE_MEMBERSHIP",
            request_type: "DUO_PARTNER_PAYMENT",
            tenant_id: invite.tenant_id,
            tenant_slug: meta.tenant_slug || null,
            tenant_name: meta.tenant_name || null,
            package_id: meta.package_id || partnerSelectedPackages[0]?.package_id || null,
            package_ids: Array.isArray(meta.package_ids) ? meta.package_ids : [meta.package_id].filter(Boolean),
            package_title: meta.package_title || partnerSelectedPackages[0]?.package_title || null,
            selected_packages: partnerSelectedPackages,
            amount: partnerAmount,
            total_package_amount: typeof meta.total_package_amount === "number" ? meta.total_package_amount : null,
            trainer_id: meta.trainer_id || null,
            selected_sub_lesson: meta.selected_sub_lesson || null,
            lesson_mode: "DUO",
            duo_primary_payment_event_id: meta.primary_payment_event_id || null,
            duo_partner_payment_event_id: null,
            duo_partner_name: `${firstName} ${lastName}`.trim(),
            duo_partner_contact: invite.email_or_phone,
            duo_payment: {
              status: "PARTNER_PAYMENT_REQUESTED",
              partner_amount: partnerAmount,
              currency: "TRY",
            },
            selected_days: Array.isArray(meta.selected_days) ? meta.selected_days : [],
            note: "Duo partner daveti kabul edildi. Partner ödeme onayı bekleniyor.",
            submitted_at: new Date().toISOString(),
            status: "PENDING",
          };
          const eventRepo = manager.getRepository(NotificationEvent);
          const event = eventRepo.create({
            tenant_id: invite.tenant_id,
            member_id: user.id,
            type: MEMBER_PAYMENT_REQUEST,
            status: NotificationEventStatus.QUEUED,
            payload,
          });
          await eventRepo.save(event);
          event.payload = {
            ...event.payload,
            duo_partner_payment_event_id: event.id,
          };
          await eventRepo.save(event);
          if (meta.primary_member_user_id) {
            pushQueue.push({
              tenantId: invite.tenant_id,
              userId: String(meta.primary_member_user_id),
              roleScope: "MEMBER",
              type: "DUO_PARTNER_ACCEPTED",
              title: "Duo partner daveti kabul etti",
              body: `${meta.package_title || "Duo paket"} için partner daveti kabul edildi. Kalan %50 ödeme salon onayına gönderildi.`,
              deepLink: "/(member)/package",
              meta: {
                invite_id: invite.id,
                partner_payment_event_id: event.id,
                package_id: meta.package_id || null,
              },
            });
          }
          pushQueue.push({
            tenantId: invite.tenant_id,
            userId: user.id,
            roleScope: "MEMBER",
            type: "DUO_PARTNER_PAYMENT_REQUESTED",
            title: "Duo ödeme onaya gönderildi",
            body: `${meta.package_title || "Duo paket"} için %50 payın salon onayına gönderildi.`,
            deepLink: "/(member)/package",
            meta: {
              invite_id: invite.id,
              partner_payment_event_id: event.id,
              package_id: meta.package_id || null,
            },
          });
        }

        invite.status = InviteStatus.ACCEPTED;
        invite.accepted_user_id = user.id;
        invite.accepted_at = new Date();
        await manager.getRepository(Invite).save(invite);

        return { invite, user, pushQueue };
      });

      for (const input of outcome.pushQueue) {
        await PublicInvitesController.safeQueuePush(input);
      }

      await AuditLogService.log({
        tenant_id: outcome.invite.tenant_id,
        actor_role: "PUBLIC",
        event_type: "PUBLIC_INVITE_ACCEPTED",
        action: "PUBLIC_INVITE_ACCEPTED",
        method: req.method,
        path: req.originalUrl,
        status_code: 201,
        success: true,
        ip_address: req.ip || null,
        user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
        target_type: "invite",
        target_id: outcome.invite.id,
        metadata: {
          user_id: outcome.user.id,
          role: outcome.user.role,
          email: outcome.user.email,
        },
      });

      return res.status(201).json({
        data: {
          invite_id: outcome.invite.id,
          user_id: outcome.user.id,
          role: outcome.user.role,
          email: outcome.user.email,
          phone: outcome.user.phone,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Public invite accept error:", error);
      throw new AppError("PUBLIC_INVITE_ACCEPT_ERROR", 500, "Davet kabul edilemedi");
    }
  }
}
