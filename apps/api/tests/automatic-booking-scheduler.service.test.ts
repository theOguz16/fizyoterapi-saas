import { afterEach, describe, expect, it, vi } from "vitest";
import { AutomaticBookingSchedulerService } from "../services/automatic-booking-scheduler.service";
import { BookingScheduleGuardService } from "../services/booking-schedule-guard.service";

function packageRow(weeklyClassHours: number) {
  return {
    id: `package-${weeklyClassHours}`,
    title: `${weeklyClassHours} ders`,
    total_credits: weeklyClassHours * 12,
    duration_days: 84,
    rules: { weekly_class_hours: weeklyClassHours },
  } as any;
}

function slots(count: number, packageId: string) {
  const distinctDayCount = Math.max(1, Math.ceil(count / 3));
  return Array.from({ length: count }, (_, index) => {
    const dayOffset = index % distinctDayCount;
    const timeIndex = Math.floor(index / distinctDayCount);
    const startsAt = new Date("2030-07-22T07:00:00.000Z");
    startsAt.setUTCDate(startsAt.getUTCDate() + dayOffset);
    startsAt.setUTCHours([7, 8, 10][timeIndex] ?? 11);
    return {
      starts_at: startsAt,
      ends_at: new Date(startsAt.getTime() + 60 * 60 * 1000),
      package_id: packageId,
      package_title: "Paket",
    };
  });
}

function manager(existingBookings: any[] = []) {
  const query = {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue(existingBookings),
  };
  const bookingRepo = {
    createQueryBuilder: vi.fn(() => query),
    create: vi.fn((input) => ({ id: `booking-${Math.random()}`, ...input })),
    save: vi.fn(async (input) => input),
  };
  return {
    bookingRepo,
    value: {
      query: vi.fn().mockResolvedValue([]),
      getRepository: vi.fn((entity: any) => {
        if ((entity?.name || "").includes("SalonProfile")) {
          return {
            findOne: vi.fn().mockResolvedValue({
              id: "profile-1",
              business_hours: {
                timezone: "Europe/Istanbul",
                working_days: [1, 2, 3, 4, 5, 6, 7],
                start_time: "09:00",
                end_time: "18:00",
                lunch_break_start: "12:00",
                lunch_break_end: "13:00",
                slot_minutes: 60,
              },
            }),
          };
        }
        return bookingRepo;
      }),
    } as any,
  };
}

describe("AutomaticBookingSchedulerService", () => {
  afterEach(() => vi.restoreAllMocks());

  it("turns three preferences into exactly one confirmed weekly lesson", async () => {
    const db = manager();
    vi.spyOn(BookingScheduleGuardService, "lockActors").mockResolvedValue(undefined);
    vi.spyOn(BookingScheduleGuardService, "ensureAvailable").mockResolvedValue(undefined);
    const pkg = packageRow(1);

    const created = await AutomaticBookingSchedulerService.schedule(db.value, {
      tenantId: "tenant-1",
      memberId: "member-1",
      trainerId: "trainer-1",
      plans: [{ package: pkg, userPackageId: "user-package-1", candidates: slots(3, pkg.id) }],
      now: new Date("2030-07-20T07:00:00.000Z"),
    });

    expect(created).toHaveLength(1);
    expect(db.bookingRepo.save).toHaveBeenCalledTimes(1);
    expect(created[0].status).toBe("APPROVED");
    expect(created[0].meta).toEqual(
      expect.objectContaining({
        source: "AUTOMATIC_PURCHASE_SCHEDULER",
        user_package_id: "user-package-1",
      })
    );
  });

  it("requires two trainer-free alternatives for each weekly lesson", async () => {
    const pkg = packageRow(1);
    const candidates = slots(3, pkg.id);
    const db = manager([
      {
        starts_at: candidates[0].starts_at,
        ends_at: candidates[0].ends_at,
      },
      {
        starts_at: candidates[1].starts_at,
        ends_at: candidates[1].ends_at,
      },
    ]);
    vi.spyOn(BookingScheduleGuardService, "lockActors").mockResolvedValue(undefined);

    await expect(
      AutomaticBookingSchedulerService.schedule(db.value, {
        tenantId: "tenant-1",
        memberId: "member-1",
        trainerId: "trainer-1",
        plans: [{ package: pkg, candidates }],
        now: new Date("2030-07-20T07:00:00.000Z"),
      })
    ).rejects.toMatchObject({
      code: "TRAINER_CONFLICT_REQUIREMENT_NOT_MET",
      statusCode: 409,
    });
    expect(db.bookingRepo.save).not.toHaveBeenCalled();
  });

  it.each([1, 2, 3, 4, 5, 6, 7])(
    "plans %i weekly lessons on exactly that many distinct clinic days",
    async (weeklyLessonCount) => {
      const db = manager();
      vi.spyOn(BookingScheduleGuardService, "lockActors").mockResolvedValue(undefined);
      vi.spyOn(BookingScheduleGuardService, "ensureAvailable").mockResolvedValue(undefined);
      const pkg = packageRow(weeklyLessonCount);

      const created = await AutomaticBookingSchedulerService.schedule(db.value, {
        tenantId: "tenant-1",
        memberId: "member-1",
        trainerId: "trainer-1",
        plans: [{
          package: pkg,
          userPackageId: "user-package-1",
          candidates: slots(weeklyLessonCount * 3, pkg.id),
        }],
        now: new Date("2030-07-20T07:00:00.000Z"),
      });

      expect(created).toHaveLength(weeklyLessonCount);
      expect(
        new Set(
          created.map((booking) =>
            new Intl.DateTimeFormat("en-CA", {
              timeZone: "Europe/Istanbul",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(booking.starts_at)
          )
        ).size
      ).toBe(weeklyLessonCount);
      expect(created.every((booking) => booking.meta?.scheduling?.weekly_lesson_count === weeklyLessonCount)).toBe(true);
    }
  );

  it("does not place multiple automatic lessons on the same day", async () => {
    const db = manager();
    vi.spyOn(BookingScheduleGuardService, "lockActors").mockResolvedValue(undefined);
    const pkg = packageRow(2);
    const sameDayCandidates = Array.from({ length: 6 }, (_, index) => {
      const startsAt = new Date("2030-07-22T06:00:00.000Z");
      startsAt.setUTCMinutes(startsAt.getUTCMinutes() + index * 60);
      return {
        starts_at: startsAt,
        ends_at: new Date(startsAt.getTime() + 60 * 60 * 1000),
        package_id: pkg.id,
        package_title: pkg.title,
      };
    });

    await expect(
      AutomaticBookingSchedulerService.schedule(db.value, {
        tenantId: "tenant-1",
        memberId: "member-1",
        trainerId: "trainer-1",
        plans: [{ package: pkg, candidates: sameDayCandidates }],
        now: new Date("2030-07-20T07:00:00.000Z"),
      })
    ).rejects.toMatchObject({
      code: "DISTINCT_WEEKLY_DAYS_REQUIRED",
      statusCode: 409,
    });
    expect(db.bookingRepo.save).not.toHaveBeenCalled();
  });

  it("rejects a combined plan above the seven distinct-day weekly limit", async () => {
    const db = manager();
    vi.spyOn(BookingScheduleGuardService, "lockActors").mockResolvedValue(undefined);
    const firstPackage = packageRow(4);
    const secondPackage = { ...packageRow(4), id: "package-other" } as any;

    await expect(
      AutomaticBookingSchedulerService.schedule(db.value, {
        tenantId: "tenant-1",
        memberId: "member-1",
        trainerId: "trainer-1",
        plans: [
          { package: firstPackage, candidates: slots(12, firstPackage.id) },
          { package: secondPackage, candidates: slots(12, secondPackage.id) },
        ],
        now: new Date("2030-07-20T07:00:00.000Z"),
      })
    ).rejects.toMatchObject({
      code: "WEEKLY_LESSON_DAY_LIMIT_EXCEEDED",
      statusCode: 422,
    });
  });
});
