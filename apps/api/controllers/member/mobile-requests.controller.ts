// Bu controller member tarafindaki mobile requests.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../errors/AppError";
import { Tenant, TenantReviewStatus, TenantSubscriptionStatus } from "../../entities/tenant.entity";
import { Account } from "../../entities/account.entity";
import { NotificationEvent, NotificationEventStatus } from "../../entities/notification-event.entity";
import { SalonApplication, SalonApplicationSource, SalonApplicationStatus } from "../../entities/salon-application.entity";
import { MembershipPaymentStatus, SalonMembership, SalonMembershipStatus } from "../../entities/salon-membership.entity";
import { Package } from "../../entities/package.entity";
import { User, UserRole } from "../../entities/user.entity";
import { TenantLifecycleService } from "../../services/tenant-lifecycle.service";
import { MemberRequestCleanupService } from "../../services/member-request-cleanup.service";
import { AuditLogService } from "../../services/audit-log.service";
import { MobileNotificationService } from "../../services/mobile-notification.service";
import { Booking, BookingStatus } from "../../entities/booking.entity";

const MEMBER_PAYMENT_REQUEST = "MEMBER_PAYMENT_REQUEST";
const MEMBER_CHANGE_REQUEST = "MEMBER_CHANGE_REQUEST";

function eventMemberId(req: AuthenticatedRequest) {
  return req.auth?.linkedUserId || req.auth?.accountId || req.auth?.sub || "";
}

function resolvePackageLessonMode(pkg: Package) {
  const rules = pkg.rules && typeof pkg.rules === "object" ? (pkg.rules as Record<string, unknown>) : {};
  return String(rules.lesson_mode ?? (pkg.capacity > 2 ? "GROUP" : pkg.capacity === 2 ? "DUO" : "PRIVATE")).toUpperCase();
}

function splitDuoAmount(amount: number) {
  const half = Number.isFinite(amount) ? Math.round((amount / 2) * 100) / 100 : 0;
  return { primary: half, partner: half };
}

function readEventPayload(event: NotificationEvent | null | undefined): Record<string, any> {
  try {
    const payload = event?.payload;
    if (!payload) return {};
    return typeof payload === "string" ? JSON.parse(payload) : payload;
  } catch {
    return {};
  }
}

export class MemberMobileRequestsController {
  static async listScheduleChangeRequests(req: AuthenticatedRequest, res: Response) {
    const tenantId = req.tenantId;
    const memberId = req.auth?.sub;
    if (!tenantId || !memberId) throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
    const rows = await AppDataSource.getRepository(NotificationEvent).find({
      where: { tenant_id: tenantId, member_id: memberId, type: "TRAINER_SCHEDULE_CHANGE_REQUEST" } as any,
      order: { created_at: "DESC" },
    });
    return res.json({ data: rows.map((row) => ({ id: row.id, created_at: row.created_at, ...readEventPayload(row) })) });
  }

  static async resolveScheduleChangeRequest(req: AuthenticatedRequest, res: Response) {
    const tenantId = req.tenantId;
    const memberId = req.auth?.sub;
    const requestId = String(req.params.id || "");
    const decision = String(req.body?.decision || "").toUpperCase();
    if (!tenantId || !memberId) throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadi");
    if (decision !== "APPROVE" && decision !== "REJECT") throw new AppError("VALIDATION_ERROR", 400, "Karar APPROVE veya REJECT olmalidir");
    const eventRepo = AppDataSource.getRepository(NotificationEvent);
    const event = await eventRepo.findOne({ where: { tenant_id: tenantId, member_id: memberId, id: requestId, type: "TRAINER_SCHEDULE_CHANGE_REQUEST" } as any });
    if (!event) throw new AppError("REQUEST_NOT_FOUND", 404, "Ders degisikligi talebi bulunamadi");
    const payload = readEventPayload(event);
    if (String(payload.status || "PENDING") !== "PENDING") throw new AppError("REQUEST_RESOLVED", 409, "Bu talep daha once sonuclandirildi");
    if (decision === "APPROVE") {
      const booking = await AppDataSource.getRepository(Booking).findOne({ where: { tenant_id: tenantId, id: String(payload.booking_id), member_id: memberId } });
      if (!booking) throw new AppError("BOOKING_NOT_FOUND", 404, "Ders bulunamadi");
      booking.starts_at = new Date(String(payload.proposed_starts_at));
      booking.ends_at = new Date(String(payload.proposed_ends_at));
      booking.status = BookingStatus.RESCHEDULED;
      await AppDataSource.getRepository(Booking).save(booking);
    }
    event.payload = { ...payload, status: decision === "APPROVE" ? "APPROVED" : "REJECTED", resolved_at: new Date().toISOString() };
    event.status = NotificationEventStatus.PROCESSED;
    event.processed_at = new Date();
    await eventRepo.save(event);
    return res.json({ data: { id: event.id, ...event.payload } });
  }
  private static async safeQueuePush(input: Parameters<typeof MobileNotificationService.queuePush>[0]) {
    try {
      await MobileNotificationService.queuePush(input);
    } catch (error) {
      console.error("Member request push notification error:", error);
    }
  }

  private static async notifyTenantAdmins(input: {
    tenantId: string;
    type: string;
    title: string;
    body: string;
    deepLink: string;
    meta?: Record<string, unknown>;
  }) {
    try {
      const admins = await AppDataSource.getRepository(User).find({
        where: { tenant_id: input.tenantId, role: UserRole.ADMIN, is_active: true } as any,
        select: ["id"],
      });
      await Promise.all(
        admins.map((admin) =>
          MemberMobileRequestsController.safeQueuePush({
            tenantId: input.tenantId,
            userId: admin.id,
            roleScope: "ADMIN",
            type: input.type,
            title: input.title,
            body: input.body,
            deepLink: input.deepLink,
            meta: input.meta,
          })
        )
      );
    } catch (error) {
      console.error("Admin request push notification error:", error);
    }
  }

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
    const duoPartnerName = typeof req.body?.duo_partner_name === "string" ? req.body.duo_partner_name.trim() : "";
    const duoPartnerContact = typeof req.body?.duo_partner_contact === "string" ? req.body.duo_partner_contact.trim() : "";
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
    const hasDuoPackage = packageRows.some((row) => resolvePackageLessonMode(row) === "DUO");
    if (hasDuoPackage && (!duoPartnerName || !duoPartnerContact)) {
      throw new AppError("DUO_PARTNER_REQUIRED", 422, "Duo paket için partner adı ve iletişim bilgisi zorunludur");
    }
    const duoPayment = hasDuoPackage
      ? {
          status: "AWAITING_PARTNER_PAYMENT",
          primary_amount: splitDuoAmount(totalAmount).primary,
          partner_amount: splitDuoAmount(totalAmount).partner,
          currency: "TRY",
          note: "Duo pakette ilk üye %50 payı için onaya girer. Partner daveti ve kalan %50 tamamlanınca paket aktifleşir.",
        }
      : null;

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
      amount: duoPayment ? duoPayment.primary_amount : totalAmount,
      total_package_amount: totalAmount,
      trainer_id: trainerId || null,
      selected_sub_lesson: selectedSubLesson,
      lesson_mode: hasDuoPackage ? "DUO" : null,
      duo_partner_name: hasDuoPackage ? duoPartnerName : null,
      duo_partner_contact: hasDuoPackage ? duoPartnerContact : null,
      duo_payment: duoPayment,
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
    await MemberMobileRequestsController.notifyTenantAdmins({
      tenantId: tenant.id,
      type: hasDuoPackage ? "DUO_PAYMENT_APPROVAL_REQUESTED" : "PAYMENT_APPROVAL_REQUESTED",
      title: hasDuoPackage ? "Yeni duo ödeme onayı" : "Yeni ödeme onayı",
      body: `${account.first_name || "Üye"} ${account.last_name || ""}`.trim()
        ? `${`${account.first_name || "Üye"} ${account.last_name || ""}`.trim()} için ${selectedPackages[0]?.package_title || "paket"} ödeme onayı bekliyor.`
        : `${selectedPackages[0]?.package_title || "Paket"} için ödeme onayı bekliyor.`,
      deepLink: "fizyoflow://approvals",
      meta: {
        approval_id: `payment:${event.id}`,
        package_id: normalizedPackageIds[0],
        is_duo: hasDuoPackage,
      },
    });
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
      user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
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
        total_package_amount: payload.total_package_amount,
        currency: "TRY",
        package_id: normalizedPackageIds[0],
        trainer_id: trainerId || null,
        duo_payment: duoPayment,
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
      data: rows.map((row) => {
        const payload = readEventPayload(row);
        const isDuo = Boolean(payload.duo_payment || payload.duo_partner_name || payload.duo_partner_contact);
        return {
          id: row.id,
          status: String((payload.decision as string) || (payload.status as string) || (row.status === NotificationEventStatus.QUEUED ? "PENDING" : "PROCESSED")),
          amount: typeof payload.amount === "number" ? payload.amount : null,
          currency: "TRY",
          package_id: typeof payload.package_id === "string" ? payload.package_id : null,
          trainer_id: typeof payload.trainer_id === "string" ? payload.trainer_id : null,
          note: typeof payload.note === "string" ? payload.note : null,
          ...(isDuo
            ? {
                total_package_amount:
                  typeof payload.total_package_amount === "number" ? payload.total_package_amount : null,
                duo_partner_name: typeof payload.duo_partner_name === "string" ? payload.duo_partner_name : null,
                duo_partner_contact:
                  typeof payload.duo_partner_contact === "string" ? payload.duo_partner_contact : null,
                duo_payment: payload.duo_payment || null,
              }
            : {}),
        };
      }),
    });
  }

  static async createChangeRequest(req: AuthenticatedRequest, res: Response) {
    const tenantId = req.tenantId;
    const memberId = req.auth?.sub;
    const ownerId = eventMemberId(req);
    const accountId = req.auth?.accountId || null;
    const type = String(req.body?.type ?? "").trim().toUpperCase();
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : null;
    const packageId = typeof req.body?.package_id === "string" ? req.body.package_id.trim() : null;
    const trainerId = typeof req.body?.trainer_id === "string" ? req.body.trainer_id.trim() : null;

    if (!tenantId || !memberId || !ownerId) throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadı");
    if (!["PACKAGE_RENEWAL", "PACKAGE_CANCEL", "TRAINER_CHANGE"].includes(type)) {
      throw new AppError("VALIDATION_ERROR", 422, "Geçersiz talep tipi");
    }

    const pendingChangeRequests = await AppDataSource.getRepository(NotificationEvent).find({
      where: { tenant_id: tenantId, member_id: ownerId, type: MEMBER_CHANGE_REQUEST, status: NotificationEventStatus.QUEUED } as any,
      order: { created_at: "DESC" },
    });
    if (pendingChangeRequests.some((event) => String(readEventPayload(event).request_type || "").toUpperCase() === type)) {
      throw new AppError("CHANGE_REQUEST_EXISTS", 409, "Aynı tipte bekleyen talebiniz zaten var");
    }

    const event = AppDataSource.getRepository(NotificationEvent).create({
      tenant_id: tenantId,
      member_id: ownerId,
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
    await MemberMobileRequestsController.notifyTenantAdmins({
      tenantId,
      type: "CHANGE_APPROVAL_REQUESTED",
      title: "Yeni üye talebi",
      body: `${formatChangeRequestLabel(type)} için admin kararı bekleniyor.`,
      deepLink: "fizyoflow://approvals",
      meta: {
        approval_id: `change:${event.id}`,
        request_type: type,
        package_id: packageId,
        trainer_id: trainerId,
      },
    });
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
      user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
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
    const ownerId = eventMemberId(req);
    if (!tenantId || !ownerId) throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadı");

    const rows = await AppDataSource.getRepository(NotificationEvent).find({
      where: { tenant_id: tenantId, member_id: ownerId, type: MEMBER_CHANGE_REQUEST } as any,
      order: { created_at: "DESC" },
    });

    return res.json({
      data: rows.map((row) => {
        const payload = readEventPayload(row);
        return {
          id: row.id,
          type: String(payload.request_type || "PACKAGE_RENEWAL"),
          status: String((payload.decision as string) || (payload.status as string) || (row.status === NotificationEventStatus.QUEUED ? "PENDING" : "PROCESSED")),
          created_at: row.created_at,
          reason: typeof payload.note === "string" ? payload.note : null,
        };
      }),
    });
  }
}

function formatChangeRequestLabel(type: string) {
  if (type === "PACKAGE_RENEWAL") return "Paket yenileme";
  if (type === "PACKAGE_CANCEL") return "Paket iptali";
  if (type === "TRAINER_CHANGE") return "Eğitmen değişikliği";
  return "Üye talebi";
}
