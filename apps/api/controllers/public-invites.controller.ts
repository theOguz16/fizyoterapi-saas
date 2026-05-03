// Bu controller genel tarafindaki public invites.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import crypto from "crypto";
import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Invite, InviteStatus } from "../entities/invite.entity";
import { User, UserRole } from "../entities/user.entity";
import { AppError } from "../errors/AppError";
import { AuditLogService } from "../services/audit-log.service";
import { hashPassword } from "../services/password.service";

export class PublicInvitesController {
  private static hashToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  private static isEmail(value: string) {
    return value.includes("@");
  }

  private static normalizePhone(raw: unknown) {
    return String(raw ?? "").replace(/\D/g, "");
  }

  private static async generateUniqueQrCode(tenantId: string, role: UserRole) {
    const repo = AppDataSource.getRepository(User);
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

  // --- GET /api/public/invites/:token/preview ---
  static async preview(req: Request, res: Response) {
    try {
      const token = String(req.params.token ?? "").trim();
      if (!token) {
        throw new AppError("VALIDATION_ERROR", 400, "token zorunlu");
      }

      const invite = await PublicInvitesController.resolveInviteByToken(token);
      return res.json({
        data: {
          id: invite.id,
          role: invite.role,
          identity_hint: invite.email_or_phone,
          expires_at: invite.expires_at,
          status: invite.status,
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

      const invite = await PublicInvitesController.resolveInviteByToken(token);

      const invitedIdentity = String(invite.email_or_phone ?? "").trim().toLowerCase();
      let email = "";
      let phone = "";

      if (PublicInvitesController.isEmail(invitedIdentity)) {
        email = invitedIdentity;
        phone = PublicInvitesController.normalizePhone(req.body?.phone);
        if (!phone || phone.length < 7 || phone.length > 15) {
          throw new AppError("VALIDATION_ERROR", 400, "Telefon zorunlu ve gecerli olmalidir");
        }
      } else {
        phone = PublicInvitesController.normalizePhone(invitedIdentity);
        email = String(req.body?.email ?? "").trim().toLowerCase();
        if (!email || !email.includes("@")) {
          throw new AppError("VALIDATION_ERROR", 400, "Email zorunlu ve gecerli olmalidir");
        }
      }

      const userRepo = AppDataSource.getRepository(User);
      const existing = await userRepo.findOne({ where: { email } });
      if (existing) {
        throw new AppError("EMAIL_ALREADY_EXISTS", 409, "Bu email zaten kullaniliyor");
      }

      const passwordHash = await hashPassword(password);
      const user = userRepo.create({
        tenant_id: invite.tenant_id,
        email,
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
        role: invite.role,
        phone,
        is_active: true,
        qr_code: await PublicInvitesController.generateUniqueQrCode(invite.tenant_id, invite.role),
      });
      await userRepo.save(user);

      invite.status = InviteStatus.ACCEPTED;
      invite.accepted_user_id = user.id;
      invite.accepted_at = new Date();
      await AppDataSource.getRepository(Invite).save(invite);
      await AuditLogService.log({
        tenant_id: invite.tenant_id,
        actor_role: "PUBLIC",
        event_type: "PUBLIC_INVITE_ACCEPTED",
        action: "PUBLIC_INVITE_ACCEPTED",
        method: req.method,
        path: req.originalUrl,
        status_code: 201,
        success: true,
        ip_address: req.ip || null,
        user_agent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
        target_type: "invite",
        target_id: invite.id,
        metadata: {
          user_id: user.id,
          role: user.role,
          email: user.email,
        },
      });

      return res.status(201).json({
        data: {
          invite_id: invite.id,
          user_id: user.id,
          role: user.role,
          email: user.email,
          phone: user.phone,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Public invite accept error:", error);
      throw new AppError("PUBLIC_INVITE_ACCEPT_ERROR", 500, "Davet kabul edilemedi");
    }
  }
}
