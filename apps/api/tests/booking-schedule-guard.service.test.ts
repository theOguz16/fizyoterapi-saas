import { describe, expect, it, vi } from "vitest";
import { BookingScheduleGuardService } from "../services/booking-schedule-guard.service";
import { BookingStatus } from "../entities/booking.entity";

function queryBuilder(result: { one?: unknown; count?: number }) {
  return {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getOne: vi.fn().mockResolvedValue(result.one ?? null),
    getCount: vi.fn().mockResolvedValue(result.count ?? 0),
  };
}

function manager(input?: {
  trainerOverlap?: unknown;
  memberOverlap?: unknown;
  session?: { id: string; capacity: number; status: string } | null;
  capacityCount?: number;
}) {
  const bookingQueries = [
    queryBuilder({ one: input?.trainerOverlap }),
    queryBuilder({ one: input?.memberOverlap }),
    queryBuilder({ count: input?.capacityCount }),
  ];
  let bookingQueryIndex = 0;
  return {
    query: vi.fn().mockResolvedValue([]),
    getRepository: vi.fn((entity: any) => {
      if (entity?.name === "ClassSession") {
        return { findOne: vi.fn().mockResolvedValue(input?.session ?? null) };
      }
      return {
        createQueryBuilder: vi.fn(() => bookingQueries[bookingQueryIndex++]),
      };
    }),
  } as any;
}

const future = {
  tenantId: "tenant-1",
  trainerId: "trainer-1",
  memberId: "member-1",
  startsAt: new Date("2030-07-25T10:00:00.000Z"),
  endsAt: new Date("2030-07-25T11:00:00.000Z"),
  now: new Date("2030-07-24T10:00:00.000Z"),
};

describe("BookingScheduleGuardService", () => {
  it("rejects past appointments before touching the database", async () => {
    const db = manager();
    await expect(
      BookingScheduleGuardService.ensureAvailable(db, {
        ...future,
        startsAt: new Date("2030-07-23T10:00:00.000Z"),
        endsAt: new Date("2030-07-23T11:00:00.000Z"),
      })
    ).rejects.toMatchObject({ code: "BOOKING_IN_PAST", statusCode: 409 });
    expect(db.query).not.toHaveBeenCalled();
  });

  it("rejects trainer and member overlaps", async () => {
    await expect(
      BookingScheduleGuardService.ensureAvailable(manager({ trainerOverlap: { id: "booking-1" } }), future)
    ).rejects.toMatchObject({ code: "TRAINER_OVERLAP", statusCode: 409 });

    await expect(
      BookingScheduleGuardService.ensureAvailable(manager({ memberOverlap: { id: "booking-2" } }), future)
    ).rejects.toMatchObject({ code: "MEMBER_OVERLAP", statusCode: 409 });
  });

  it("locks the session and rejects approved bookings beyond capacity", async () => {
    await expect(
      BookingScheduleGuardService.ensureAvailable(
        manager({
          session: { id: "session-1", capacity: 1, status: "SCHEDULED" },
          capacityCount: 1,
        }),
        {
          ...future,
          sessionId: "session-1",
          status: BookingStatus.APPROVED,
        }
      )
    ).rejects.toMatchObject({ code: "SESSION_CAPACITY_FULL", statusCode: 409 });
  });
});
