import type { EntityManager } from "typeorm";
import { AppError } from "../errors/AppError";
import { Booking, BookingStatus } from "../entities/booking.entity";
import { ClassSession, SessionStatus } from "../entities/class-session.entity";

const BLOCKING_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.APPROVED,
  BookingStatus.RESCHEDULED,
];

type ScheduleGuardInput = {
  tenantId: string;
  trainerId: string;
  memberId: string;
  startsAt: Date;
  endsAt: Date;
  sessionId?: string | null;
  excludeBookingId?: string | null;
  status?: BookingStatus;
  now?: Date;
};

export class BookingScheduleGuardService {
  static validateRange(startsAt: Date, endsAt: Date, now = new Date()) {
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new AppError("VALIDATION_ERROR", 400, "Randevu tarihi geçerli olmalıdır");
    }
    if (endsAt <= startsAt) {
      throw new AppError("VALIDATION_ERROR", 400, "Randevu bitişi başlangıçtan sonra olmalıdır");
    }
    if (startsAt <= now) {
      throw new AppError("BOOKING_IN_PAST", 409, "Geçmiş bir saate randevu oluşturulamaz");
    }
  }

  static async lockActors(manager: EntityManager, input: Pick<ScheduleGuardInput, "tenantId" | "trainerId" | "memberId">) {
    const keys = [`member:${input.memberId}`, `trainer:${input.trainerId}`].sort();
    for (const key of keys) {
      await manager.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [
        `booking:${input.tenantId}`,
        key,
      ]);
    }
  }

  static async ensureAvailable(manager: EntityManager, input: ScheduleGuardInput) {
    BookingScheduleGuardService.validateRange(input.startsAt, input.endsAt, input.now);
    await BookingScheduleGuardService.lockActors(manager, input);

    const trainerOverlapQuery = manager
      .getRepository(Booking)
      .createQueryBuilder("booking")
      .where("booking.tenant_id = :tenantId", { tenantId: input.tenantId })
      .andWhere("booking.trainer_id = :trainerId", { trainerId: input.trainerId })
      .andWhere("booking.status IN (:...statuses)", { statuses: BLOCKING_STATUSES })
      .andWhere("booking.starts_at < :endsAt", { endsAt: input.endsAt })
      .andWhere("booking.ends_at > :startsAt", { startsAt: input.startsAt });

    if (input.excludeBookingId) {
      trainerOverlapQuery.andWhere("booking.id != :excludeBookingId", {
        excludeBookingId: input.excludeBookingId,
      });
    }
    if (input.sessionId) {
      trainerOverlapQuery.andWhere("(booking.session_id IS NULL OR booking.session_id != :sessionId)", {
        sessionId: input.sessionId,
      });
    }
    if (await trainerOverlapQuery.getOne()) {
      throw new AppError("TRAINER_OVERLAP", 409, "Eğitmenin bu saat aralığında başka bir randevusu var");
    }

    const memberOverlapQuery = manager
      .getRepository(Booking)
      .createQueryBuilder("booking")
      .where("booking.tenant_id = :tenantId", { tenantId: input.tenantId })
      .andWhere("booking.member_id = :memberId", { memberId: input.memberId })
      .andWhere("booking.status IN (:...statuses)", { statuses: BLOCKING_STATUSES })
      .andWhere("booking.starts_at < :endsAt", { endsAt: input.endsAt })
      .andWhere("booking.ends_at > :startsAt", { startsAt: input.startsAt });

    if (input.excludeBookingId) {
      memberOverlapQuery.andWhere("booking.id != :excludeBookingId", {
        excludeBookingId: input.excludeBookingId,
      });
    }
    if (await memberOverlapQuery.getOne()) {
      throw new AppError("MEMBER_OVERLAP", 409, "Danışanın bu saat aralığında başka bir randevusu var");
    }

    if (
      input.sessionId &&
      [BookingStatus.APPROVED, BookingStatus.RESCHEDULED].includes(input.status ?? BookingStatus.PENDING)
    ) {
      const session = await manager.getRepository(ClassSession).findOne({
        where: { id: input.sessionId, tenant_id: input.tenantId },
        lock: { mode: "pessimistic_write" },
      });
      if (!session) throw new AppError("SESSION_NOT_FOUND", 404, "Seans bulunamadı");
      if (session.status === SessionStatus.CANCELED) {
        throw new AppError("SESSION_CANCELED", 409, "İptal edilmiş seansa randevu eklenemez");
      }
      if (session.capacity > 0) {
        const capacityQuery = manager
          .getRepository(Booking)
          .createQueryBuilder("booking")
          .where("booking.tenant_id = :tenantId", { tenantId: input.tenantId })
          .andWhere("booking.session_id = :sessionId", { sessionId: input.sessionId })
          .andWhere("booking.status IN (:...statuses)", {
            statuses: [BookingStatus.APPROVED, BookingStatus.RESCHEDULED],
          });
        if (input.excludeBookingId) {
          capacityQuery.andWhere("booking.id != :excludeBookingId", {
            excludeBookingId: input.excludeBookingId,
          });
        }
        if ((await capacityQuery.getCount()) >= session.capacity) {
          throw new AppError("SESSION_CAPACITY_FULL", 409, "Seans kapasitesi dolu");
        }
      }
    }
  }
}
