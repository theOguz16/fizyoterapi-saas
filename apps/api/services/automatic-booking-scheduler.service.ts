import type { EntityManager } from "typeorm";
import { AppError } from "../errors/AppError";
import { Booking, BookingPaymentStatus, BookingStatus } from "../entities/booking.entity";
import { Package } from "../entities/package.entity";
import { SalonProfile } from "../entities/salon-profile.entity";
import { BookingScheduleGuardService } from "./booking-schedule-guard.service";
import { SlotValidationContractService } from "./slot-validation-contract.service";

type CandidateSlot = {
  starts_at: Date;
  ends_at: Date;
  package_id: string;
  package_title: string;
  lesson_name?: string | null;
};

type PackagePlan = {
  package: Package;
  userPackageId?: string | null;
  candidates: CandidateSlot[];
};

const BLOCKING_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.APPROVED,
  BookingStatus.RESCHEDULED,
];

function deriveWeeklyLessonCount(pkg: Package) {
  const rules = pkg.rules && typeof pkg.rules === "object" ? pkg.rules as Record<string, unknown> : {};
  const explicit = Number(rules.weekly_class_hours ?? rules.weekly_sessions ?? rules.sessions_per_week ?? 0);
  if (Number.isFinite(explicit) && explicit >= 1) {
    return Math.min(7, Math.max(1, Math.floor(explicit)));
  }
  const durationWeeks = Math.max(1, Number(pkg.duration_days || 0) / 7);
  return Math.min(7, Math.max(1, Math.round(Number(pkg.total_credits || 1) / durationWeeks)));
}

function overlaps(
  first: { starts_at: Date; ends_at: Date },
  second: { starts_at: Date; ends_at: Date }
) {
  return first.starts_at < second.ends_at && first.ends_at > second.starts_at;
}

function localDateKey(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function chooseDistinctDaySlots(
  candidates: CandidateSlot[],
  count: number,
  timezone: string,
  unavailableDays: Set<string>
) {
  const ordered = [...candidates].sort((first, second) => first.starts_at.getTime() - second.starts_at.getTime());
  const chosen: CandidateSlot[] = [];
  const usedDays = new Set(unavailableDays);

  for (const slot of ordered) {
    const dayKey = localDateKey(slot.starts_at, timezone);
    if (usedDays.has(dayKey)) continue;
    chosen.push(slot);
    usedDays.add(dayKey);
    if (chosen.length === count) return chosen;
  }
  return chosen;
}

export class AutomaticBookingSchedulerService {
  static async schedule(
    manager: EntityManager,
    input: {
      tenantId: string;
      memberId: string;
      trainerId: string;
      requestId?: string | null;
      plans: PackagePlan[];
      now?: Date;
    }
  ) {
    const now = input.now ?? new Date();
    if (input.requestId) {
      const existingForRequest = await manager.getRepository(Booking)
        .createQueryBuilder("booking")
        .where("booking.tenant_id = :tenantId", { tenantId: input.tenantId })
        .andWhere("booking.member_id = :memberId", { memberId: input.memberId })
        .andWhere("booking.meta ->> 'request_id' = :requestId", { requestId: input.requestId })
        .andWhere("booking.meta ->> 'source' = :source", { source: "AUTOMATIC_PURCHASE_SCHEDULER" })
        .getMany();
      if (existingForRequest.length > 0) {
        const expectedCount = input.plans.reduce((sum, plan) => sum + deriveWeeklyLessonCount(plan.package), 0);
        if (existingForRequest.length !== expectedCount) {
          throw new AppError(
            "AUTOMATIC_SCHEDULING_PARTIAL_STATE",
            409,
            "Otomatik planlama kaydı eksik kaldı; işlem güvenli şekilde tekrar tamamlanamıyor"
          );
        }
        return existingForRequest;
      }
    }
    const profile = await manager.getRepository(SalonProfile).findOne({
      where: { tenant_id: input.tenantId },
      order: { created_at: "DESC" },
      select: ["id", "business_hours"],
    });
    if (
      !profile?.business_hours ||
      typeof profile.business_hours !== "object" ||
      Array.isArray(profile.business_hours) ||
      Object.keys(profile.business_hours).length === 0
    ) {
      throw new AppError("BUSINESS_HOURS_NOT_CONFIGURED", 409, "Klinik çalışma saatleri ayarlanmadan otomatik planlama yapılamaz");
    }
    const businessHours = SlotValidationContractService.normalizeBusinessHours(profile?.business_hours);

    await BookingScheduleGuardService.lockActors(manager, {
      tenantId: input.tenantId,
      memberId: input.memberId,
      trainerId: input.trainerId,
    });

    const allCandidates = input.plans.flatMap((plan) => plan.candidates);
    if (!allCandidates.length) {
      throw new AppError("BOOKING_PREFERENCES_REQUIRED", 422, "Otomatik planlama için saat tercihleri zorunludur");
    }
    const minStart = new Date(Math.min(...allCandidates.map((slot) => slot.starts_at.getTime())));
    const maxEnd = new Date(Math.max(...allCandidates.map((slot) => slot.ends_at.getTime())));
    const existing = await manager.getRepository(Booking)
      .createQueryBuilder("booking")
      .where("booking.tenant_id = :tenantId", { tenantId: input.tenantId })
      .andWhere("(booking.trainer_id = :trainerId OR booking.member_id = :memberId)", {
        trainerId: input.trainerId,
        memberId: input.memberId,
      })
      .andWhere("booking.status IN (:...statuses)", { statuses: BLOCKING_STATUSES })
      .andWhere("booking.starts_at < :maxEnd", { maxEnd })
      .andWhere("booking.ends_at > :minStart", { minStart })
      .getMany();

    const totalWeeklyLessonCount = input.plans.reduce(
      (sum, plan) => sum + deriveWeeklyLessonCount(plan.package),
      0
    );
    if (totalWeeklyLessonCount > 7) {
      throw new AppError(
        "WEEKLY_LESSON_DAY_LIMIT_EXCEEDED",
        422,
        "Bir danışan için haftada en fazla 7 ders, her gün en fazla bir ders olacak şekilde planlanabilir"
      );
    }

    const created: Booking[] = [];
    const automaticallyScheduledDays = new Set<string>();
    for (const plan of input.plans) {
      const weeklyLessonCount = deriveWeeklyLessonCount(plan.package);
      const requiredPreferenceCount = weeklyLessonCount * 3;
      const requiredTrainerFreeCount = weeklyLessonCount * 2;
      const uniqueCandidates = Array.from(
        new Map(
          plan.candidates
            .filter((slot) => slot.starts_at > now && slot.ends_at > slot.starts_at)
            .map((slot) => [`${slot.starts_at.toISOString()}|${slot.ends_at.toISOString()}`, slot])
        ).values()
      );

      if (uniqueCandidates.length < requiredPreferenceCount) {
        throw new AppError(
          "WEEKLY_SLOT_REQUIREMENT_NOT_MET",
          422,
          `Haftada ${weeklyLessonCount} ders için en az ${requiredPreferenceCount} farklı saat tercihi gereklidir`
        );
      }

      const validCandidates = uniqueCandidates.filter((slot) => {
        const withinHours = SlotValidationContractService.isWithinBusinessHours(
          slot.starts_at,
          slot.ends_at,
          businessHours
        );
        if (!withinHours.ok) return false;
        return ![...existing, ...created].some((booking) => overlaps(slot, booking));
      });

      if (validCandidates.length < requiredTrainerFreeCount) {
        throw new AppError(
          "TRAINER_CONFLICT_REQUIREMENT_NOT_MET",
          409,
          `Haftada ${weeklyLessonCount} ders için eğitmenle çakışmayan en az ${requiredTrainerFreeCount} tercih kalmalıdır`
        );
      }

      const distinctCandidateDays = new Set(
        validCandidates.map((slot) => localDateKey(slot.starts_at, businessHours.timezone))
      );
      for (const day of automaticallyScheduledDays) distinctCandidateDays.delete(day);
      if (distinctCandidateDays.size < weeklyLessonCount) {
        throw new AppError(
          "DISTINCT_WEEKLY_DAYS_REQUIRED",
          409,
          `Haftada ${weeklyLessonCount} ders için ${weeklyLessonCount} farklı uygun gün gereklidir; aynı güne birden fazla otomatik ders atanmaz`
        );
      }

      const selected = chooseDistinctDaySlots(
        validCandidates,
        weeklyLessonCount,
        businessHours.timezone,
        automaticallyScheduledDays
      );
      if (selected.length !== weeklyLessonCount) {
        throw new AppError("AUTOMATIC_SCHEDULING_FAILED", 409, "Yeterli güvenli ders saati otomatik olarak seçilemedi");
      }

      for (const slot of selected) {
        await BookingScheduleGuardService.ensureAvailable(manager, {
          tenantId: input.tenantId,
          memberId: input.memberId,
          trainerId: input.trainerId,
          startsAt: slot.starts_at,
          endsAt: slot.ends_at,
          status: BookingStatus.APPROVED,
          now,
        });
        const booking = await manager.getRepository(Booking).save(
          manager.getRepository(Booking).create({
            tenant_id: input.tenantId,
            member_id: input.memberId,
            trainer_id: input.trainerId,
            starts_at: slot.starts_at,
            ends_at: slot.ends_at,
            status: BookingStatus.APPROVED,
            payment_status: BookingPaymentStatus.APPROVED,
            payment_requested_at: now,
            payment_approved_at: now,
            meta: {
              package_id: plan.package.id,
              package_title: slot.package_title || plan.package.title,
              selected_sub_lesson: slot.lesson_name || null,
              request_id: input.requestId || null,
              source: "AUTOMATIC_PURCHASE_SCHEDULER",
              user_package_id: plan.userPackageId || null,
              scheduling: {
                strategy: "EARLIEST_DIVERSE_MATCH",
                weekly_lesson_count: weeklyLessonCount,
                preference_count: uniqueCandidates.length,
                trainer_free_count: validCandidates.length,
                selected_automatically: true,
              },
            },
          })
        );
        created.push(booking);
        automaticallyScheduledDays.add(localDateKey(slot.starts_at, businessHours.timezone));
      }
    }
    return created;
  }
}
