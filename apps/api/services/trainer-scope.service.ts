import { AppDataSource } from "../data-source";
import { Attendance } from "../entities/attendance.entity";
import { Availability } from "../entities/availability.entity";
import { Booking } from "../entities/booking.entity";
import { Measurement } from "../entities/measurement.entity";
import { BookingEligibilityService } from "./booking-eligibility.service";
import { MobilePurchaseSyncService } from "./mobile-purchase-sync.service";

export class TrainerScopeService {
  static async resolveTrainerMemberIds(tenantId: string, trainerId: string) {
    const [bookingRows, attendanceRows, measurementRows] = await Promise.all([
      AppDataSource.getRepository(Booking)
        .createQueryBuilder("b")
        .select("DISTINCT b.member_id", "member_id")
        .where("b.tenant_id = :tenantId", { tenantId })
        .andWhere("b.trainer_id = :trainerId", { trainerId })
        .getRawMany<{ member_id: string }>(),
      AppDataSource.getRepository(Attendance)
        .createQueryBuilder("a")
        .select("DISTINCT a.member_id", "member_id")
        .where("a.tenant_id = :tenantId", { tenantId })
        .andWhere("a.trainer_id = :trainerId", { trainerId })
        .getRawMany<{ member_id: string }>(),
      AppDataSource.getRepository(Measurement)
        .createQueryBuilder("m")
        .select("DISTINCT m.member_id", "member_id")
        .where("m.tenant_id = :tenantId", { tenantId })
        .andWhere("m.trainer_id = :trainerId", { trainerId })
        .getRawMany<{ member_id: string }>(),
    ]);

    return Array.from(
      new Set<string>([
        ...bookingRows.map((row) => row.member_id).filter(Boolean),
        ...attendanceRows.map((row) => row.member_id).filter(Boolean),
        ...measurementRows.map((row) => row.member_id).filter(Boolean),
      ])
    );
  }

  static async hasTrainerMemberScope(tenantId: string, trainerId: string, memberId: string) {
    const [bookingCount, attendanceCount, measurementCount] = await Promise.all([
      AppDataSource.getRepository(Booking).count({
        where: { tenant_id: tenantId, trainer_id: trainerId, member_id: memberId },
      }),
      AppDataSource.getRepository(Attendance).count({
        where: { tenant_id: tenantId, trainer_id: trainerId, member_id: memberId },
      }),
      AppDataSource.getRepository(Measurement).count({
        where: { tenant_id: tenantId, trainer_id: trainerId, member_id: memberId },
      }),
    ]);

    return bookingCount + attendanceCount + measurementCount > 0;
  }

  static async buildBookableMemberIds(tenantId: string, trainerId: string, memberIds: string[]) {
    if (memberIds.length === 0) return new Set<string>();

    const [scopedMemberIds, trainerPackageIds, availabilityRows] = await Promise.all([
      TrainerScopeService.resolveTrainerMemberIds(tenantId, trainerId),
      BookingEligibilityService.getActiveTrainerAssignmentPackageIds(tenantId, trainerId),
      AppDataSource.getRepository(Availability).find({
        where: memberIds.map((memberId) => ({ tenant_id: tenantId, member_id: memberId })) as any,
        select: ["id", "member_id", "note"],
      }),
    ]);

    const allowed = new Set(scopedMemberIds);
    const preferredTrainerMap = new Map<string, string>();
    for (const row of availabilityRows) {
      const parsed = MobilePurchaseSyncService.parseAvailabilityNote(row.note);
      if (parsed.preferredTrainerId && !preferredTrainerMap.has(row.member_id)) {
        preferredTrainerMap.set(row.member_id, parsed.preferredTrainerId);
      }
    }

    for (const [memberId, preferredTrainerId] of preferredTrainerMap.entries()) {
      if (preferredTrainerId === trainerId) {
        allowed.add(memberId);
      }
    }

    if (trainerPackageIds.length > 0) {
      const activePackages = await BookingEligibilityService.getActiveMemberPackageIds(tenantId, memberIds);
      const trainerPackageSet = new Set(trainerPackageIds);
      for (const memberId of memberIds) {
        const packageIds = Array.from(activePackages.get(memberId) ?? []);
        if (packageIds.some((packageId) => trainerPackageSet.has(packageId))) {
          allowed.add(memberId);
        }
      }
    }

    return allowed;
  }
}
