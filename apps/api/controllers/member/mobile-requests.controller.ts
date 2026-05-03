// Bu controller member tarafindaki mobile requests.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import { Tenant, TenantReviewStatus, TenantSubscriptionStatus } from "../../entities/tenant.entity";
import { Account } from "../../entities/account.entity";
import { User } from "../../entities/user.entity";
import { NotificationEvent, NotificationEventStatus } from "../../entities/notification-event.entity";
import { SalonApplication, SalonApplicationSource, SalonApplicationStatus } from "../../entities/salon-application.entity";
import { MembershipPaymentStatus, SalonMembership, SalonMembershipStatus } from "../../entities/salon-membership.entity";
import { Package } from "../../entities/package.entity";
import { TenantLifecycleService } from "../../services/tenant-lifecycle.service";
import { MemberRequestCleanupService } from "../../services/member-request-cleanup.service";
import { AuditLogService } from "../../services/audit-log.service";

const MEMBER_PAYMENT_REQUEST = "MEMBER_PAYMENT_REQUEST";
const MEMBER_CHANGE_REQUEST = "MEMBER_CHANGE_REQUEST";

function eventMemberId(req: AuthenticatedRequest) {
  return req.auth?.linkedUserId || req.auth?.accountId || req.auth?.sub || "";
}

export class MemberMobileRequestsController {
  static async createPaymentRequest(req: AuthenticatedRequest, res: Response) {
    const accountId = req.auth?.accountId;
    const eventOwnerId = eventMemberId(req);
    const tenantSlug = String(req.body?.tenant_slug ?? "").trim().toLowerCase();
    const packageId = String(req.body?.package_id ?? "").trim();
    const packageIds = Array.isArray(req.body?.package_ids)
      ? req.body.package_ids.map((item: unknown) => String(item ?? "").trim()).filter(Boolean)
      : [];
    const normalizedPackageIds = Array.from(new Set([packageId, ...packageIds].filter(Boolean)));
    const trainerId = String(req.body?.trainer_id ?? "").trim();
    const selectedSubLesson = typeof req.body?.selected_sub_lesson === "string" ? req.body.selected_sub_lesson.trim() : null;
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : null;
    const selectedDays = Array.isArray(req.body?.selected_days) ? req.body.selected_days : [];
    const availabilityContext =
      req.body?.availability_context && typeof req.body.availability_context === "object" && !Array.isArray(req.body.availability_context)
        ? {
            source: typeof req.body.availability_context.source === "string" ? req.body.availability_context.source : "MEMBER_AVAILABILITY",
            visibility: typeof req.body.availability_context.visibility === "string" ? req.body.availability_context.visibility : "TRAINER_HIDDEN",
            selected_by: typeof req.body.availability_context.selected_by === "string" ? req.body.availability_context.selected_by : "MEMBER",
          }
        : {
            source: "MEMBER_AVAILABILITY",
            visibility: "TRAINER_HIDDEN",
            selected_by: "MEMBER",
          };

    if (!accountId || !eventOwnerId) throw new AppError("INVALID_TOKEN", 401, "Oturum doğrulanamadı");
    if (!tenantSlug || normalizedPackageIds.length === 0 || selectedDays.length === 0) {
      throw new AppError("VALIDATION_ERROR", 422, "Salon, gün ve en az bir paket seçimi zorunludur");
    }
    await MemberRequestCleanupService.cleanupStaleApplicationsForAccount(accountId);

    const [account, tenant, activeMembership] = await Promise.all([
      AppDataSource.getRepository(Account).findOne({ where: { id: accountId } }),
      AppDataSource.getRepository(Tenant).findOne({ where: { slug: tenantSlug, is_active: true } }),
      AppDataSource.getRepository(SalonMembership).findOne({
        where: { account_id: accountId, status: SalonMembershipStatus.ACTIVE, is_active_context: true },
      }),
    ]);

    if (!account) throw new AppError("ACCOUNT_NOT_FOUND", 404, "Hesap bulunamadı");
    if (!tenant) throw new AppError("SALON_NOT_FOUND", 404, "Salon bulunamadı");
    await TenantLifecycleService.syncTenantState(tenant);
    if (activeMembership && activeMembership.tenant_id !== tenant.id) {
      throw new AppError("ACTIVE_SALON_EXISTS", 409, "Farklı bir salondayken yeni başvuru oluşturamazsınız");
    }
    const existingRequest = await MemberRequestCleanupService.findActionablePaymentRequest({
      identifiers: [eventOwnerId, accountId].filter(Boolean) as string[],
      tenantId: tenant.id,
      packageIds: normalizedPackageIds,
    });
    if (existingRequest) throw new AppError("PAYMENT_REQUEST_EXISTS", 409, "Bu paket için bekleyen bir ödeme talebiniz zaten var");
    if (tenant.review_status !== TenantReviewStatus.PUBLISHED || !tenant.is_public) {
      throw new AppError("SALON_NOT_PUBLIC", 409, "Bu salon henüz başvuruya açık değil");
    }
    if (![TenantSubscriptionStatus.TRIAL, TenantSubscriptionStatus.ACTIVE].includes(tenant.subscription_status)) {
      throw new AppError("SALON_NOT_ACCEPTING", 409, "Bu salon şu anda yeni başvuru kabul etmiyor");
    }

    const packageRows = await AppDataSource.getRepository(Package).find({
      where: normalizedPackageIds.map((id) => ({ tenant_id: tenant.id, id, is_active: true })),
    });
    if (packageRows.length !== normalizedPackageIds.length) {
      throw new AppError("PACKAGE_NOT_FOUND", 404, "Seçilen paketlerden biri bulunamadı");
    }
    const packageMap = new Map(packageRows.map((row) => [row.id, row]));
    const selectedPackages = normalizedPackageIds.map((id) => {
      const row = packageMap.get(id)!;
      return {
        package_id: row.id,
        package_title: row.title,
        package_price: row.display_price ? Number(row.display_price) : null,
      };
    });
    const totalAmount = selectedPackages.reduce((sum, item) => sum + Number(item.package_price || 0), 0);

    let application = null as SalonApplication | null;
    if (!activeMembership) {
      application = await AppDataSource.getRepository(SalonApplication)
        .createQueryBuilder("application")
        .where("application.account_id = :accountId", { accountId })
        .andWhere("application.tenant_id = :tenantId", { tenantId: tenant.id })
        .andWhere("application.status IN (:...statuses)", {
          statuses: [SalonApplicationStatus.PENDING, SalonApplicationStatus.APPROVED],
        })
        .orderBy("application.created_at", "DESC")
        .getOne();
    }

    const payload = {
      account_id: accountId,
      member_user_id: activeMembership?.user_id || null,
      active_membership_id: activeMembership?.id || null,
      request_scope: activeMembership ? "ACTIVE_MEMBERSHIP" : "NEW_APPLICATION",
      tenant_id: tenant.id,
      tenant_slug: tenant.slug,
      tenant_name: tenant.name,
      package_id: normalizedPackageIds[0],
      package_ids: normalizedPackageIds,
      package_title: selectedPackages[0]?.package_title || null,
      selected_packages: selectedPackages,
      amount: totalAmount,
      trainer_id: trainerId || null,
      selected_sub_lesson: selectedSubLesson,
      selected_days: selectedDays,
      note,
      availability_context: availabilityContext,
      submitted_at: new Date().toISOString(),
      status: "PENDING",
    };

    if (!activeMembership) {
      if (!application) {
        application = AppDataSource.getRepository(SalonApplication).create({
          account_id: accountId,
          tenant_id: tenant.id,
          status: SalonApplicationStatus.PENDING,
          payment_status: MembershipPaymentStatus.UNPAID,
          note: JSON.stringify(payload),
          source: SalonApplicationSource.CATALOG,
        });
      } else {
        application.payment_status = MembershipPaymentStatus.UNPAID;
      }
      await AppDataSource.getRepository(SalonApplication).save(application);
    }

    const event = AppDataSource.getRepository(NotificationEvent).create({
      tenant_id: tenant.id,
      member_id: eventOwnerId,
      type: MEMBER_PAYMENT_REQUEST,
      status: NotificationEventStatus.QUEUED,
      payload: {
        ...payload,
        application_id: application?.id || null,
      },
    });
    await AppDataSource.getRepository(NotificationEvent).save(event);
    await AuditLogService.log({
      tenant_id: tenant.id,
      actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
      actor_account_id: req.auth?.accountId || null,
      actor_role: req.auth?.role || null,
      event_type: "MEMBER_PAYMENT_REQUEST_CREATED",
      action: "MEMBER_PAYMENT_REQUEST_CREATED",
      method: req.method,
      path: req.originalUrl,
      status_code: 201,
      success: true,
      request_id: req.requestId || null,
      ip_address: req.ip || null,
      user_agent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
        target_type: "notification_event",
        target_id: event.id,
        metadata: {
        application_id: application?.id || null,
        package_id: packageId,
        package_ids: normalizedPackageIds,
        trainer_id: trainerId,
        tenant_slug: tenant.slug,
      },
    });

    return res.status(201).json({
      data: {
        id: event.id,
        status: "PENDING",
        amount: payload.amount,
        currency: "TRY",
        package_id: normalizedPackageIds[0],
        trainer_id: trainerId || null,
        note,
      },
    });
  }

  static async listPaymentRequests(req: AuthenticatedRequest, res: Response) {
    const ownerId = eventMemberId(req);
    if (!ownerId) throw new AppError("INVALID_TOKEN", 401, "Oturum doğrulanamadı");

    const rows = await AppDataSource.getRepository(NotificationEvent).find({
      where: { member_id: ownerId, type: MEMBER_PAYMENT_REQUEST } as any,
      order: { created_at: "DESC" },
    });

    return res.json({
      data: rows.map((row) => ({
        id: row.id,
        status: String((row.payload?.decision as string) || (row.payload?.status as string) || (row.status === NotificationEventStatus.QUEUED ? "PENDING" : "PROCESSED")),
        amount: typeof row.payload?.amount === "number" ? row.payload.amount : null,
        currency: "TRY",
        package_id: typeof row.payload?.package_id === "string" ? row.payload.package_id : null,
        trainer_id: typeof row.payload?.trainer_id === "string" ? row.payload.trainer_id : null,
        note: typeof row.payload?.note === "string" ? row.payload.note : null,
      })),
    });
  }

  static async createChangeRequest(req: AuthenticatedRequest, res: Response) {
    const tenantId = req.tenantId;
    const memberId = req.auth?.sub;
    const accountId = req.auth?.accountId || null;
    const type = String(req.body?.type ?? "").trim().toUpperCase();
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : null;
    const packageId = typeof req.body?.package_id === "string" ? req.body.package_id.trim() : null;
    const trainerId = typeof req.body?.trainer_id === "string" ? req.body.trainer_id.trim() : null;

    if (!tenantId || !memberId) throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadı");
    if (!["PACKAGE_RENEWAL", "PACKAGE_CANCEL", "TRAINER_CHANGE"].includes(type)) {
      throw new AppError("VALIDATION_ERROR", 422, "Geçersiz talep tipi");
    }

    const duplicate = await AppDataSource.getRepository(NotificationEvent).findOne({
      where: { tenant_id: tenantId, member_id: memberId, type: MEMBER_CHANGE_REQUEST, status: NotificationEventStatus.QUEUED } as any,
      order: { created_at: "DESC" },
    });
    if (duplicate && String(duplicate.payload?.request_type || "") === type) {
      throw new AppError("CHANGE_REQUEST_EXISTS", 409, "Aynı tipte bekleyen talebiniz zaten var");
    }

    const event = AppDataSource.getRepository(NotificationEvent).create({
      tenant_id: tenantId,
      member_id: memberId,
      type: MEMBER_CHANGE_REQUEST,
      status: NotificationEventStatus.QUEUED,
      payload: {
        account_id: accountId,
        request_type: type,
        package_id: packageId,
        trainer_id: trainerId,
        note,
        status: "PENDING",
        submitted_at: new Date().toISOString(),
      },
    });
    await AppDataSource.getRepository(NotificationEvent).save(event);
    await AuditLogService.log({
      tenant_id: tenantId,
      actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
      actor_account_id: req.auth?.accountId || null,
      actor_role: req.auth?.role || null,
      event_type: "MEMBER_CHANGE_REQUEST_CREATED",
      action: "MEMBER_CHANGE_REQUEST_CREATED",
      method: req.method,
      path: req.originalUrl,
      status_code: 201,
      success: true,
      request_id: req.requestId || null,
      ip_address: req.ip || null,
      user_agent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
      target_type: "notification_event",
      target_id: event.id,
      metadata: {
        request_type: type,
        package_id: packageId,
        trainer_id: trainerId,
      },
    });

    return res.status(201).json({
      data: {
        id: event.id,
        type,
        status: "PENDING",
        reason: note,
        created_at: event.created_at,
      },
    });
  }

  static async listChangeRequests(req: AuthenticatedRequest, res: Response) {
    const tenantId = req.tenantId;
    const memberId = req.auth?.sub;
    if (!tenantId || !memberId) throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadı");

    const rows = await AppDataSource.getRepository(NotificationEvent).find({
      where: { tenant_id: tenantId, member_id: memberId, type: MEMBER_CHANGE_REQUEST } as any,
      order: { created_at: "DESC" },
    });

    return res.json({
      data: rows.map((row) => ({
        id: row.id,
        type: String(row.payload?.request_type || "PACKAGE_RENEWAL"),
        status: String((row.payload?.decision as string) || (row.payload?.status as string) || (row.status === NotificationEventStatus.QUEUED ? "PENDING" : "PROCESSED")),
        created_at: row.created_at,
        reason: typeof row.payload?.note === "string" ? row.payload.note : null,
      })),
    });
  }
}
