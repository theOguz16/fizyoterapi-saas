import { afterEach, describe, expect, it, vi } from "vitest";
import { TrainerTodayController } from "../controllers/trainer/today.controller";
import { AppDataSource } from "../data-source";
import { BookingStatus } from "../entities/booking.entity";
import { SessionStatus } from "../entities/class-session.entity";
import { RiskService } from "../services/risk.service";
import { createMockResponse } from "./helpers/route-chain";

function createQueryBuilderMock(result: {
  many?: unknown[];
  rawMany?: unknown[];
  rawOne?: unknown;
  count?: number;
}) {
  return {
    leftJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    setParameter: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue(result.many ?? []),
    getRawMany: vi.fn().mockResolvedValue(result.rawMany ?? []),
    getRawOne: vi.fn().mockResolvedValue(result.rawOne ?? null),
    getCount: vi.fn().mockResolvedValue(result.count ?? 0),
  };
}

describe("trainer today controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aggregates bookings, risk and earnings with safe defaults", async () => {
    const todayBookings = [
      {
        id: "booking-1",
        member_id: "member-1",
        trainer_id: "trainer-1",
        session_id: "session-1",
        status: BookingStatus.APPROVED,
        starts_at: new Date("2026-04-06T09:00:00.000Z"),
      },
    ];
    const todaySessions = [
      {
        id: "session-1",
        title: "Reformer PT",
        type: "PT",
        lesson_category: "PT",
        status: SessionStatus.SCHEDULED,
      },
    ];
    const todayCheckins = [
      {
        id: "attendance-1",
        member_id: "member-1",
        trainer_id: "trainer-1",
        session_id: "session-1",
        credits_deducted: 2,
      },
    ];

    const bookingRepo = {
      createQueryBuilder: vi
        .fn()
        .mockReturnValueOnce(createQueryBuilderMock({ many: todayBookings }))
        .mockReturnValueOnce(createQueryBuilderMock({ rawMany: [{ member_id: "member-1" }] })),
    };
    const sessionRepo = {
      createQueryBuilder: vi
        .fn()
        .mockReturnValueOnce(createQueryBuilderMock({ many: todaySessions }))
        .mockReturnValueOnce(createQueryBuilderMock({ count: 3 })),
    };
    const attendanceRepo = {
      createQueryBuilder: vi
        .fn()
        .mockReturnValueOnce(createQueryBuilderMock({ many: todayCheckins }))
        .mockReturnValueOnce(createQueryBuilderMock({ rawMany: [{ member_id: "member-1" }] }))
        .mockReturnValueOnce(createQueryBuilderMock({ rawOne: { total: "150" } }))
        .mockReturnValueOnce(createQueryBuilderMock({ rawOne: { total: "640" } }))
        .mockReturnValueOnce(createQueryBuilderMock({ rawOne: { total: "2800" } }))
        .mockReturnValueOnce(createQueryBuilderMock({ rawOne: { total: "11200" } }))
        .mockReturnValueOnce(createQueryBuilderMock({ rawOne: { total: "3200" } }))
        .mockReturnValueOnce(createQueryBuilderMock({ rawOne: { total: "14" } }))
        .mockReturnValueOnce(createQueryBuilderMock({ rawOne: { total: "100" } }))
        .mockReturnValueOnce(createQueryBuilderMock({ rawOne: { total: "500" } }))
        .mockReturnValueOnce(createQueryBuilderMock({ rawOne: { total: "2200" } }))
        .mockReturnValueOnce(createQueryBuilderMock({ rawOne: { total: "9500" } }))
        .mockReturnValueOnce(createQueryBuilderMock({ rawMany: [{ bucket: "2026-04", total: "2800" }] }))
        .mockReturnValueOnce(createQueryBuilderMock({ rawMany: [{ bucket: "2026", total: "11200" }] })),
    };
    const measurementRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(createQueryBuilderMock({ rawMany: [{ member_id: "member-1" }] })),
    };
    const salonProfileRepo = {
      findOne: vi.fn().mockResolvedValue({ id: "salon-1", business_hours: null, location: null }),
    };
    const userRepo = {
      find: vi.fn().mockResolvedValue([{ id: "member-1", first_name: "Ada", last_name: "Yilmaz" }]),
    };

    vi.spyOn(RiskService, "listRiskMembers").mockResolvedValue({
      data: [{ member_id: "member-1", risk_score: 77 }],
      total: 1,
      limit: 10,
    } as any);
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Booking")) return bookingRepo as any;
      if (name.includes("ClassSession")) return sessionRepo as any;
      if (name.includes("Attendance")) return attendanceRepo as any;
      if (name.includes("Measurement")) return measurementRepo as any;
      if (name.includes("SalonProfile")) return salonProfileRepo as any;
      if (name.includes("User")) return userRepo as any;
      return {} as any;
    });

    const req = { tenantId: "tenant-1", auth: { sub: "trainer-1" } } as any;
    const res = createMockResponse();

    await TrainerTodayController.get(req, res as any);

    const payload = (res.body as any).data;

    expect(res.statusCode).toBe(200);
    expect(payload.summary).toEqual({
      booking_total: 1,
      pending_bookings: 0,
      approved_bookings: 1,
      session_total: 1,
      weekly_session_total: 3,
      member_total: 1,
      scheduled_sessions: 1,
      completed_sessions: 0,
      checkin_total: 1,
      deducted_credits_total: 2,
    });
    expect(payload.risk).toEqual({
      at_risk_count: 1,
      preview: [{ member_id: "member-1", risk_score: 77 }],
    });
    expect(payload.calendar).toEqual({
      business_hours: {
        timezone: "Europe/Istanbul",
        working_days: [1, 2, 3, 4, 5, 6, 7],
        start_time: "09:00",
        end_time: "18:00",
        lunch_break_start: "12:00",
        lunch_break_end: "13:00",
        slot_minutes: 60,
      },
      booking_policy: {
        min_hours_before_start: 3,
      },
    });
    expect(payload.bookings[0]).toEqual(
      expect.objectContaining({
        member_full_name: "Ada Yilmaz",
        session_title: "Reformer PT",
        lesson_category_label: "PT",
      })
    );
    expect(payload.earnings.day_total).toBe(150);
    expect(payload.earnings.month_commission_rate).toBe(25);
    expect(payload.earnings.monthly_series).toHaveLength(12);
    expect(payload.earnings.yearly_series).toHaveLength(5);
  });

  it("rejects today summary request when tenant or auth is missing", async () => {
    const req = {} as any;
    const res = createMockResponse();

    await expect(TrainerTodayController.get(req, res as any)).rejects.toMatchObject({
      code: "NO_TENANT_OR_AUTH",
      statusCode: 400,
    });
  });
});
