// Bu controller trainer tarafindaki bookings.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { Availability } from "../../entities/availability.entity";
import { Booking, BookingPaymentStatus, BookingStatus } from "../../entities/booking.entity";
import { ClassSession, LessonCategory, SessionStatus } from "../../entities/class-session.entity";
import { Package } from "../../entities/package.entity";
import { PackageTrainerAssignment } from "../../entities/package-trainer-assignment.entity";
import { SalonProfile } from "../../entities/salon-profile.entity";
import { TrainerSkill } from "../../entities/trainer-skill.entity";
import { User, UserRole } from "../../entities/user.entity";
import { UserPackage } from "../../entities/user-package.entity";
import { SalonApplication, SalonApplicationStatus } from "../../entities/salon-application.entity";
import { MembershipPaymentStatus, SalonMembership, SalonMembershipStatus } from "../../entities/salon-membership.entity";
import { ReferralAutomationService } from "../../services/referral-automation.service";
import { BookingEligibilityService } from "../../services/booking-eligibility.service";
import { SlotValidationContract, SlotValidationContractService } from "../../services/slot-validation-contract.service";
import { lessonCategoryLabel, packageDisplayName } from "../../services/presentation-label.service";
import { MobileNotificationService } from "../../services/mobile-notification.service";
import { MobilePurchaseSyncService } from "../../services/mobile-purchase-sync.service";
import { AuditLogService } from "../../services/audit-log.service";
import { AvailabilityProjectionService } from "../../services/availability-projection.service";
import {
  ensureMinimumAdvanceHours,
  parseBookingDate,
  resolveMinimumAdvanceHours,
  validateBookingDuration,
} from "./booking-helpers";

const BLOCKING_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.APPROVED,
  BookingStatus.RESCHEDULED,
];

type SlotParams = {
  tenantId: string;
  trainerId: string;
  memberId: string;
  startsAt: Date;
  endsAt: Date;
  excludeBookingId?: string;
};

type CalendarBusinessHours = SlotValidationContract;

export class TrainerBookingsController {
  private static async logBookingAudit(
    req: AuthenticatedRequest,
    input: {
      eventType: string;
      booking: Booking;
      oldStatus?: BookingStatus | null;
      newStatus?: BookingStatus | null;
      oldStartsAt?: Date | null;
      newStartsAt?: Date | null;
      oldEndsAt?: Date | null;
      newEndsAt?: Date | null;
    }
  ) {
    await AuditLogService.log({
      tenant_id: req.tenantId || req.auth?.tenantId || null,
      actor_user_id: req.auth?.linkedUserId || req.auth?.sub || null,
      actor_account_id: req.auth?.accountId || null,
      actor_role: req.auth?.role || null,
      event_type: input.eventType,
      action: input.eventType,
      method: req.method,
      path: req.originalUrl,
      status_code: 200,
      success: true,
      request_id: req.requestId || null,
      ip_address: req.ip || null,
      user_agent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
      target_type: "booking",
      target_id: input.booking.id,
      metadata: {
        booking_id: input.booking.id,
        member_id: input.booking.member_id,
        trainer_id: input.booking.trainer_id,
        session_id: input.booking.session_id ?? null,
        old_status: input.oldStatus ?? null,
        new_status: input.newStatus ?? null,
        old_starts_at: input.oldStartsAt?.toISOString() ?? null,
        new_starts_at: input.newStartsAt?.toISOString() ?? null,
        old_ends_at: input.oldEndsAt?.toISOString() ?? null,
        new_ends_at: input.newEndsAt?.toISOString() ?? null,
      },
    });
  }

  private static async reconcileApprovedMobilePurchases(tenantId: string) {
    const applications = await AppDataSource.getRepository(SalonApplication).find({
      where: {
        tenant_id: tenantId,
        status: SalonApplicationStatus.APPROVED,
        payment_status: MembershipPaymentStatus.VERIFIED,
      },
      order: { updated_at: "DESC" as never },
      take: 50,
    });
    if (applications.length === 0) return;

    const memberships = await AppDataSource.getRepository(SalonMembership).find({
      where: applications.map((row) => ({
        tenant_id: tenantId,
        account_id: row.account_id,
        role: UserRole.MEMBER,
        status: SalonMembershipStatus.ACTIVE,
        is_active_context: true,
      })) as any,
    });
    const membershipMap = new Map(memberships.map((row) => [row.account_id, row]));
    const userIds = Array.from(new Set(memberships.map((row) => row.user_id).filter(Boolean))) as string[];
    if (userIds.length === 0) return;

    const [users, availabilityRows, userPackageRows] = await Promise.all([
      AppDataSource.getRepository(User).find({
        where: userIds.map((id) => ({ tenant_id: tenantId, id, role: UserRole.MEMBER })) as any,
      }),
      AppDataSource.getRepository(Availability)
        .createQueryBuilder("a")
        .select("a.member_id", "member_id")
        .addSelect("COUNT(*)", "count")
        .where("a.tenant_id = :tenantId", { tenantId })
        .andWhere("a.member_id IN (:...userIds)", { userIds })
        .groupBy("a.member_id")
        .getRawMany<{ member_id: string; count: string }>(),
      AppDataSource.getRepository(UserPackage)
        .createQueryBuilder("up")
        .select("up.user_id", "user_id")
        .addSelect("COUNT(*)", "count")
        .where("up.tenant_id = :tenantId", { tenantId })
        .andWhere("up.user_id IN (:...userIds)", { userIds })
        .andWhere("up.is_active = true")
        .groupBy("up.user_id")
        .getRawMany<{ user_id: string; count: string }>(),
    ]);

    const userMap = new Map(users.map((row) => [row.id, row]));
    const availabilityCountMap = new Map(availabilityRows.map((row) => [row.member_id, Number(row.count) || 0]));
    const packageCountMap = new Map(userPackageRows.map((row) => [row.user_id, Number(row.count) || 0]));

    for (const application of applications) {
      const membership = membershipMap.get(application.account_id);
      const memberUser = membership?.user_id ? userMap.get(membership.user_id) : null;
      if (!memberUser) continue;
      if ((availabilityCountMap.get(memberUser.id) || 0) > 0 && (packageCountMap.get(memberUser.id) || 0) > 0) {
        continue;
      }
      await MobilePurchaseSyncService.applyApprovedPurchase({
        tenantId,
        memberUser,
        application,
      });
    }
  }

  private static filterAvailabilityRowsForTrainer<T extends { member_id?: string | null; note?: string | null }>(
    trainerId: string,
    rows: T[]
  ) {
    return rows
      .filter((row) => {
        const parsed = MobilePurchaseSyncService.parseAvailabilityNote(row.note);
        if (!parsed.preferredTrainerId) return true;
        return parsed.preferredTrainerId === trainerId;
      })
      .map((row) => {
        const parsed = MobilePurchaseSyncService.parseAvailabilityNote(row.note);
        return {
          ...row,
          note: parsed.displayNote,
        };
      });
  }

  private static startOfIsoWeek(date: Date) {
    const dt = new Date(date);
    const day = dt.getDay() || 7;
    dt.setDate(dt.getDate() - day + 1);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  private static endOfIsoWeek(date: Date) {
    const start = TrainerBookingsController.startOfIsoWeek(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  private static extractZoneWeekdayAndMinutes(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const weekdayRaw = parts.find((part) => part.type === "weekday")?.value ?? "Mon";
    const hourRaw = parts.find((part) => part.type === "hour")?.value ?? "00";
    const minuteRaw = parts.find((part) => part.type === "minute")?.value ?? "00";
    const weekdayMap: Record<string, number> = {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 7,
    };
    const isoWeekday = weekdayMap[weekdayRaw] ?? 1;
    const minutes = Number(hourRaw) * 60 + Number(minuteRaw);
    return { isoWeekday, minutes };
  }

  private static async loadBusinessHours(tenantId: string): Promise<CalendarBusinessHours> {
    const profile = await AppDataSource.getRepository(SalonProfile).findOne({
      where: { tenant_id: tenantId },
      order: { created_at: "DESC" },
      select: ["id", "business_hours"],
    });
    return SlotValidationContractService.normalizeBusinessHours(profile?.business_hours);
  }

  private static async loadMinimumAdvanceHours(tenantId: string) {
    const profile = await AppDataSource.getRepository(SalonProfile).findOne({
      where: { tenant_id: tenantId },
      order: { created_at: "DESC" },
      select: ["id", "location"],
    });
    return resolveMinimumAdvanceHours(profile?.location?.campaigns?.cancellation_policy?.min_hours_before_start, 3);
  }

  private static ensureWithinBusinessHours(
    startsAt: Date,
    endsAt: Date,
    businessHours: CalendarBusinessHours
  ) {
    const result = SlotValidationContractService.isWithinBusinessHours(startsAt, endsAt, businessHours);
    if (!result.ok) {
      if (result.reason?.includes("öğle arası")) {
        throw new AppError("BUSINESS_HOURS_LUNCH_BREAK", 400, result.reason);
      }
      if (result.reason?.includes("slot")) {
        throw new AppError("BUSINESS_SLOT_ALIGNMENT", 400, result.reason);
      }
      if (result.reason?.includes("kapalı")) {
        throw new AppError("BUSINESS_DAY_CLOSED", 400, result.reason);
      }
      throw new AppError("BUSINESS_HOURS_OUT_OF_RANGE", 400, result.reason || "Randevu çalışma saatleri dışında");
    }
  }

  private static normalizeLessonCategory(raw: unknown): LessonCategory | null {
    const value = String(raw ?? "").trim().toUpperCase();
    if (!value) return null;
    if (value === "GROUP" || value === "GRUP") return LessonCategory.GRUP;
    if (value === "PT") return LessonCategory.PT;
    if (value === "SCOLIOSIS" || value === "SKOLYOZ") return LessonCategory.SKOLYOZ;
    if (value === "PILATES") return LessonCategory.PILATES;
    if (value === "REFORMER") return LessonCategory.REFORMER;
    return null;
  }

  private static validateStatus(status: unknown): asserts status is BookingStatus {
    if (typeof status !== "string" || !Object.values(BookingStatus).includes(status as BookingStatus)) {
      throw new AppError("VALIDATION_ERROR", 400, "Geçersiz booking status");
    }
  }

  private static async ensureUser(tenantId: string, userId: string, role: UserRole) {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { tenant_id: tenantId, id: userId, role },
    });
    if (!user) {
      throw new AppError("USER_NOT_FOUND", 404, `${role} bulunamadı`);
    }
    if (!user.is_active) {
      throw new AppError("USER_INACTIVE", 400, `${role} aktif değil`);
    }
    return user;
  }

  private static async validateNoOverlap({ tenantId, trainerId, memberId, startsAt, endsAt, excludeBookingId }: SlotParams) {
    const repo = AppDataSource.getRepository(Booking);
    const trainerQb = repo
      .createQueryBuilder("b")
      .where("b.tenant_id = :tenantId", { tenantId })
      .andWhere("b.trainer_id = :trainerId", { trainerId })
      .andWhere("b.status IN (:...statuses)", { statuses: BLOCKING_BOOKING_STATUSES })
      .andWhere("b.starts_at < :endsAt", { endsAt })
      .andWhere("b.ends_at > :startsAt", { startsAt });
    if (excludeBookingId) {
      trainerQb.andWhere("b.id != :excludeBookingId", { excludeBookingId });
    }

    const trainerOverlap = await trainerQb.getOne();
    if (trainerOverlap) {
      throw new AppError(
        "TRAINER_OVERLAP",
        400,
        `Eğitmenin aynı saatte randevusu var (${new Date(trainerOverlap.starts_at).toLocaleString("tr-TR")} - ${new Date(
          trainerOverlap.ends_at
        ).toLocaleString("tr-TR")})`
      );
    }

    const memberQb = repo
      .createQueryBuilder("b")
      .where("b.tenant_id = :tenantId", { tenantId })
      .andWhere("b.member_id = :memberId", { memberId })
      .andWhere("b.status IN (:...statuses)", { statuses: BLOCKING_BOOKING_STATUSES })
      .andWhere("b.starts_at < :endsAt", { endsAt })
      .andWhere("b.ends_at > :startsAt", { startsAt });
    if (excludeBookingId) {
      memberQb.andWhere("b.id != :excludeBookingId", { excludeBookingId });
    }

    const memberOverlap = await memberQb.getOne();
    if (memberOverlap) {
      throw new AppError("MEMBER_OVERLAP", 400, "Üyenin aynı saatte başka bir randevusu var");
    }
  }

  private static async ensureWithinMemberAvailability(
    tenantId: string,
    memberId: string,
    startsAt: Date,
    endsAt: Date
  ) {
    const rows = await AppDataSource.getRepository(Availability).find({
      where: { tenant_id: tenantId, member_id: memberId },
      order: { starts_at: "ASC" },
    });
    const matched =
      rows.find((row) => row.starts_at <= startsAt && row.ends_at >= endsAt) ||
      (AvailabilityProjectionService.matchesWeeklyPattern(rows, startsAt, endsAt) ? rows[0] : null);

    if (!matched) {
      throw new AppError(
        "MEMBER_AVAILABILITY_OUT_OF_RANGE",
        400,
        "Seçilen saat, danışanın paylaştığı müsaitlik aralığı dışında"
      );
    }
  }

  private static async ensureMemberWeeklyLessonLimit(
    tenantId: string,
    member: User,
    startsAt: Date,
    excludeBookingId?: string
  ) {
    const weeklyLimit = Math.max(1, Number(member.weekly_class_hours || 1));
    const weekStart = TrainerBookingsController.startOfIsoWeek(startsAt);
    const weekEnd = TrainerBookingsController.endOfIsoWeek(startsAt);

    const qb = AppDataSource.getRepository(Booking)
      .createQueryBuilder("b")
      .where("b.tenant_id = :tenantId", { tenantId })
      .andWhere("b.member_id = :memberId", { memberId: member.id })
      .andWhere("b.status IN (:...statuses)", { statuses: BLOCKING_BOOKING_STATUSES })
      .andWhere("b.starts_at >= :weekStart", { weekStart })
      .andWhere("b.starts_at <= :weekEnd", { weekEnd });

    if (excludeBookingId) {
      qb.andWhere("b.id != :excludeBookingId", { excludeBookingId });
    }

    const currentCount = await qb.getCount();
    if (currentCount >= weeklyLimit) {
      throw new AppError(
        "MEMBER_WEEKLY_LIMIT_EXCEEDED",
        400,
        `Bu üye için haftalık ders hakkı dolu (haftalık hedef: ${weeklyLimit} ders)`
      );
    }
  }

  private static async ensureSessionCapacity(
    tenantId: string,
    sessionId: string,
    excludeBookingId?: string
  ) {
    const session = await AppDataSource.getRepository(ClassSession).findOne({
      where: { id: sessionId, tenant_id: tenantId },
    });
    if (!session) {
      throw new AppError("SESSION_NOT_FOUND", 404, "Seans bulunamadı");
    }
    if (session.status === SessionStatus.CANCELED) {
      throw new AppError("SESSION_CANCELED", 400, "Seans iptal edilmiş");
    }
    if (session.capacity <= 0) {
      return session;
    }

    const qb = AppDataSource.getRepository(Booking)
      .createQueryBuilder("b")
      .where("b.tenant_id = :tenantId", { tenantId })
      .andWhere("b.session_id = :sessionId", { sessionId })
      .andWhere("b.status = :status", { status: BookingStatus.APPROVED });
    if (excludeBookingId) {
      qb.andWhere("b.id != :excludeBookingId", { excludeBookingId });
    }

    const approvedCount = await qb.getCount();
    if (approvedCount >= session.capacity) {
      throw new AppError("SESSION_CAPACITY_FULL", 400, "Seans kapasitesi dolu");
    }
    return session;
  }

  private static async ensureTrainerSkillForCategory(
    tenantId: string,
    trainerId: string,
    lessonCategory: LessonCategory
  ) {
    const skill = await AppDataSource.getRepository(TrainerSkill).findOne({
      where: {
        tenant_id: tenantId,
        trainer_id: trainerId,
        lesson_category: lessonCategory,
        is_active: true,
      },
    });
    if (!skill) {
      throw new AppError("TRAINER_SKILL_MISMATCH", 400, "Eğitmen bu ders kategorisi için yetkili değil");
    }
  }

  private static async ensureTrainerPackageAssignment(
    tenantId: string,
    trainerId: string,
    packageId: string | undefined
  ) {
    if (!packageId) return;
    const assignment = await AppDataSource.getRepository(PackageTrainerAssignment).findOne({
      where: {
        tenant_id: tenantId,
        trainer_id: trainerId,
        package_id: packageId,
        is_active: true,
      },
    });
    if (!assignment) {
      throw new AppError(
        "PACKAGE_TRAINER_ASSIGNMENT_NOT_FOUND",
        400,
        "Bu paket için eğitmen yetkisi bulunmuyor"
      );
    }
  }

  private static async resolvePackageContext(tenantId: string, packageId: string) {
    const pkg = await AppDataSource.getRepository(Package).findOne({
      where: { tenant_id: tenantId, id: packageId, is_active: true },
      select: ["id", "title", "display_price", "rules"],
    });
    if (!pkg) {
      throw new AppError("PACKAGE_NOT_FOUND", 404, "Seçilen paket bulunamadı veya dondurulmuş");
    }
    const rules = (pkg.rules && typeof pkg.rules === "object" ? pkg.rules : {}) as Record<string, unknown>;
    const lessonCategory =
      TrainerBookingsController.normalizeLessonCategory(rules.lesson_category) ??
      TrainerBookingsController.normalizeLessonCategory(rules.service_key);
    if (!lessonCategory) {
      throw new AppError("PACKAGE_LESSON_CATEGORY_MISSING", 400, "Paket ders kategorisi tanımsız");
    }

    return {
      pkg,
      rules,
      lessonCategory,
    };
  }

  // --- GET /api/trainer/bookings/availabilities ---
  static async listAvailabilities(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const trainerId = req.auth?.sub;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }
      if (!trainerId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Trainer bilgisi bulunamadi");
      }
      await TrainerBookingsController.reconcileApprovedMobilePurchases(tenantId);

      const memberId = req.query.member_id ? String(req.query.member_id).trim() : "";
      const from = req.query.from ? new Date(String(req.query.from)) : null;
      const to = req.query.to ? new Date(String(req.query.to)) : null;
      if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
        throw new AppError("VALIDATION_ERROR", 400, "from/to geçersiz tarih");
      }
      const qb = AppDataSource.getRepository(Availability)
        .createQueryBuilder("a")
        .where("a.tenant_id = :tenantId", { tenantId })
        .orderBy("a.starts_at", "ASC");

      if (memberId) {
        qb.andWhere("a.member_id = :memberId", { memberId });
      }

      const rows = await qb.getMany();
      const projectedRows = from && to ? AvailabilityProjectionService.projectWeeklyRange(rows, from, to) : rows;
      const memberIds = Array.from(new Set(projectedRows.map((row) => row.member_id).filter(Boolean)));
      const packageIds = Array.from(new Set(projectedRows.map((row) => row.package_id).filter(Boolean)));

      const [members, packages] = await Promise.all([
        memberIds.length
          ? AppDataSource.getRepository(User).find({
              where: memberIds.map((id) => ({ tenant_id: tenantId, id, role: UserRole.MEMBER })),
              select: ["id", "first_name", "last_name", "email", "weekly_class_hours"],
            })
          : Promise.resolve([]),
        packageIds.length
          ? AppDataSource.getRepository(Package).find({
              where: packageIds.map((id) => ({ tenant_id: tenantId, id: String(id) })),
              select: ["id", "title", "display_price", "rules"],
            })
          : Promise.resolve([]),
      ]);

      const memberMap = new Map(
        members.map((row) => [
          row.id,
          {
            full_name: `${row.first_name} ${row.last_name}`.trim(),
            email: row.email,
            weekly_class_hours: row.weekly_class_hours ?? 1,
          },
        ])
      );
      const packageMap = new Map(packages.map((row) => [row.id, row]));

      const filteredRows = TrainerBookingsController.filterAvailabilityRowsForTrainer(trainerId, projectedRows);

      return res.json({
        data: filteredRows.map((row) => ({
          ...row,
          member_full_name: memberMap.get(row.member_id)?.full_name ?? null,
          member_email: memberMap.get(row.member_id)?.email ?? null,
          member_weekly_class_hours: memberMap.get(row.member_id)?.weekly_class_hours ?? 1,
          package_title: row.package_id ? packageMap.get(String(row.package_id))?.title ?? null : null,
          package_display_price: row.package_id ? packageMap.get(String(row.package_id))?.display_price ?? null : null,
          package_lesson_category: row.package_id
            ? TrainerBookingsController.normalizeLessonCategory(
                (packageMap.get(String(row.package_id))?.rules as Record<string, unknown> | undefined)?.lesson_category
              )
            : null,
        })),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Trainer availabilities list error:", error);
      throw new AppError("TRAINER_AVAILABILITIES_LIST_ERROR", 500, "Müsaitlikler listelenemedi");
    }
  }

  // --- GET /api/trainer/bookings/form-options ---
  static async formOptions(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const trainerId = req.auth?.sub;
      if (!tenantId || !trainerId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadı");
      }
      await TrainerBookingsController.reconcileApprovedMobilePurchases(tenantId);

      const [members, skills, slotContract] = await Promise.all([
        AppDataSource.getRepository(User).find({
          where: { tenant_id: tenantId, role: UserRole.MEMBER, is_active: true },
          order: { first_name: "ASC", last_name: "ASC" },
          select: ["id", "first_name", "last_name", "email"],
        }),
        AppDataSource.getRepository(TrainerSkill).find({
          where: { tenant_id: tenantId, trainer_id: trainerId, is_active: true },
          order: { lesson_category: "ASC" },
        }),
        TrainerBookingsController.loadBusinessHours(tenantId),
      ]);

      const memberRows = members.map((row) => row.id);
      const availabilityPreferenceRows = memberRows.length
        ? await AppDataSource.getRepository(Availability).find({
            where: memberRows.map((memberId) => ({ tenant_id: tenantId, member_id: memberId })) as any,
            order: { starts_at: "ASC" },
            select: ["id", "member_id", "note"],
          })
        : [];
      const preferredTrainerMap = new Map<string, string>();
      for (const row of availabilityPreferenceRows) {
        const parsed = MobilePurchaseSyncService.parseAvailabilityNote(row.note);
        if (parsed.preferredTrainerId && !preferredTrainerMap.has(row.member_id)) {
          preferredTrainerMap.set(row.member_id, parsed.preferredTrainerId);
        }
      }
      const filteredMembers = members.filter((row) => {
        const preferredTrainerId = preferredTrainerMap.get(row.id);
        return !preferredTrainerId || preferredTrainerId === trainerId;
      });

      const trainerAssignedPackageIds = await BookingEligibilityService.getActiveTrainerAssignmentPackageIds(
        tenantId,
        trainerId
      );
      const packageIds = Array.from(new Set(trainerAssignedPackageIds));
      const packages = packageIds.length
        ? await AppDataSource.getRepository(Package).find({
            where: packageIds.map((id) => ({ tenant_id: tenantId, id, is_active: true })),
            order: { title: "ASC" },
            select: ["id", "title", "display_price", "rules", "type"],
          })
        : [];
      const memberIds = filteredMembers.map((row) => row.id);
      const activeByMember = await BookingEligibilityService.getActiveMemberPackageIds(tenantId, memberIds);
      const activeTrainerPackageIds = packages.map((row) => row.id);
      const skillSet = new Set(skills.map((row) => row.lesson_category));
      const allowedCategories = skillSet.size > 0 ? Array.from(skillSet) : Object.values(LessonCategory);
      const packageLessonCategoryMap = Object.fromEntries(
        packages.map((row) => [
          row.id,
          TrainerBookingsController.normalizeLessonCategory(
            (row.rules as Record<string, unknown> | undefined)?.lesson_category
          ),
        ])
      );
      const { memberActivePackageIds, memberBookablePackageIds, memberPackageDiagnostics } =
        BookingEligibilityService.buildMemberBookablePackageMap(memberIds, activeByMember, activeTrainerPackageIds, {
          packageLessonCategoryMap,
          trainerSkillSet: skillSet,
        });

      return res.json({
        data: {
          members: filteredMembers.map((row) => ({
            id: row.id,
            full_name: `${row.first_name} ${row.last_name}`.trim(),
            email: row.email,
          })),
          packages: packages.map((row) => ({
            id: row.id,
            title: row.title,
            package_name: packageDisplayName(row.title),
            display_price: row.display_price ?? null,
            service_name:
              String((row.rules as Record<string, unknown> | undefined)?.service_name ?? "").trim() || row.title,
            lesson_category:
              TrainerBookingsController.normalizeLessonCategory(
                (row.rules as Record<string, unknown> | undefined)?.lesson_category
              ) ?? null,
            lesson_category_label: lessonCategoryLabel(
              TrainerBookingsController.normalizeLessonCategory(
                (row.rules as Record<string, unknown> | undefined)?.lesson_category
              ) ?? null
            ),
            package_type: row.type,
          })),
          trainer_assigned_packages: activeTrainerPackageIds,
          member_active_package_ids: memberActivePackageIds,
          member_bookable_package_ids: memberBookablePackageIds,
          member_package_diagnostics: memberPackageDiagnostics,
          allowed_categories: allowedCategories,
          slot_contract: slotContract,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Trainer booking form options error:", error);
      throw new AppError("TRAINER_BOOKING_FORM_OPTIONS_ERROR", 500, "Randevu form seçenekleri getirilemedi");
    }
  }

  // --- GET /api/trainer/bookings ---
  static async list(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const trainerId = req.auth?.sub;
      if (!tenantId || !trainerId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadı");
      }

      const status = req.query.status ? String(req.query.status) : undefined;
      const from = req.query.from ? new Date(String(req.query.from)) : null;
      const to = req.query.to ? new Date(String(req.query.to)) : null;
      if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
        throw new AppError("VALIDATION_ERROR", 400, "from/to geçersiz tarih");
      }

      const qb = AppDataSource.getRepository(Booking)
        .createQueryBuilder("b")
        .where("b.tenant_id = :tenantId", { tenantId })
        .andWhere("b.trainer_id = :trainerId", { trainerId });

      if (status && Object.values(BookingStatus).includes(status as BookingStatus)) {
        qb.andWhere("b.status = :status", { status: status as BookingStatus });
      }

      if (from && to) {
        qb.andWhere("b.starts_at < :to", { to }).andWhere("b.ends_at > :from", { from });
      } else if (from) {
        qb.andWhere("b.ends_at > :from", { from });
      } else if (to) {
        qb.andWhere("b.starts_at < :to", { to });
      }

      const rows = await qb.orderBy("b.starts_at", "ASC").getMany();
      const sessionIds = Array.from(new Set(rows.map((row) => row.session_id).filter(Boolean)));
      const sessions = sessionIds.length
        ? await AppDataSource.getRepository(ClassSession).find({
            where: sessionIds.map((id) => ({ tenant_id: tenantId, id: String(id) })),
            select: ["id", "title", "type", "lesson_category"],
          })
        : [];
      const sessionMap = new Map(sessions.map((row) => [row.id, row]));
      const members = rows.length
        ? await AppDataSource.getRepository(User).find({
            where: rows.map((row) => ({ tenant_id: tenantId, id: row.member_id, role: UserRole.MEMBER })),
            select: ["id", "first_name", "last_name"],
          })
        : [];
      const memberMap = new Map(members.map((row) => [row.id, `${row.first_name} ${row.last_name}`.trim()]));

      const packageIds = Array.from(
        new Set(
          rows
            .map((row) => String(((row.meta as Record<string, unknown> | undefined)?.package_id ?? "") as string))
            .filter(Boolean)
        )
      );
      const packages = packageIds.length
        ? await AppDataSource.getRepository(Package).find({
            where: packageIds.map((id) => ({ tenant_id: tenantId, id })),
            select: ["id", "title", "display_price", "rules"],
          })
        : [];
      const packageMap = new Map(packages.map((row) => [row.id, row]));

      return res.json({
        data: rows.map((row) => {
          const meta = (row.meta as Record<string, unknown> | undefined) ?? {};
          const packageId = String(meta.package_id ?? "");
          const packageInfo = packageId ? packageMap.get(packageId) : null;
          const metaLesson = TrainerBookingsController.normalizeLessonCategory(meta.lesson_category);
          const ruleLesson = TrainerBookingsController.normalizeLessonCategory(
            (packageInfo?.rules as Record<string, unknown> | undefined)?.lesson_category
          );
          return {
            ...row,
            member_full_name: memberMap.get(row.member_id) ?? null,
            session_title: row.session_id ? sessionMap.get(String(row.session_id))?.title ?? null : null,
            session_type: row.session_id ? sessionMap.get(String(row.session_id))?.type ?? null : null,
            lesson_category:
              (row.session_id ? sessionMap.get(String(row.session_id))?.lesson_category ?? null : null) ??
              metaLesson ??
              ruleLesson,
            lesson_category_label: lessonCategoryLabel(
              (row.session_id ? sessionMap.get(String(row.session_id))?.lesson_category ?? null : null) ??
                metaLesson ??
                ruleLesson
            ),
            package_title:
              (typeof meta.package_title === "string" && meta.package_title) || packageInfo?.title || null,
            package_display_price:
              (typeof meta.package_display_price === "string" && meta.package_display_price) ||
              packageInfo?.display_price ||
              null,
            package_name: packageDisplayName(
              (typeof meta.package_title === "string" && meta.package_title) || packageInfo?.title || null
            ),
          };
        }),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Trainer bookings list error:", error);
      throw new AppError("TRAINER_BOOKINGS_LIST_ERROR", 500, "Randevular listelenemedi");
    }
  }

  // --- GET /api/trainer/bookings/:id ---
  static async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const trainerId = req.auth?.sub;
      const bookingId = String(req.params.id ?? "");
      if (!tenantId || !trainerId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadı");
      }

      const booking = await AppDataSource.getRepository(Booking).findOne({
        where: { id: bookingId, tenant_id: tenantId, trainer_id: trainerId },
      });
      if (!booking) {
        throw new AppError("BOOKING_NOT_FOUND", 404, "Randevu bulunamadı");
      }

      return res.json({ data: booking });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Trainer booking getById error:", error);
      throw new AppError("TRAINER_BOOKING_GET_ERROR", 500, "Randevu getirilemedi");
    }
  }

  // --- PATCH /api/trainer/bookings/:id/status ---
  static async setStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const trainerId = req.auth?.sub;
      const bookingId = String(req.params.id ?? "");
      if (!tenantId || !trainerId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadı");
      }

      const status = req.body?.status;
      TrainerBookingsController.validateStatus(status);

      const bookingRepo = AppDataSource.getRepository(Booking);
      const booking = await bookingRepo.findOne({
        where: { id: bookingId, tenant_id: tenantId, trainer_id: trainerId },
      });
      if (!booking) {
        throw new AppError("BOOKING_NOT_FOUND", 404, "Randevu bulunamadı");
      }

      const startsAt = req.body?.starts_at
        ? parseBookingDate(req.body.starts_at, "starts_at")
        : booking.starts_at;
      const endsAt = req.body?.ends_at
        ? parseBookingDate(req.body.ends_at, "ends_at")
        : booking.ends_at;
      if (endsAt <= startsAt) {
        throw new AppError("VALIDATION_ERROR", 400, "ends_at starts_at'tan sonra olmalıdır");
      }
      validateBookingDuration(startsAt, endsAt);

      const businessHours = await TrainerBookingsController.loadBusinessHours(tenantId);
      TrainerBookingsController.ensureWithinBusinessHours(startsAt, endsAt, businessHours);
      const minimumAdvanceHours = await TrainerBookingsController.loadMinimumAdvanceHours(tenantId);

      const member = await TrainerBookingsController.ensureUser(tenantId, booking.member_id, UserRole.MEMBER);

      let sessionId = booking.session_id;
      if (req.body?.session_id !== undefined) {
        sessionId = req.body.session_id ? String(req.body.session_id) : undefined;
      }

      const incomingMeta =
        req.body?.meta && typeof req.body.meta === "object" && !Array.isArray(req.body.meta)
          ? (req.body.meta as Record<string, unknown>)
          : {};
      const mergedMeta = {
        ...((booking.meta as Record<string, unknown> | undefined) ?? {}),
        ...incomingMeta,
      };
      const now = new Date();
      const startsChanged =
        booking.starts_at.getTime() !== startsAt.getTime() || booking.ends_at.getTime() !== endsAt.getTime();
      if (startsChanged) {
        const diffMs = booking.starts_at.getTime() - now.getTime();
        const minAllowedMs = minimumAdvanceHours * 60 * 60 * 1000;
        if (diffMs < minAllowedMs) {
          throw new AppError(
            "TRAINER_RESCHEDULE_WINDOW_CLOSED",
            400,
            `Derse ${minimumAdvanceHours} saatten az kaldığı için yeniden planlama yapılamaz`
          );
        }
        ensureMinimumAdvanceHours(
          startsAt,
          minimumAdvanceHours,
          "Ders",
          "TRAINER_BOOKING_NOTICE_WINDOW_CLOSED",
          now
        );

        const history = Array.isArray(mergedMeta.reschedule_history)
          ? [...(mergedMeta.reschedule_history as Array<Record<string, unknown>>)]
          : [];
        history.push({
          changed_by: "TRAINER",
          changed_at: now.toISOString(),
          from_starts_at: booking.starts_at.toISOString(),
          from_ends_at: booking.ends_at.toISOString(),
          to_starts_at: startsAt.toISOString(),
          to_ends_at: endsAt.toISOString(),
        });
        mergedMeta.reschedule_history = history;
      }
      const packageId = String(mergedMeta.package_id ?? "").trim() || undefined;
      const previousStatus = booking.status;
      const previousStartsAt = booking.starts_at;
      const previousEndsAt = booking.ends_at;

      if (status === BookingStatus.APPROVED || status === BookingStatus.PENDING || status === BookingStatus.RESCHEDULED) {
        if (status === BookingStatus.APPROVED && booking.payment_status !== BookingPaymentStatus.APPROVED) {
          throw new AppError("PAYMENT_NOT_APPROVED", 400, "Ödeme onayı olmadan randevu onaylanamaz");
        }
        await TrainerBookingsController.ensureWithinMemberAvailability(tenantId, booking.member_id, startsAt, endsAt);
        await TrainerBookingsController.ensureMemberWeeklyLessonLimit(tenantId, member, startsAt, booking.id);
        await TrainerBookingsController.validateNoOverlap({
          tenantId,
          trainerId,
          memberId: booking.member_id,
          startsAt,
          endsAt,
          excludeBookingId: booking.id,
        });

        if (sessionId) {
          const session = await TrainerBookingsController.ensureSessionCapacity(tenantId, sessionId, booking.id);
          await TrainerBookingsController.ensureTrainerSkillForCategory(tenantId, trainerId, session.lesson_category);
          if (session.related_package_id) {
            const sessionContext = await BookingEligibilityService.ensurePackageBookingEligibility({
              tenantId,
              trainerId,
              memberId: booking.member_id,
              packageId: session.related_package_id,
            });
            mergedMeta.lesson_category = sessionContext.lessonCategory;
            mergedMeta.package_id = sessionContext.pkg.id;
            mergedMeta.package_title = sessionContext.pkg.title;
            mergedMeta.package_display_price = sessionContext.pkg.display_price ?? null;
            mergedMeta.service_name = String(sessionContext.rules.service_name ?? "").trim() || sessionContext.pkg.title;
          }
        } else if (packageId) {
          const pkgContext = await BookingEligibilityService.ensurePackageBookingEligibility({
            tenantId,
            trainerId,
            memberId: booking.member_id,
            packageId,
          });
          mergedMeta.lesson_category = pkgContext.lessonCategory;
          mergedMeta.package_title = pkgContext.pkg.title;
          mergedMeta.package_display_price = pkgContext.pkg.display_price ?? null;
          mergedMeta.service_name =
            String(pkgContext.rules.service_name ?? "").trim() || pkgContext.pkg.title;
        }
      }

      booking.starts_at = startsAt;
      booking.ends_at = endsAt;
      booking.session_id = sessionId;
      booking.meta = mergedMeta;
      booking.status = status;
      await bookingRepo.save(booking);
      await ReferralAutomationService.processForMember(tenantId, booking.member_id);
      await TrainerBookingsController.logBookingAudit(req, {
        eventType: startsChanged ? "BOOKING_RESCHEDULED" : "BOOKING_STATUS_CHANGED",
        booking,
        oldStatus: previousStatus,
        newStatus: booking.status,
        oldStartsAt: previousStartsAt,
        newStartsAt: booking.starts_at,
        oldEndsAt: previousEndsAt,
        newEndsAt: booking.ends_at,
      });

      const meta = (booking.meta as Record<string, unknown> | undefined) ?? {};
      const lessonCategory = String(meta.lesson_category ?? "").trim() || null;
      return res.json({
        data: {
          ...booking,
          package_name: packageDisplayName(meta.package_title),
          lesson_category_label: lessonCategoryLabel(lessonCategory),
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Trainer booking setStatus error:", error);
      throw new AppError("TRAINER_BOOKING_STATUS_ERROR", 500, "Randevu durumu güncellenemedi");
    }
  }

  // --- PATCH /api/trainer/bookings/:id/reschedule ---
  static async reschedule(req: AuthenticatedRequest, res: Response) {
    req.body = {
      ...(req.body && typeof req.body === "object" ? req.body : {}),
      status: req.body?.status ?? BookingStatus.RESCHEDULED,
    };
    return TrainerBookingsController.setStatus(req, res);
  }

  // --- POST /api/trainer/bookings ---
  static async createSlotOrBooking(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const trainerId = req.auth?.sub;
      if (!tenantId || !trainerId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadı");
      }

      const memberId = String(req.body?.member_id ?? "");
      const startsAt = parseBookingDate(req.body?.starts_at, "starts_at");
      const endsAt = parseBookingDate(req.body?.ends_at, "ends_at");
      const rawStatus = req.body?.status;
      const sessionId = req.body?.session_id ? String(req.body.session_id) : undefined;
      const inputMeta =
        req.body?.meta && typeof req.body.meta === "object" && !Array.isArray(req.body.meta)
          ? (req.body.meta as Record<string, unknown>)
          : {};
      const packageId = String(inputMeta.package_id ?? "").trim();

      if (!memberId) {
        throw new AppError("VALIDATION_ERROR", 400, "member_id zorunlu");
      }
      if (!packageId) {
        throw new AppError("VALIDATION_ERROR", 400, "Paket seçimi zorunludur");
      }
      if (endsAt <= startsAt) {
        throw new AppError("VALIDATION_ERROR", 400, "ends_at starts_at'tan sonra olmalıdır");
      }
      validateBookingDuration(startsAt, endsAt);
      const businessHours = await TrainerBookingsController.loadBusinessHours(tenantId);
      TrainerBookingsController.ensureWithinBusinessHours(startsAt, endsAt, businessHours);
      const minimumAdvanceHours = await TrainerBookingsController.loadMinimumAdvanceHours(tenantId);
      ensureMinimumAdvanceHours(startsAt, minimumAdvanceHours, "Ders", "TRAINER_BOOKING_NOTICE_WINDOW_CLOSED");

      await TrainerBookingsController.ensureUser(tenantId, trainerId, UserRole.TRAINER);
      const member = await TrainerBookingsController.ensureUser(tenantId, memberId, UserRole.MEMBER);

      let status = BookingStatus.PENDING;
      if (rawStatus !== undefined) {
        TrainerBookingsController.validateStatus(rawStatus);
        status = rawStatus;
      }
      const packageContext = await BookingEligibilityService.ensurePackageBookingEligibility({
        tenantId,
        trainerId,
        memberId,
        packageId,
      });

      if (
        status === BookingStatus.PENDING ||
        status === BookingStatus.RESCHEDULED ||
        status === BookingStatus.APPROVED
      ) {
        await TrainerBookingsController.ensureWithinMemberAvailability(tenantId, memberId, startsAt, endsAt);
        await TrainerBookingsController.ensureMemberWeeklyLessonLimit(tenantId, member, startsAt);
        await TrainerBookingsController.validateNoOverlap({
          tenantId,
          trainerId,
          memberId,
          startsAt,
          endsAt,
        });
      }

      if (sessionId) {
        const session = await TrainerBookingsController.ensureSessionCapacity(tenantId, sessionId);
        await TrainerBookingsController.ensureTrainerSkillForCategory(tenantId, trainerId, session.lesson_category);
        if (session.related_package_id) {
          await BookingEligibilityService.ensurePackageBookingEligibility({
            tenantId,
            trainerId,
            memberId,
            packageId: session.related_package_id,
          });
        }
      }

      const bookingMeta: Record<string, unknown> = {
        ...inputMeta,
        package_id: packageContext.pkg.id,
        package_title: packageContext.pkg.title,
        package_display_price: packageContext.pkg.display_price ?? null,
        lesson_category: packageContext.lessonCategory,
        service_name: String(packageContext.rules.service_name ?? "").trim() || packageContext.pkg.title,
      };

      const booking = AppDataSource.getRepository(Booking).create({
        tenant_id: tenantId,
        member_id: memberId,
        trainer_id: trainerId,
        session_id: sessionId,
        starts_at: startsAt,
        ends_at: endsAt,
        status,
        payment_status:
          status === BookingStatus.APPROVED ? BookingPaymentStatus.APPROVED : BookingPaymentStatus.REQUESTED,
        payment_requested_at: status === BookingStatus.APPROVED ? undefined : new Date(),
        payment_approved_at: status === BookingStatus.APPROVED ? new Date() : undefined,
        meta: bookingMeta,
      });
      await AppDataSource.getRepository(Booking).save(booking);
      await ReferralAutomationService.processForMember(tenantId, booking.member_id);
      await MobileNotificationService.queuePush({
        tenantId,
        userId: booking.member_id,
        roleScope: "MEMBER",
        type: "BOOKING_CREATED",
        title: "Dersiniz planlandı",
        body: `${startsAt.toLocaleString("tr-TR")} saatindeki dersiniz planlanmıştır.`,
        deepLink: "clinerva://member/bookings",
        meta: {
          booking_id: booking.id,
          status: booking.status,
        },
      });
      await TrainerBookingsController.logBookingAudit(req, {
        eventType: "BOOKING_CREATED",
        booking,
        newStatus: booking.status,
        newStartsAt: booking.starts_at,
        newEndsAt: booking.ends_at,
      });

      return res.status(201).json({
        data: {
          ...booking,
          package_name: packageDisplayName(bookingMeta.package_title),
          lesson_category_label: lessonCategoryLabel(bookingMeta.lesson_category),
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Trainer booking create error:", error);
      throw new AppError("TRAINER_BOOKING_CREATE_ERROR", 500, "Randevu oluşturulamadı");
    }
  }
}
