import { performance } from "node:perf_hooks";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemberHomeController } from "../controllers/member/home.controller";
import { AppDataSource } from "../data-source";
import { AttendanceResult } from "../entities/attendance.entity";
import { BookingStatus } from "../entities/booking.entity";
import { ReferralStatus } from "../entities/referral.entity";
import { UserRole } from "../entities/user.entity";
import { MemberCreditWalletService } from "../services/member-credit-wallet.service";
import { createMockResponse } from "./helpers/route-chain";

function createQueryBuilderMock(result: {
  many?: unknown[];
  rawMany?: unknown[];
  rawOne?: unknown;
  count?: number;
}) {
  return {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    setParameter: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue(result.many ?? []),
    getRawMany: vi.fn().mockResolvedValue(result.rawMany ?? []),
    getRawOne: vi.fn().mockResolvedValue(result.rawOne ?? null),
    getCount: vi.fn().mockResolvedValue(result.count ?? 0),
  };
}

describe("member home controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aggregates member home payload with batched lookups and stable timing", async () => {
    const activePackagesQuery = createQueryBuilderMock({
      many: Array.from({ length: 6 }, (_, index) => ({
        id: `up-${index + 1}`,
        remaining_credits: 2,
        expires_at: new Date(`2026-04-${String(index + 10).padStart(2, "0")}T09:00:00.000Z`),
      })),
    });
    const upcomingBookingsQuery = createQueryBuilderMock({
      many: Array.from({ length: 5 }, (_, index) => ({
        id: `booking-${index + 1}`,
        trainer_id: `trainer-${(index % 2) + 1}`,
        session_id: `session-${(index % 3) + 1}`,
        starts_at: new Date(`2026-04-${String(index + 10).padStart(2, "0")}T09:00:00.000Z`),
        status: BookingStatus.APPROVED,
        meta: {
          package_title: `Paket ${index + 1}`,
          remaining_credits: 10 - index,
        },
      })),
    });
    const recentAttendanceQuery = createQueryBuilderMock({
      many: Array.from({ length: 5 }, (_, index) => ({
        id: `attendance-${index + 1}`,
        trainer_id: `trainer-${(index % 2) + 1}`,
        session_id: `session-${(index % 3) + 1}`,
        result: AttendanceResult.CREDIT_DEDUCTED,
      })),
    });
    const referralQuery = createQueryBuilderMock({
      rawMany: [
        { status: ReferralStatus.INVITED, count: "2" },
        { status: ReferralStatus.CONVERTED, count: "1" },
        { status: ReferralStatus.REWARDED, count: "3" },
      ],
    });
    const attendanceUsageQuery = createQueryBuilderMock({
      rawOne: { attended_total: "11", group_attended_total: "4" },
    });
    const attendedThisWeekQuery = createQueryBuilderMock({
      count: 3,
    });

    const userRepo = {
      findOne: vi.fn().mockResolvedValue({
        id: "member-1",
        first_name: "Ada",
        last_name: "Yilmaz",
        email: "ada@example.com",
        phone: "5550001122",
        is_active: true,
        weekly_class_hours: 4,
        role: UserRole.MEMBER,
      }),
      find: vi.fn().mockResolvedValue([
        { id: "trainer-1", first_name: "Deniz", last_name: "Akin" },
        { id: "trainer-2", first_name: "Ece", last_name: "Kara" },
      ]),
    };
    const userPackageRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(activePackagesQuery),
    };
    const bookingRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(upcomingBookingsQuery),
    };
    const attendanceRepo = {
      createQueryBuilder: vi
        .fn()
        .mockReturnValueOnce(recentAttendanceQuery)
        .mockReturnValueOnce(attendanceUsageQuery)
        .mockReturnValueOnce(attendedThisWeekQuery),
    };
    const measurementRepo = {
      find: vi.fn().mockResolvedValue([
        { id: "measurement-1", weight_kg: 68.2 },
        { id: "measurement-2", weight_kg: 69.1 },
      ]),
    };
    const referralRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(referralQuery),
    };
    const salonProfileRepo = {
      findOne: vi.fn().mockResolvedValue({
        id: "salon-1",
        business_hours: {
          timezone: "Europe/Istanbul",
          working_days: [1, 2, 3, 4, 5, 6],
          start_time: "08:00",
          end_time: "20:00",
          lunch_break_start: "12:30",
          lunch_break_end: "13:30",
          slot_minutes: 60,
        },
        location: {
          campaigns: {
            referral_campaigns: [{ id: "r1", is_active: true }, { id: "r2", is_active: false }],
            loyalty_campaigns: [{ id: "l1", is_active: true }, { id: "l2" }],
            cancellation_policy: {
              min_hours_before_start: 6,
              refund_policy: "NO_REFUND",
            },
          },
        },
      }),
    };
    const classSessionRepo = {
      find: vi.fn().mockResolvedValue([
        { id: "session-1", title: "PT 1", type: "PT", lesson_category: "PT" },
        { id: "session-2", title: "Grup 1", type: "GROUP", lesson_category: "GRUP" },
        { id: "session-3", title: "PT 2", type: "PT", lesson_category: "PT" },
      ]),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("UserPackage")) return userPackageRepo as any;
      if (name.includes("Booking")) return bookingRepo as any;
      if (name.includes("Attendance")) return attendanceRepo as any;
      if (name.includes("Measurement")) return measurementRepo as any;
      if (name.includes("Referral")) return referralRepo as any;
      if (name.includes("SalonProfile")) return salonProfileRepo as any;
      if (name.includes("ClassSession")) return classSessionRepo as any;
      if (name.includes("User")) return userRepo as any;
      return {} as any;
    });
    vi.spyOn(MemberCreditWalletService, "getCredits").mockResolvedValue(7);

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "member-1" },
    } as any;
    const res = createMockResponse();

    const startedAt = performance.now();
    await MemberHomeController.get(req, res as any);
    const elapsedMs = performance.now() - startedAt;
    const payload = (res.body as any).data;

    expect(res.statusCode).toBe(200);
    expect(payload.member).toEqual(
      expect.objectContaining({
        id: "member-1",
        full_name: "Ada Yilmaz",
        weekly_class_hours: 4,
      })
    );
    expect(payload.packages).toEqual(
      expect.objectContaining({
        active_package_count: 6,
        total_remaining_credits: 12,
      })
    );
    expect(payload.lesson_usage).toEqual(
      expect.objectContaining({
        weekly_target: 4,
        attended_this_week: 3,
        attended_total: 11,
        group_attended_total: 4,
        remaining_total_credits: 12,
      })
    );
    expect(payload.referrals).toEqual({
      invited: 2,
      converted: 1,
      rewarded: 3,
      canceled: 0,
      total: 6,
    });
    expect(payload.referral_wallet.group_class_credits).toBe(7);
    expect(payload.campaigns).toEqual({
      active_referral_campaigns: 1,
      active_loyalty_campaigns: 1,
      cancellation_policy: {
        min_hours_before_start: 6,
        refund_policy: "NO_REFUND",
      },
    });
    expect(payload.upcoming_bookings).toHaveLength(5);
    expect(payload.upcoming_bookings[0]).toEqual(
      expect.objectContaining({
        trainer_full_name: "Deniz Akin",
        session_title: "PT 1",
        package_name: "Paket 1",
      })
    );

    expect(upcomingBookingsQuery.limit).toHaveBeenCalledWith(5);
    expect(userRepo.find).toHaveBeenCalledTimes(1);
    expect(classSessionRepo.find).toHaveBeenCalledTimes(1);
    expect(elapsedMs).toBeLessThan(300);
  });
});
