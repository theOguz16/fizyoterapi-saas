// Bu controller member tarafindaki availability.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AppError } from "../../errors/AppError";
import { Availability } from "../../entities/availability.entity";
import { Booking, BookingStatus } from "../../entities/booking.entity";
import { Package } from "../../entities/package.entity";
import { SalonProfile } from "../../entities/salon-profile.entity";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { User, UserRole } from "../../entities/user.entity";
import { UserPackage } from "../../entities/user-package.entity";
import { SlotValidationContractService } from "../../services/slot-validation-contract.service";
import { AuditLogService } from "../../services/audit-log.service";
import { SalonMembership, SalonMembershipStatus, MembershipPaymentStatus } from "../../entities/salon-membership.entity";
import { SalonApplication, SalonApplicationStatus } from "../../entities/salon-application.entity";
import { MobilePurchaseSyncService } from "../../services/mobile-purchase-sync.service";

type InputSlot = {
  starts_at: Date;
  ends_at: Date;
  package_id?: string;
  note?: string;
};

const BLOCKING_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.APPROVED,
  BookingStatus.RESCHEDULED,
];

export class MemberAvailabilityController {
  private static async reconcileApprovedApplicationAvailability(tenantId: string, memberId: string) {
    const membership = await AppDataSource.getRepository(SalonMembership).findOne({
      where: {
        tenant_id: tenantId,
        user_id: memberId,
        role: UserRole.MEMBER,
        status: SalonMembershipStatus.ACTIVE,
        is_active_context: true,
      },
      order: { updated_at: "DESC" },
    });
    if (!membership?.account_id) return;

    const existingAvailabilityCount = await AppDataSource.getRepository(Availability).count({
      where: { tenant_id: tenantId, member_id: memberId },
    });
    if (existingAvailabilityCount > 0) return;

    const application = await AppDataSource.getRepository(SalonApplication).findOne({
      where: {
        tenant_id: tenantId,
        account_id: membership.account_id,
        status: SalonApplicationStatus.APPROVED,
        payment_status: MembershipPaymentStatus.VERIFIED,
      },
      order: { updated_at: "DESC" },
    });
    if (!application) return;

    const memberUser = await AppDataSource.getRepository(User).findOne({
      where: { tenant_id: tenantId, id: memberId, role: UserRole.MEMBER, is_active: true },
    });
    if (!memberUser) return;

    await MobilePurchaseSyncService.applyApprovedPurchase({
      tenantId,
      memberUser,
      application,
    });
  }

  private static async logAvailabilityAudit(
    req: AuthenticatedRequest,
    input: {
      eventType: string;
      targetId: string;
      metadata?: Record<string, unknown>;
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
      user_agent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : null,
      target_type: "availability",
      target_id: input.targetId,
      metadata: input.metadata ?? null,
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
    const start = MemberAvailabilityController.startOfIsoWeek(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  private static durationHours(startsAt: Date, endsAt: Date) {
    return (endsAt.getTime() - startsAt.getTime()) / (1000 * 60 * 60);
  }

  private static parseDate(value: unknown, field: string) {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      throw new AppError("VALIDATION_ERROR", 400, `${field} geçersiz tarih`);
    }
    return date;
  }

  private static parseSlots(body: unknown): InputSlot[] {
    const payload = (body ?? {}) as Record<string, unknown>;
    const rawSlots = Array.isArray(payload.slots) ? payload.slots : null;

    if (rawSlots && rawSlots.length > 0) {
      return rawSlots.map((row, index) => {
        const item = (row ?? {}) as Record<string, unknown>;
        const startsAt = MemberAvailabilityController.parseDate(item.starts_at, `slots[${index}].starts_at`);
        const endsAt = MemberAvailabilityController.parseDate(item.ends_at, `slots[${index}].ends_at`);
        if (endsAt <= startsAt) {
          throw new AppError("VALIDATION_ERROR", 400, `slots[${index}] bitiş saati başlangıçtan sonra olmalıdır`);
        }
        const packageId = item.package_id ? String(item.package_id).trim() : undefined;
        const note = item.note ? String(item.note).trim() : undefined;
        return {
          starts_at: startsAt,
          ends_at: endsAt,
          package_id: packageId,
          note,
        };
      });
    }

    const startsAt = MemberAvailabilityController.parseDate(payload.starts_at, "starts_at");
    const endsAt = MemberAvailabilityController.parseDate(payload.ends_at, "ends_at");
    if (endsAt <= startsAt) {
      throw new AppError("VALIDATION_ERROR", 400, "ends_at starts_at'tan sonra olmalıdır");
    }
    const packageId = payload.package_id ? String(payload.package_id).trim() : undefined;
    const note = payload.note ? String(payload.note).trim() : undefined;
    return [
      {
        starts_at: startsAt,
        ends_at: endsAt,
        package_id: packageId,
        note,
      },
    ];
  }

  private static ensureNoInternalOverlap(slots: InputSlot[]) {
    const sorted = [...slots].sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime());
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].starts_at < sorted[i - 1].ends_at) {
        throw new AppError("OVERLAP_ERROR", 400, "Seçilen slotlar birbirleriyle çakışıyor");
      }
    }
  }

  private static async loadBusinessHours(tenantId: string) {
    const profile = await AppDataSource.getRepository(SalonProfile).findOne({
      where: { tenant_id: tenantId },
      order: { created_at: "DESC" },
      select: ["id", "business_hours"],
    });
    return SlotValidationContractService.normalizeBusinessHours(profile?.business_hours);
  }

  private static async resolveTrainerId(
    tenantId: string,
    memberId: string,
    explicitTrainerId?: string
  ): Promise<string | null> {
    if (explicitTrainerId) {
      const trainer = await AppDataSource.getRepository(User).findOne({
        where: { tenant_id: tenantId, id: explicitTrainerId, role: UserRole.TRAINER, is_active: true },
        select: ["id"],
      });
      return trainer?.id ?? null;
    }

    const latestBooking = await AppDataSource.getRepository(Booking)
      .createQueryBuilder("b")
      .where("b.tenant_id = :tenantId", { tenantId })
      .andWhere("b.member_id = :memberId", { memberId })
      .andWhere("b.status IN (:...statuses)", { statuses: BLOCKING_BOOKING_STATUSES })
      .orderBy("b.starts_at", "DESC")
      .getOne();

    return latestBooking?.trainer_id ?? null;
  }

  private static async countTrainerFreeSlots(
    tenantId: string,
    trainerId: string,
    slots: InputSlot[]
  ): Promise<number> {
    if (slots.length === 0) return 0;
    const minStart = new Date(Math.min(...slots.map((slot) => slot.starts_at.getTime())));
    const maxEnd = new Date(Math.max(...slots.map((slot) => slot.ends_at.getTime())));
    const trainerBookings = await AppDataSource.getRepository(Booking)
      .createQueryBuilder("b")
      .where("b.tenant_id = :tenantId", { tenantId })
      .andWhere("b.trainer_id = :trainerId", { trainerId })
      .andWhere("b.status IN (:...statuses)", { statuses: BLOCKING_BOOKING_STATUSES })
      .andWhere("b.starts_at < :maxEnd", { maxEnd })
      .andWhere("b.ends_at > :minStart", { minStart })
      .getMany();

    let freeCount = 0;
    for (const slot of slots) {
      const hasConflict = trainerBookings.some(
        (booking) => booking.starts_at < slot.ends_at && booking.ends_at > slot.starts_at
      );
      if (!hasConflict) freeCount += 1;
    }
    return freeCount;
  }

  // --- GET /api/member/availability ---
  static async list(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const memberId = req.auth?.sub;
      if (!tenantId || !memberId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadı");
      }

      await MemberAvailabilityController.reconcileApprovedApplicationAvailability(tenantId, memberId);

      const rows = await AppDataSource.getRepository(Availability).find({
        where: { tenant_id: tenantId, member_id: memberId },
        order: { starts_at: "ASC" },
      });

      const packageIds = Array.from(new Set(rows.map((row) => row.package_id).filter(Boolean)));
      const packages = packageIds.length
        ? await AppDataSource.getRepository(Package).find({
            where: packageIds.map((id) => ({ tenant_id: tenantId, id: String(id) })),
            select: ["id", "title", "display_price"],
          })
        : [];
      const packageMap = new Map(packages.map((row) => [row.id, row]));

      return res.json({
        data: rows.map((row) => ({
          ...row,
          package_title: row.package_id ? packageMap.get(String(row.package_id))?.title ?? null : null,
          package_display_price: row.package_id ? packageMap.get(String(row.package_id))?.display_price ?? null : null,
        })),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Member availability list error:", error);
      throw new AppError("MEMBER_AVAILABILITY_LIST_ERROR", 500, "Müsaitlikler listelenemedi");
    }
  }

  // --- POST /api/member/availability ---
  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const memberId = req.auth?.sub;
      if (!tenantId || !memberId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadı");
      }

      const slots = MemberAvailabilityController.parseSlots(req.body);
      const modeRaw = String(req.body?.mode ?? "REPLACE_WEEK").trim().toUpperCase();
      const mode: "REPLACE_WEEK" | "APPEND" = modeRaw === "APPEND" ? "APPEND" : "REPLACE_WEEK";
      if (slots.length === 0) {
        throw new AppError("VALIDATION_ERROR", 400, "En az bir müsaitlik slotu seçmelisiniz");
      }
      MemberAvailabilityController.ensureNoInternalOverlap(slots);
      const businessHours = await MemberAvailabilityController.loadBusinessHours(tenantId);
      for (const slot of slots) {
        const rangeCheck = SlotValidationContractService.isWithinBusinessHours(
          slot.starts_at,
          slot.ends_at,
          businessHours
        );
        if (!rangeCheck.ok) {
          throw new AppError("VALIDATION_ERROR", 400, rangeCheck.reason || "Seçilen saat çalışma aralığı dışında");
        }
      }

      const member = await AppDataSource.getRepository(User).findOne({
        where: { tenant_id: tenantId, id: memberId, role: UserRole.MEMBER },
      });
      if (!member) {
        throw new AppError("MEMBER_NOT_FOUND", 404, "Üye bulunamadı");
      }

      const firstWeekStart = MemberAvailabilityController.startOfIsoWeek(slots[0].starts_at);
      const firstWeekEnd = MemberAvailabilityController.endOfIsoWeek(slots[0].starts_at);
      const allInSameWeek = slots.every(
        (slot) => slot.starts_at >= firstWeekStart && slot.starts_at <= firstWeekEnd
      );
      if (!allInSameWeek) {
        throw new AppError("VALIDATION_ERROR", 400, "Seçilen tüm slotlar aynı haftada olmalıdır");
      }

      const packageIds = Array.from(new Set(slots.map((slot) => slot.package_id).filter(Boolean))) as string[];
      if (packageIds.length > 0) {
        const now = new Date();
        const [packages, userPackages] = await Promise.all([
          AppDataSource.getRepository(Package).find({
            where: packageIds.map((id) => ({ tenant_id: tenantId, id, is_active: true })),
            select: ["id"],
          }),
          AppDataSource.getRepository(UserPackage)
            .createQueryBuilder("up")
            .where("up.tenant_id = :tenantId", { tenantId })
            .andWhere("up.user_id = :memberId", { memberId })
            .andWhere("up.package_id IN (:...packageIds)", { packageIds })
            .andWhere("up.is_active = true")
            .andWhere("up.remaining_credits > 0")
            .andWhere("(up.starts_at IS NULL OR up.starts_at <= :now)", { now })
            .andWhere("(up.expires_at IS NULL OR up.expires_at >= :now)", { now })
            .getMany(),
        ]);
        const packageSet = new Set(packages.map((pkg) => pkg.id));
        const missing = packageIds.find((id) => !packageSet.has(id));
        if (missing) {
          throw new AppError("PACKAGE_NOT_FOUND", 404, "Seçilen paket bulunamadı veya dondurulmuş");
        }
        const ownedPackageSet = new Set(userPackages.map((row) => row.package_id));
        const notOwned = packageIds.find((id) => !ownedPackageSet.has(id));
        if (notOwned) {
          throw new AppError("MEMBER_PACKAGE_NOT_ACTIVE", 400, "Seçilen paket için aktif hakkınız bulunmuyor");
        }
      }

      const existingRows = await AppDataSource.getRepository(Availability)
        .createQueryBuilder("a")
        .where("a.tenant_id = :tenantId", { tenantId })
        .andWhere("a.member_id = :memberId", { memberId })
        .andWhere("a.starts_at <= :weekEnd", { weekEnd: firstWeekEnd })
        .andWhere("a.ends_at >= :weekStart", { weekStart: firstWeekStart })
        .getMany();

      if (mode === "APPEND") {
        for (const slot of slots) {
          const overlap = existingRows.some(
            (row) => row.starts_at < slot.ends_at && row.ends_at > slot.starts_at
          );
          if (overlap) {
            throw new AppError("OVERLAP_ERROR", 400, "Seçilen saatlerden en az biri mevcut müsaitlik ile çakışıyor");
          }
        }
      }

      const weeklyClassHours = Math.min(7, Math.max(1, Number(member.weekly_class_hours || 1)));
      const requiredSlots = weeklyClassHours * 3;
      const requiredTrainerFreeSlots = Math.ceil(requiredSlots * (2 / 3));
      const selectedSlots = slots.length;

      if (selectedSlots < requiredSlots) {
        throw new AppError(
          "WEEKLY_SLOT_REQUIREMENT_NOT_MET",
          400,
          `${weeklyClassHours} ders hedefi için en az ${requiredSlots} ders seçmelisiniz`
        );
      }

      const explicitTrainerId = req.body?.trainer_id ? String(req.body.trainer_id).trim() : undefined;
      const trainerId = await MemberAvailabilityController.resolveTrainerId(tenantId, memberId, explicitTrainerId);
      const trainerFreeSlots = trainerId
        ? await MemberAvailabilityController.countTrainerFreeSlots(tenantId, trainerId, slots)
        : selectedSlots;

      if (trainerId && trainerFreeSlots < requiredTrainerFreeSlots) {
        throw new AppError(
          "TRAINER_CONFLICT_REQUIREMENT_NOT_MET",
          400,
          `${selectedSlots} ders seçiminizde en az ${requiredTrainerFreeSlots} ders eğitmenle çakışmamalı`
        );
      }

      const saved = await AppDataSource.transaction(async (manager) => {
        const repo = manager.getRepository(Availability);
        if (mode === "REPLACE_WEEK") {
          await repo
            .createQueryBuilder()
            .delete()
            .where("tenant_id = :tenantId", { tenantId })
            .andWhere("member_id = :memberId", { memberId })
            .andWhere("starts_at <= :weekEnd", { weekEnd: firstWeekEnd })
            .andWhere("ends_at >= :weekStart", { weekStart: firstWeekStart })
            .execute();
        }

        const entities = slots.map((slot) =>
          repo.create({
            tenant_id: tenantId,
            member_id: memberId,
            starts_at: slot.starts_at,
            ends_at: slot.ends_at,
            package_id: slot.package_id,
            note: slot.note,
          })
        );
        return repo.save(entities);
      });
      await MemberAvailabilityController.logAvailabilityAudit(req, {
        eventType: "MEMBER_AVAILABILITY_SAVED",
        targetId: saved[0]?.id || memberId,
        metadata: {
          member_id: memberId,
          slot_count: saved.length,
          mode,
          trainer_id: trainerId,
        },
      });

      return res.status(201).json({
        data: {
          items: saved,
          weekly_plan: {
          weekly_class_hours: weeklyClassHours,
          selected_slots: selectedSlots,
          trainer_free_slots: trainerFreeSlots,
          required_slots: requiredSlots,
          required_trainer_free_slots: requiredTrainerFreeSlots,
          is_valid: true,
          mode: mode === "REPLACE_WEEK" ? "REPLACE_WEEK" : "APPEND",
          message:
            mode === "REPLACE_WEEK"
              ? "Haftalık müsaitlik planı güncellendi"
              : "Haftalık müsaitlik planına yeni saatler eklendi",
          },
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Member availability create error:", error);
      throw new AppError("MEMBER_AVAILABILITY_CREATE_ERROR", 500, "Müsaitlik oluşturulamadı");
    }
  }

  // --- DELETE /api/member/availability/:id ---
  static async remove(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const memberId = req.auth?.sub;
      const availabilityId = String(req.params.id ?? "");
      if (!tenantId || !memberId) {
        throw new AppError("NO_TENANT_OR_AUTH", 400, "Tenant veya auth bilgisi bulunamadı");
      }
      if (!availabilityId) {
        throw new AppError("VALIDATION_ERROR", 400, "id zorunlu");
      }

      const repo = AppDataSource.getRepository(Availability);
      const availability = await repo.findOne({
        where: { id: availabilityId, tenant_id: tenantId, member_id: memberId },
      });
      if (!availability) {
        throw new AppError("AVAILABILITY_NOT_FOUND", 404, "Müsaitlik bulunamadı");
      }

      await repo.remove(availability);
      await MemberAvailabilityController.logAvailabilityAudit(req, {
        eventType: "MEMBER_AVAILABILITY_DELETED",
        targetId: availability.id,
        metadata: {
          member_id: memberId,
          starts_at: availability.starts_at.toISOString(),
          ends_at: availability.ends_at.toISOString(),
        },
      });
      return res.json({ message: "Müsaitlik silindi" });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Member availability remove error:", error);
      throw new AppError("MEMBER_AVAILABILITY_REMOVE_ERROR", 500, "Müsaitlik silinemedi");
    }
  }
}
