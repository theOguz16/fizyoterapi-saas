// Bu controller admin tarafindaki salon applications.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { In } from "typeorm";
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { Account } from "../../entities/account.entity";
import { SalonApplication, SalonApplicationStatus } from "../../entities/salon-application.entity";
import { MembershipPaymentStatus, SalonMembership, SalonMembershipStatus } from "../../entities/salon-membership.entity";
import { Tenant } from "../../entities/tenant.entity";
import { User, UserRole } from "../../entities/user.entity";
import { AppError } from "../../errors/AppError";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { NotificationEvent, NotificationEventStatus } from "../../entities/notification-event.entity";
import { MobilePurchaseSyncService } from "../../services/mobile-purchase-sync.service";
import { AuditLogService } from "../../services/audit-log.service";
import { MemberRealtimeService } from "../../services/member-realtime.service";

export class AdminSalonApplicationsController {
  private static readonly MEMBER_PAYMENT_REQUEST = "MEMBER_PAYMENT_REQUEST";
  private static readonly UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  private static async markPaymentRequestEvent(params: {
    tenantId: string;
    applicationId: string;
    decision: "APPROVED" | "REJECTED";
    adminId?: string | null;
    membershipId?: string | null;
  }) {
    const { tenantId, applicationId, decision, adminId, membershipId } = params;
    const event = await AppDataSource.getRepository(NotificationEvent)
      .createQueryBuilder("event")
      .where("event.tenant_id = :tenantId", { tenantId })
      .andWhere("event.type = :type", { type: AdminSalonApplicationsController.MEMBER_PAYMENT_REQUEST })
      .andWhere("event.payload ->> 'application_id' = :applicationId", { applicationId })
      .orderBy("event.created_at", "DESC")
      .getOne();

    if (!event) return;
    event.status = NotificationEventStatus.PROCESSED;
    event.processed_at = new Date();
    event.triggered_by_admin_id = adminId || undefined;
    event.payload = {
      ...event.payload,
      decision,
      status: decision,
      membership_id: membershipId || event.payload?.membership_id || null,
    };
    await AppDataSource.getRepository(NotificationEvent).save(event);
  }

  private static async buildApplicationViewModel(params: { application: SalonApplication; account?: Account | null }) {
    const { application, account } = params;
    const purchaseContext = await MobilePurchaseSyncService.resolvePurchaseContext(application);
    const trainer =
      purchaseContext?.trainer_id && AdminSalonApplicationsController.UUID_PATTERN.test(purchaseContext.trainer_id)
        ? await AppDataSource.getRepository(User).findOne({
            where: { tenant_id: application.tenant_id, id: purchaseContext.trainer_id, role: UserRole.TRAINER },
            select: ["id", "first_name", "last_name"],
          })
        : null;
    const trainerDisplayName =
      trainer && `${trainer.first_name || ""} ${trainer.last_name || ""}`.trim()
        ? `${trainer.first_name || ""} ${trainer.last_name || ""}`.trim()
        : purchaseContext?.trainer_name || null;
    const summaryContext = purchaseContext ? { ...purchaseContext, trainer_name: trainerDisplayName } : null;

    return {
      id: application.id,
      status: application.status,
      payment_status: application.payment_status,
      payment_reference: application.payment_reference || null,
      payment_confirmed_at: application.payment_confirmed_at || null,
      note: MobilePurchaseSyncService.summarizePurchaseContext(summaryContext) || application.note || null,
      raw_note: application.note || null,
      created_at: application.created_at,
      applicant: account
        ? {
            id: application.account_id,
            full_name: `${account.first_name} ${account.last_name}`.trim(),
            email: account.email,
            phone: account.phone,
          }
        : null,
      selected_slot_count: purchaseContext?.selected_days?.length || 0,
      package_id: purchaseContext?.package_id || null,
      package_title: purchaseContext?.package_title || null,
      trainer_id: purchaseContext?.trainer_id || null,
      trainer_name: trainerDisplayName,
    };
  }

  static async activateMembershipForApplication(params: {
    tenantId: string;
    approverId: string | null;
    application: SalonApplication;
  }) {
    const { tenantId, approverId, application } = params;
    const membershipRepo = AppDataSource.getRepository(SalonMembership);
    const accountRepo = AppDataSource.getRepository(Account);
    const tenantRepo = AppDataSource.getRepository(Tenant);
    const userRepo = AppDataSource.getRepository(User);

    const [account, tenant] = await Promise.all([
      accountRepo.findOne({ where: { id: application.account_id } }),
      tenantRepo.findOne({ where: { id: tenantId } }),
    ]);
    if (!account || !tenant) throw new AppError("ACCOUNT_OR_TENANT_NOT_FOUND", 404, "Hesap veya salon bulunamadı");

    const existingActive = await membershipRepo.findOne({
      where: { account_id: account.id, status: SalonMembershipStatus.ACTIVE, is_active_context: true },
    });
    if (existingActive) {
      throw new AppError("ACTIVE_SALON_EXISTS", 409, "Kullanıcının zaten aktif bir salonu bulunuyor");
    }

    let linkedUser = await userRepo.findOne({
      where: { tenant_id: tenantId, email: account.email, role: UserRole.MEMBER },
    });
    if (!linkedUser) {
      linkedUser = userRepo.create({
        tenant_id: tenantId,
        email: account.email,
        password_hash: account.password_hash,
        first_name: account.first_name,
        last_name: account.last_name,
        role: UserRole.MEMBER,
        phone: account.phone,
        is_active: true,
      });
    } else {
      linkedUser.password_hash = account.password_hash;
      linkedUser.first_name = account.first_name;
      linkedUser.last_name = account.last_name;
      linkedUser.phone = account.phone;
      linkedUser.role = UserRole.MEMBER;
      linkedUser.is_active = true;
    }
    linkedUser = await userRepo.save(linkedUser);

    await membershipRepo
      .createQueryBuilder()
      .update(SalonMembership)
      .set({ is_active_context: false })
      .where("account_id = :accountId", { accountId: account.id })
      .execute();

    let membership = await membershipRepo.findOne({
      where: { account_id: account.id, tenant_id: tenantId, role: UserRole.MEMBER },
    });
    if (!membership) {
      membership = membershipRepo.create({
        account_id: account.id,
        tenant_id: tenantId,
        user_id: linkedUser.id,
        role: UserRole.MEMBER,
        status: SalonMembershipStatus.ACTIVE,
        payment_status: MembershipPaymentStatus.VERIFIED,
        approved_by: approverId,
        approved_at: new Date(),
        is_active_context: true,
        joined_at: new Date(),
      });
    } else {
      membership.user_id = linkedUser.id;
      membership.status = SalonMembershipStatus.ACTIVE;
      membership.payment_status = MembershipPaymentStatus.VERIFIED;
      membership.approved_by = approverId;
      membership.approved_at = new Date();
      membership.is_active_context = true;
      membership.left_at = null;
      membership.joined_at = membership.joined_at || new Date();
    }

    membership = await membershipRepo.save(membership);
    await MobilePurchaseSyncService.applyApprovedPurchase({
      tenantId,
      memberUser: linkedUser,
      application,
    });
    return { membership, linkedUser, tenant };
  }

  static async list(req: AuthenticatedRequest, res: Response) {
    const tenantId = req.tenantId;
    if (!tenantId) throw new AppError("NO_TENANT", 400, "Klinik bilgisi bulunamadı");

    const applications = await AppDataSource.getRepository(SalonApplication).find({
      where: { tenant_id: tenantId },
      order: { created_at: "DESC" },
    });
    const accountIds = Array.from(new Set(applications.map((row) => row.account_id)));
    const accounts = accountIds.length ? await AppDataSource.getRepository(Account).find({ where: { id: In(accountIds) } as any }) : [];
    const accountMap = new Map(accounts.map((row) => [row.id, row]));

    return res.json({
      data: await Promise.all(
        applications.map((row) =>
          AdminSalonApplicationsController.buildApplicationViewModel({
            application: row,
            account: accountMap.get(row.account_id) || null,
          })
        )
      ),
    });
  }

  static async verifyPayment(req: AuthenticatedRequest, res: Response) {
    const tenantId = req.tenantId;
    const approverId = req.auth?.linkedUserId || req.auth?.sub || null;
    const id = String(req.params.id || "");
    if (!tenantId) throw new AppError("NO_TENANT", 400, "Klinik bilgisi bulunamadı");

    const repo = AppDataSource.getRepository(SalonApplication);
    const application = await repo.findOne({ where: { id, tenant_id: tenantId } });
    if (!application) throw new AppError("APPLICATION_NOT_FOUND", 404, "Başvuru bulunamadı");
    if (
      application.status === SalonApplicationStatus.APPROVED &&
      application.payment_status === MembershipPaymentStatus.VERIFIED
    ) {
      const membership = await AppDataSource.getRepository(SalonMembership).findOne({
        where: { tenant_id: tenantId, account_id: application.account_id, role: UserRole.MEMBER },
        order: { updated_at: "DESC" },
      });
      return res.json({
        data: {
          application_id: application.id,
          membership_id: membership?.id || null,
          user_id: membership?.user_id || null,
          payment_status: application.payment_status,
          idempotent: true,
        },
      });
    }
    if (application.status !== SalonApplicationStatus.APPROVED) {
      throw new AppError("APPLICATION_NOT_READY_FOR_PAYMENT", 409, "Başvuru önce ödeme akışına alınmalıdır");
    }

    const { membership, linkedUser, tenant } = await AdminSalonApplicationsController.activateMembershipForApplication({
      tenantId,
      approverId,
      application,
    });
    application.payment_status = MembershipPaymentStatus.VERIFIED;
    application.payment_confirmed_at = new Date();
    application.payment_reference = application.payment_reference || `manual-${Date.now()}`;
    await repo.save(application);
    await AdminSalonApplicationsController.markPaymentRequestEvent({
      tenantId,
      applicationId: application.id,
      decision: "APPROVED",
      adminId: approverId,
      membershipId: membership.id,
    });
    await AuditLogService.log({
      tenant_id: tenantId,
      actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
      actor_account_id: req.auth?.accountId || null,
      actor_role: req.auth?.role || null,
      event_type: "ADMIN_SALON_APPLICATION_PAYMENT_VERIFIED",
      action: "ADMIN_SALON_APPLICATION_PAYMENT_VERIFIED",
      method: req.method,
      path: req.originalUrl,
      status_code: 200,
      success: true,
      request_id: req.requestId || null,
      ip_address: req.ip || null,
      user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
      target_type: "salon_application",
      target_id: application.id,
      metadata: { membership_id: membership.id, user_id: linkedUser.id, payment_status: application.payment_status },
    });
    return res.json({
      data: {
        application_id: application.id,
        membership_id: membership.id,
        user_id: linkedUser.id,
        tenant_slug: tenant.slug,
        payment_status: application.payment_status,
      },
    });
  }

  static async approve(req: AuthenticatedRequest, res: Response) {
    const tenantId = req.tenantId;
    const approverId = req.auth?.linkedUserId || req.auth?.sub || null;
    const id = String(req.params.id || "");
    if (!tenantId) throw new AppError("NO_TENANT", 400, "Klinik bilgisi bulunamadı");

    const appRepo = AppDataSource.getRepository(SalonApplication);
    const accountRepo = AppDataSource.getRepository(Account);
    const tenantRepo = AppDataSource.getRepository(Tenant);

    const application = await appRepo.findOne({ where: { id, tenant_id: tenantId } });
    if (!application) throw new AppError("APPLICATION_NOT_FOUND", 404, "Başvuru bulunamadı");
    if (
      application.status === SalonApplicationStatus.APPROVED &&
      application.payment_status === MembershipPaymentStatus.VERIFIED
    ) {
      const membership = await AppDataSource.getRepository(SalonMembership).findOne({
        where: { tenant_id: tenantId, account_id: application.account_id, role: UserRole.MEMBER },
        order: { updated_at: "DESC" },
      });
      return res.json({
        data: {
          application_id: application.id,
          membership_id: membership?.id || null,
          user_id: membership?.user_id || null,
          status: application.status,
          payment_status: application.payment_status,
          idempotent: true,
        },
      });
    }
    const [account, tenant] = await Promise.all([
      accountRepo.findOne({ where: { id: application.account_id } }),
      tenantRepo.findOne({ where: { id: tenantId } }),
    ]);
    if (!account || !tenant) throw new AppError("ACCOUNT_OR_TENANT_NOT_FOUND", 404, "Hesap veya salon bulunamadı");

    const existingActive = await AppDataSource.getRepository(SalonMembership).findOne({
      where: { account_id: account.id, status: SalonMembershipStatus.ACTIVE, is_active_context: true },
    });
    if (existingActive) {
      throw new AppError("ACTIVE_SALON_EXISTS", 409, "Kullanıcının zaten aktif bir salonu bulunuyor");
    }
    const purchaseContext = await MobilePurchaseSyncService.resolvePurchaseContext(application);
    const { membership, linkedUser, tenant: activatedTenant } =
      await AdminSalonApplicationsController.activateMembershipForApplication({
        tenantId,
        approverId,
        application,
      });

    application.status = SalonApplicationStatus.APPROVED;
    application.payment_status = MembershipPaymentStatus.VERIFIED;
    application.payment_confirmed_at = new Date();
    application.payment_reference = application.payment_reference || `admin-approval-${Date.now()}`;
    const purchaseSummary = MobilePurchaseSyncService.summarizePurchaseContext(purchaseContext);
    application.note = purchaseSummary || application.note || "Başvuru yönetici onayı ile üyeliğe dönüştürüldü.";
    await appRepo.save(application);
    await AdminSalonApplicationsController.markPaymentRequestEvent({
      tenantId,
      applicationId: application.id,
      decision: "APPROVED",
      adminId: approverId,
      membershipId: membership.id,
    });
    await AuditLogService.log({
      tenant_id: tenantId,
      actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
      actor_account_id: req.auth?.accountId || null,
      actor_role: req.auth?.role || null,
      event_type: "ADMIN_SALON_APPLICATION_APPROVED",
      action: "ADMIN_SALON_APPLICATION_APPROVED",
      method: req.method,
      path: req.originalUrl,
      status_code: 200,
      success: true,
      request_id: req.requestId || null,
      ip_address: req.ip || null,
      user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
      target_type: "salon_application",
      target_id: application.id,
      metadata: {
        status: application.status,
        payment_status: application.payment_status,
        membership_id: membership.id,
        user_id: linkedUser.id,
      },
    });
    const realtimePayload = {
      type: "calendar_sync",
      entity: "calendar",
      application_id: application.id,
      membership_id: membership.id,
    };
    MemberRealtimeService.publish(linkedUser.id, realtimePayload);
    MemberRealtimeService.publish(application.account_id, realtimePayload);

    return res.json({
      data: {
        application_id: application.id,
        payment_status: application.payment_status,
        status: application.status,
        membership_id: membership.id,
        user_id: linkedUser.id,
        tenant_slug: activatedTenant.slug,
      },
    });
  }

  static async reject(req: AuthenticatedRequest, res: Response) {
    const tenantId = req.tenantId;
    const id = String(req.params.id || "");
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : undefined;
    if (!tenantId) throw new AppError("NO_TENANT", 400, "Klinik bilgisi bulunamadı");

    const repo = AppDataSource.getRepository(SalonApplication);
    const application = await repo.findOne({ where: { id, tenant_id: tenantId } });
    if (!application) throw new AppError("APPLICATION_NOT_FOUND", 404, "Başvuru bulunamadı");

    application.status = SalonApplicationStatus.REJECTED;
    application.note = note || application.note || null;
    await repo.save(application);
    await AdminSalonApplicationsController.markPaymentRequestEvent({
      tenantId,
      applicationId: application.id,
      decision: "REJECTED",
      adminId: req.auth?.linkedUserId || req.auth?.sub || null,
    });
    await AuditLogService.log({
      tenant_id: tenantId,
      actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
      actor_account_id: req.auth?.accountId || null,
      actor_role: req.auth?.role || null,
      event_type: "ADMIN_SALON_APPLICATION_REJECTED",
      action: "ADMIN_SALON_APPLICATION_REJECTED",
      method: req.method,
      path: req.originalUrl,
      status_code: 200,
      success: true,
      request_id: req.requestId || null,
      ip_address: req.ip || null,
      user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
      target_type: "salon_application",
      target_id: application.id,
      metadata: { status: application.status, note: application.note || null },
    });
    return res.json({ data: application });
  }
}
