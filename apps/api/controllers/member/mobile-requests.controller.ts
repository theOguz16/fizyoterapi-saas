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
import { BookingScheduleGuardService } from "../../services/booking-schedule-guard.service";
import { SalonProfile } from "../../entities/salon-profile.entity";
import { SlotValidationContractService } from "../../services/slot-validation-contract.service";

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

function resolveWeeklyLessonCount(pkg: Package) {
  const rules = pkg.rules && typeof pkg.rules === "object" ? pkg.rules as Record<string, unknown> : {};
  const explicit = Number(rules.weekly_class_hours ?? rules.weekly_sessions ?? rules.sessions_per_week ?? 0);
  if (Number.isFinite(explicit) && explicit >= 1) {
    return Math.min(7, Math.max(1, Math.floor(explicit)));
  }
  const durationWeeks = Math.max(1, Number(pkg.duration_days || 0) / 7);
  return Math.min(7, Math.max(1, Math.round(Number(pkg.total_credits || 1) / durationWeeks)));
}

function clinicDateKey(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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

function readJsonRecord(value: unknown): Record<string, any> {
  try {
    if (!value) return {};
    if (typeof value === "string") {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    }
    return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
  } catch {
    return {};
  }
}

export function mergePendingApplicationPayload(existingValue: unknown, incomingValue: Record<string, any>) {
  const existing = readJsonRecord(existingValue);
  const packageMap = new Map<string, Record<string, any>>();
  for (const item of [...(Array.isArray(existing.selected_packages) ? existing.selected_packages : []), ...(Array.isArray(incomingValue.selected_packages) ? incomingValue.selected_packages : [])]) {
    const packageId = String(item?.package_id || "").trim();
    if (packageId) packageMap.set(packageId, { ...packageMap.get(packageId), ...item, package_id: packageId });
  }
  const selectedPackages = Array.from(packageMap.values());
  const packageIds = Array.from(new Set([
    ...(Array.isArray(existing.package_ids) ? existing.package_ids : []),
    existing.package_id,
    ...(Array.isArray(incomingValue.package_ids) ? incomingValue.package_ids : []),
    incomingValue.package_id,
    ...selectedPackages.map((item) => item.package_id),
  ].map((item) => String(item || "").trim()).filter(Boolean)));
  const dayMap = new Map<string, Record<string, any>>();
  for (const day of [...(Array.isArray(existing.selected_days) ? existing.selected_days : []), ...(Array.isArray(incomingValue.selected_days) ? incomingValue.selected_days : [])]) {
    const key = `${String(day?.package_id || "")}:${String(day?.starts_at || "")}`;
    if (key !== ":") dayMap.set(key, { ...day });
  }
  const totalPackageAmount = selectedPackages.reduce((sum, item) => sum + Number(item.package_price || 0), 0);
  const duoPayment = incomingValue.duo_payment || existing.duo_payment || null;
  const partnerAmount = Number(duoPayment?.partner_amount || 0);
  const firstPackage = selectedPackages[0];

  return {
    ...existing,
    ...incomingValue,
    package_id: packageIds[0] || incomingValue.package_id || existing.package_id || null,
    package_ids: packageIds,
    package_title: firstPackage?.package_title || incomingValue.package_title || existing.package_title || null,
    selected_packages: selectedPackages,
    amount: Math.max(0, totalPackageAmount - partnerAmount),
    total_package_amount: totalPackageAmount,
    trainer_id: incomingValue.trainer_id || existing.trainer_id || null,
    selected_sub_lesson: incomingValue.selected_sub_lesson || existing.selected_sub_lesson || null,
    lesson_mode: duoPayment ? "DUO" : incomingValue.lesson_mode || existing.lesson_mode || null,
    duo_partner_name: incomingValue.duo_partner_name || existing.duo_partner_name || null,
    duo_partner_contact: incomingValue.duo_partner_contact || existing.duo_partner_contact || null,
    duo_payment: duoPayment,
    selected_days: Array.from(dayMap.values()),
    note: incomingValue.note ?? existing.note ?? null,
  };
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
    const result = await AppDataSource.transaction(async (manager) => {
      const eventRepo = manager.getRepository(NotificationEvent);
      const event = await eventRepo.findOne({
        where: {
          tenant_id: tenantId,
          member_id: memberId,
          id: requestId,
          type: "TRAINER_SCHEDULE_CHANGE_REQUEST",
        } as any,
        lock: { mode: "pessimistic_write" },
      });
      if (!event) throw new AppError("REQUEST_NOT_FOUND", 404, "Ders degisikligi talebi bulunamadi");
      const payload = readEventPayload(event);
      if (String(payload.status || "PENDING") !== "PENDING" || event.status !== NotificationEventStatus.QUEUED) {
        throw new AppError("REQUEST_RESOLVED", 409, "Bu talep daha once sonuclandirildi");
      }

      if (decision === "APPROVE") {
        const bookingRepo = manager.getRepository(Booking);
        const booking = await bookingRepo.findOne({
          where: { tenant_id: tenantId, id: String(payload.booking_id), member_id: memberId },
          lock: { mode: "pessimistic_write" },
        });
        if (!booking) throw new AppError("BOOKING_NOT_FOUND", 404, "Ders bulunamadi");
        if (booking.status === BookingStatus.CANCELED) {
          throw new AppError("BOOKING_CANCELED", 409, "İptal edilmiş ders yeniden planlanamaz");
        }
        const startsAt = new Date(String(payload.proposed_starts_at));
        const endsAt = new Date(String(payload.proposed_ends_at));
        await BookingScheduleGuardService.ensureAvailable(manager, {
          tenantId,
          trainerId: booking.trainer_id,
          memberId,
          startsAt,
          endsAt,
          sessionId: booking.session_id ?? null,
          excludeBookingId: booking.id,
          status: BookingStatus.RESCHEDULED,
        });
        const previousStartsAt = booking.starts_at;
        const previousEndsAt = booking.ends_at;
        const meta = booking.meta && typeof booking.meta === "object" ? booking.meta : {};
        const history = Array.isArray(meta.reschedule_history)
          ? [...meta.reschedule_history]
          : [];
        history.push({
          changed_by: "MEMBER_APPROVAL",
          changed_at: new Date().toISOString(),
          request_id: event.id,
          from_starts_at: previousStartsAt.toISOString(),
          from_ends_at: previousEndsAt.toISOString(),
          to_starts_at: startsAt.toISOString(),
          to_ends_at: endsAt.toISOString(),
          member_credit_preserved: true,
          selection_strategy: String(payload.selection_strategy || "AUTOMATIC_MEMBER_PREFERENCE"),
        });
        booking.starts_at = startsAt;
        booking.ends_at = endsAt;
        booking.status = BookingStatus.RESCHEDULED;
        booking.meta = {
          ...meta,
          reschedule_history: history,
          latest_reschedule: {
            source: "TRAINER",
            request_id: event.id,
            member_credit_preserved: true,
            selection_strategy: String(payload.selection_strategy || "AUTOMATIC_MEMBER_PREFERENCE"),
          },
        };
        await bookingRepo.save(booking);
      }

      event.payload = {
        ...payload,
        status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
        resolved_at: new Date().toISOString(),
      };
      event.status = NotificationEventStatus.PROCESSED;
      event.processed_at = new Date();
      await eventRepo.save(event);
      return { id: event.id, ...event.payload };
    });
    const resolvedResult = result as Record<string, any> & { id: string };
    const trainerId = String(resolvedResult.trainer_id || "");
    const admins = await AppDataSource.getRepository(User).find({
      where: { tenant_id: tenantId, role: UserRole.ADMIN, is_active: true },
      select: ["id"],
    });
    const decisionLabel = decision === "APPROVE" ? "kabul etti" : "reddetti";
    await Promise.allSettled([
      ...(trainerId
        ? [
            MobileNotificationService.queuePush({
              tenantId,
              userId: trainerId,
              roleScope: "TRAINER" as const,
              type: decision === "APPROVE" ? "SCHEDULE_CHANGE_APPROVED" : "SCHEDULE_CHANGE_REJECTED",
              title: "Saat değişikliği yanıtlandı",
              body: `Danışan otomatik saat önerisini ${decisionLabel}.`,
              deepLink: "/(trainer)/calendar" as const,
              meta: { request_id: resolvedResult.id, booking_id: resolvedResult.booking_id, member_credit_preserved: true },
            }),
          ]
        : []),
      ...admins.map((admin) =>
        MobileNotificationService.queuePush({
          tenantId,
          userId: admin.id,
          roleScope: "ADMIN" as const,
          type: decision === "APPROVE" ? "SCHEDULE_CHANGE_APPROVED" : "SCHEDULE_CHANGE_REJECTED",
          title: "Ders saati değişikliği",
          body: `Danışan eğitmen kaynaklı otomatik saat önerisini ${decisionLabel}; paket hakkı etkilenmedi.`,
          deepLink: "/(admin)/calendar",
          meta: { request_id: resolvedResult.id, booking_id: resolvedResult.booking_id, member_credit_preserved: true },
        })
      ),
    ]);
    return res.json({ data: result });
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
    deepLink: Parameters<typeof MobileNotificationService.queuePush>[0]["deepLink"];
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
    const privatePackages = packageRows.filter((row) => resolvePackageLessonMode(row) !== "GROUP");
    if (privatePackages.length > 0 && !trainerId) {
      throw new AppError("TRAINER_REQUIRED", 422, "Bireysel paketlerin otomatik planlanması için eğitmen seçimi zorunludur");
    }
    const normalizedSlots: Array<{ packageId: string; startsAt: Date; endsAt: Date }> = (selectedDays as unknown[])
      .map((raw: unknown): { packageId: string; startsAt: Date; endsAt: Date } | null => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
        const row = raw as Record<string, unknown>;
        const startsAt = new Date(String(row.starts_at || ""));
        const endsAt = new Date(String(row.ends_at || ""));
        if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) return null;
        return {
          packageId: String(row.package_id || normalizedPackageIds[0]),
          startsAt,
          endsAt,
        };
      })
      .filter((row): row is { packageId: string; startsAt: Date; endsAt: Date } => Boolean(row));
    if (normalizedSlots.length !== selectedDays.length || normalizedSlots.some((slot) => slot.startsAt <= new Date())) {
      throw new AppError("INVALID_BOOKING_PREFERENCES", 422, "Saat tercihlerinin tamamı geçerli ve gelecekte olmalıdır");
    }
    const profile = await AppDataSource.getRepository(SalonProfile).findOne({
      where: { tenant_id: tenant.id },
      order: { created_at: "DESC" },
      select: ["id", "business_hours"],
    });
    const businessHours = SlotValidationContractService.normalizeBusinessHours(profile?.business_hours);
    if (
      normalizedSlots.some(
        (slot) => !SlotValidationContractService.isWithinBusinessHours(slot.startsAt, slot.endsAt, businessHours).ok
      )
    ) {
      throw new AppError("BOOKING_PREFERENCE_OUTSIDE_BUSINESS_HOURS", 422, "Saat tercihlerinden biri klinik çalışma düzeni dışında");
    }
    for (const packageRow of privatePackages) {
      const weeklyLessonCount = resolveWeeklyLessonCount(packageRow);
      const requiredPreferenceCount = weeklyLessonCount * 3;
      const packageSlots = normalizedSlots.filter((slot) => slot.packageId === packageRow.id);
      const uniqueSlotCount = new Set(
        packageSlots.map((slot) => `${slot.startsAt.toISOString()}|${slot.endsAt.toISOString()}`)
      ).size;
      if (uniqueSlotCount < requiredPreferenceCount) {
        throw new AppError(
          "WEEKLY_SLOT_REQUIREMENT_NOT_MET",
          422,
          `${packageRow.title} için ${requiredPreferenceCount} farklı saat tercihi zorunludur`
        );
      }
      const distinctDayCount = new Set(
        packageSlots.map((slot) => clinicDateKey(slot.startsAt, businessHours.timezone))
      ).size;
      if (distinctDayCount < weeklyLessonCount) {
        throw new AppError(
          "DISTINCT_WEEKLY_DAYS_REQUIRED",
          422,
          `${packageRow.title} için ${weeklyLessonCount} farklı gün seçmelisiniz; aynı güne birden fazla otomatik ders atanmaz`
        );
      }
    }
    const totalWeeklyLessonCount = privatePackages.reduce(
      (sum, packageRow) => sum + resolveWeeklyLessonCount(packageRow),
      0
    );
    if (totalWeeklyLessonCount > 7) {
      throw new AppError(
        "WEEKLY_LESSON_DAY_LIMIT_EXCEEDED",
        422,
        "Özel ders paketlerinde toplam haftalık ders sayısı 7 günü aşamaz"
      );
    }
    const combinedDistinctDayCount = new Set(
      normalizedSlots
        .filter((slot) => privatePackages.some((packageRow) => packageRow.id === slot.packageId))
        .map((slot) => clinicDateKey(slot.startsAt, businessHours.timezone))
    ).size;
    if (combinedDistinctDayCount < totalWeeklyLessonCount) {
      throw new AppError(
        "DISTINCT_WEEKLY_DAYS_REQUIRED",
        422,
        `Seçtiğiniz paketler için toplam ${totalWeeklyLessonCount} farklı gün gereklidir`
      );
    }
    if (trainerId && privatePackages.length > 0) {
      const minStart = new Date(Math.min(...normalizedSlots.map((slot) => slot.startsAt.getTime())));
      const maxEnd = new Date(Math.max(...normalizedSlots.map((slot) => slot.endsAt.getTime())));
      const trainerBookings = await AppDataSource.getRepository(Booking)
        .createQueryBuilder("booking")
        .where("booking.tenant_id = :tenantId", { tenantId: tenant.id })
        .andWhere("booking.trainer_id = :trainerId", { trainerId })
        .andWhere("booking.status IN (:...statuses)", {
          statuses: [BookingStatus.PENDING, BookingStatus.APPROVED, BookingStatus.RESCHEDULED],
        })
        .andWhere("booking.starts_at < :maxEnd", { maxEnd })
        .andWhere("booking.ends_at > :minStart", { minStart })
        .getMany();
      for (const packageRow of privatePackages) {
        const requiredTrainerFreeCount = resolveWeeklyLessonCount(packageRow) * 2;
        const freeCount = normalizedSlots
          .filter((slot) => slot.packageId === packageRow.id)
          .filter(
            (slot) =>
              !trainerBookings.some(
                (booking) => booking.starts_at < slot.endsAt && booking.ends_at > slot.startsAt
              )
          ).length;
        if (freeCount < requiredTrainerFreeCount) {
          throw new AppError(
            "TRAINER_CONFLICT_REQUIREMENT_NOT_MET",
            409,
            `${packageRow.title} için eğitmenle çakışmayan en az ${requiredTrainerFreeCount} tercih gereklidir`
          );
        }
      }
    }
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
        application.note = JSON.stringify(mergePendingApplicationPayload(application.note, payload));
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
      deepLink: "/(admin)/approvals",
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
      deepLink: "/(admin)/approvals",
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
