// Bu controller member tarafindaki salon applications.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { In } from "typeorm";
import { AppDataSource } from "../../data-source";
import { Account } from "../../entities/account.entity";
import { SalonApplication, SalonApplicationSource, SalonApplicationStatus } from "../../entities/salon-application.entity";
import { MembershipPaymentStatus, SalonMembership, SalonMembershipStatus } from "../../entities/salon-membership.entity";
import { Tenant, TenantReviewStatus, TenantSubscriptionStatus } from "../../entities/tenant.entity";
import { User } from "../../entities/user.entity";
import { AppError } from "../../errors/AppError";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { AuditLogService } from "../../services/audit-log.service";
import { TenantLifecycleService } from "../../services/tenant-lifecycle.service";
import { MemberRequestCleanupService } from "../../services/member-request-cleanup.service";

export class MemberSalonApplicationsController {
  static async create(req: AuthenticatedRequest, res: Response) {
    const accountId = req.auth?.accountId;
    const tenantSlug = String(req.body?.tenant_slug ?? "").trim().toLowerCase();
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : undefined;

    if (!accountId) throw new AppError("INVALID_TOKEN", 401, "Oturum doğrulanamadı");
    if (!tenantSlug) throw new AppError("VALIDATION_ERROR", 422, "Salon seçimi zorunludur");
    await MemberRequestCleanupService.cleanupStaleApplicationsForAccount(accountId);

    const [account, tenant, activeMembership, pendingApplication] = await Promise.all([
      AppDataSource.getRepository(Account).findOne({ where: { id: accountId } }),
      AppDataSource.getRepository(Tenant).findOne({ where: { slug: tenantSlug, is_active: true } }),
      AppDataSource.getRepository(SalonMembership).findOne({ where: { account_id: accountId, status: SalonMembershipStatus.ACTIVE, is_active_context: true } }),
      AppDataSource.getRepository(SalonApplication)
        .createQueryBuilder("application")
        .where("application.account_id = :accountId", { accountId })
        .andWhere(
          "(application.status = :pendingStatus OR (application.status = :approvedStatus AND application.payment_status != :verifiedStatus))",
          {
            pendingStatus: SalonApplicationStatus.PENDING,
            approvedStatus: SalonApplicationStatus.APPROVED,
            verifiedStatus: MembershipPaymentStatus.VERIFIED,
          }
        )
        .orderBy("application.created_at", "DESC")
        .getOne(),
    ]);

    if (!account) throw new AppError("INVALID_TOKEN", 401, "Hesap bulunamadı");
    if (!tenant) throw new AppError("SALON_NOT_FOUND", 404, "Salon bulunamadı");
    await TenantLifecycleService.syncTenantState(tenant);
    if (tenant.review_status !== TenantReviewStatus.PUBLISHED || !tenant.is_public) {
      throw new AppError("SALON_NOT_PUBLIC", 409, "Bu salon henüz başvuruya açık değil");
    }
    if (![TenantSubscriptionStatus.TRIAL, TenantSubscriptionStatus.ACTIVE].includes(tenant.subscription_status)) {
      throw new AppError("SALON_NOT_ACCEPTING", 409, "Bu salon şu anda yeni başvuru kabul etmiyor");
    }
    if (activeMembership) {
      throw new AppError("ACTIVE_SALON_EXISTS", 409, "Yeni bir salona başvurmadan önce mevcut salondan ayrılmalısınız");
    }
    if (pendingApplication) {
      throw new AppError("PENDING_APPLICATION_EXISTS", 409, "Zaten bekleyen bir başvurunuz bulunuyor");
    }

    const application = AppDataSource.getRepository(SalonApplication).create({
      account_id: accountId,
      tenant_id: tenant.id,
      status: SalonApplicationStatus.PENDING,
      payment_status: MembershipPaymentStatus.UNPAID,
      note: note || null,
      source: SalonApplicationSource.CATALOG,
    });
    await AppDataSource.getRepository(SalonApplication).save(application);
    await AuditLogService.log({
      tenant_id: tenant.id,
      actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
      actor_account_id: req.auth?.accountId || null,
      actor_role: req.auth?.role || null,
      event_type: "MEMBER_SALON_APPLICATION_CREATED",
      action: "MEMBER_SALON_APPLICATION_CREATED",
      method: req.method,
      path: req.originalUrl,
      status_code: 201,
      success: true,
      request_id: req.requestId || null,
      ip_address: req.ip || null,
      user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
      target_type: "salon_application",
      target_id: application.id,
      metadata: { tenant_slug: tenant.slug, tenant_name: tenant.name },
    });

    return res.status(201).json({
      data: {
        id: application.id,
        status: application.status,
        payment_status: application.payment_status,
        tenant_id: tenant.id,
        tenant_slug: tenant.slug,
        tenant_name: tenant.name,
      },
    });
  }

  static async mine(req: AuthenticatedRequest, res: Response) {
    const accountId = req.auth?.accountId;
    if (!accountId) throw new AppError("INVALID_TOKEN", 401, "Oturum doğrulanamadı");

    const [memberships, applications] = await Promise.all([
      AppDataSource.getRepository(SalonMembership).find({ where: { account_id: accountId }, order: { updated_at: "DESC" } }),
      AppDataSource.getRepository(SalonApplication).find({ where: { account_id: accountId }, order: { created_at: "DESC" } }),
    ]);
    const tenantIds = Array.from(new Set([...memberships.map((row) => row.tenant_id), ...applications.map((row) => row.tenant_id)]));
    const tenants = tenantIds.length
      ? await AppDataSource.getRepository(Tenant).find({ where: { id: In(tenantIds) } })
      : [];

    const tenantMap = new Map(tenants.map((row) => [row.id, row]));
    return res.json({
      data: {
        active_membership: memberships.find((row) => row.status === SalonMembershipStatus.ACTIVE && row.is_active_context)
          ? MemberSalonApplicationsController.serializeMembership(
              memberships.find((row) => row.status === SalonMembershipStatus.ACTIVE && row.is_active_context)!,
              tenantMap
            )
          : null,
        memberships: memberships.map((row) => MemberSalonApplicationsController.serializeMembership(row, tenantMap)),
        applications: applications.map((row) => ({
          id: row.id,
          status: row.status,
          payment_status: row.payment_status,
          payment_reference: row.payment_reference || null,
          payment_confirmed_at: row.payment_confirmed_at || null,
          note: row.note || null,
          tenant_id: row.tenant_id,
          tenant_slug: tenantMap.get(row.tenant_id)?.slug || null,
          tenant_name: tenantMap.get(row.tenant_id)?.name || null,
          created_at: row.created_at,
        })),
      },
    });
  }

  static async leave(req: AuthenticatedRequest, res: Response) {
    const accountId = req.auth?.accountId;
    if (!accountId) throw new AppError("INVALID_TOKEN", 401, "Oturum doğrulanamadı");

    const membershipRepo = AppDataSource.getRepository(SalonMembership);
    const membership = await membershipRepo.findOne({ where: { account_id: accountId, status: SalonMembershipStatus.ACTIVE, is_active_context: true } });
    if (!membership) {
      throw new AppError("NO_ACTIVE_SALON", 404, "Ayrılabileceğiniz aktif bir salon bulunamadı");
    }

    membership.status = SalonMembershipStatus.LEFT;
    membership.is_active_context = false;
    membership.left_at = new Date();
    await membershipRepo.save(membership);
    await AuditLogService.log({
      tenant_id: membership.tenant_id,
      actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
      actor_account_id: req.auth?.accountId || null,
      actor_role: req.auth?.role || null,
      event_type: "MEMBER_SALON_LEFT",
      action: "MEMBER_SALON_LEFT",
      method: req.method,
      path: req.originalUrl,
      status_code: 200,
      success: true,
      request_id: req.requestId || null,
      ip_address: req.ip || null,
      user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
      target_type: "salon_membership",
      target_id: membership.id,
      metadata: { tenant_id: membership.tenant_id, user_id: membership.user_id || null },
    });

    await MemberRequestCleanupService.clearTenantScopedPendingState({
      tenantId: membership.tenant_id,
      accountId,
      identifiers: [membership.user_id, accountId].filter(Boolean) as string[],
      reason: "Uyelik sonlandirildi; acik istekler iptal edildi.",
    });

    if (membership.user_id) {
      const user = await AppDataSource.getRepository(User).findOne({
        where: { id: membership.user_id, tenant_id: membership.tenant_id },
      });
      if (user) {
        user.is_active = false;
        await AppDataSource.getRepository(User).save(user);
      }
    }

    return res.json({ data: true, message: "Salondan ayrıldınız. Yeni bir salona başvurabilirsiniz." });
  }

  private static serializeMembership(membership: SalonMembership, tenantMap: Map<string, Tenant>) {
    return {
      id: membership.id,
      role: membership.role,
      status: membership.status,
      payment_status: membership.payment_status,
      is_active_context: membership.is_active_context,
      tenant_id: membership.tenant_id,
      tenant_slug: tenantMap.get(membership.tenant_id)?.slug || null,
      tenant_name: tenantMap.get(membership.tenant_id)?.name || null,
      joined_at: membership.joined_at || null,
      left_at: membership.left_at || null,
    };
  }
}
