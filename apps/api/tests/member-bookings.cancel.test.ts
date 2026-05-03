import { afterEach, describe, expect, it, vi } from "vitest";
import { MemberBookingsController } from "../controllers/member/bookings.controller";
import { AppDataSource } from "../data-source";
import { AppError } from "../errors/AppError";
import { BookingStatus } from "../entities/booking.entity";
import { MobileNotificationService } from "../services/mobile-notification.service";
import { createMockResponse } from "./helpers/route-chain";

describe("member booking cancel controller", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("cancels eligible booking and queues member plus trainer notifications", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T09:00:00.000Z"));

    const booking = {
      id: "booking-1",
      tenant_id: "tenant-1",
      member_id: "member-1",
      trainer_id: "trainer-9",
      starts_at: new Date("2026-03-05T15:30:00.000Z"),
      status: BookingStatus.APPROVED,
      meta: {},
    };
    const bookingRepo = {
      findOne: vi.fn().mockResolvedValue(booking),
      save: vi.fn().mockImplementation(async (input) => input),
    };
    const salonProfileRepo = {
      findOne: vi.fn().mockResolvedValue({
        id: "salon-1",
        location: {
          campaigns: {
            cancellation_policy: {
              min_hours_before_start: 3,
              refund_policy: "NO_REFUND",
            },
          },
        },
      }),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Booking")) return bookingRepo as any;
      if (name.includes("SalonProfile")) return salonProfileRepo as any;
      return {} as any;
    });
    const queuePushSpy = vi.spyOn(MobileNotificationService, "queuePush").mockResolvedValue(undefined as any);

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "member-1", role: "MEMBER" },
      params: { id: "booking-1" },
      method: "PATCH",
      originalUrl: "/api/member/bookings/booking-1/cancel",
      headers: { "user-agent": "vitest" },
      ip: "127.0.0.1",
      requestId: "req-booking-1",
    } as any;
    const res = createMockResponse();

    await MemberBookingsController.cancel(req, res as any);

    expect(res.statusCode).toBe(200);
    expect((res.body as any).message).toContain("Randevu iptal edildi");
    expect(booking.status).toBe(BookingStatus.CANCELED);
    expect((booking.meta as any).cancellation).toEqual(
      expect.objectContaining({
        canceled_by: "MEMBER",
        refund: false,
        refund_policy: "NO_REFUND",
      })
    );
    expect(bookingRepo.save).toHaveBeenCalledTimes(1);
    expect(queuePushSpy).toHaveBeenCalledTimes(2);
  });

  it("blocks cancellation when the policy window is closed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T09:00:00.000Z"));

    const bookingRepo = {
      findOne: vi.fn().mockResolvedValue({
        id: "booking-2",
        tenant_id: "tenant-1",
        member_id: "member-1",
        trainer_id: "trainer-9",
        starts_at: new Date("2026-03-05T10:30:00.000Z"),
        status: BookingStatus.APPROVED,
        meta: {},
      }),
      save: vi.fn(),
    };
    const salonProfileRepo = {
      findOne: vi.fn().mockResolvedValue({
        id: "salon-1",
        location: {
          campaigns: {
            cancellation_policy: {
              min_hours_before_start: 3,
              refund_policy: "NO_REFUND",
            },
          },
        },
      }),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Booking")) return bookingRepo as any;
      if (name.includes("SalonProfile")) return salonProfileRepo as any;
      return {} as any;
    });
    const queuePushSpy = vi.spyOn(MobileNotificationService, "queuePush").mockResolvedValue(undefined as any);

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "member-1", role: "MEMBER" },
      params: { id: "booking-2" },
      method: "PATCH",
      originalUrl: "/api/member/bookings/booking-2/cancel",
      headers: { "user-agent": "vitest" },
      ip: "127.0.0.1",
      requestId: "req-booking-2",
    } as any;
    const res = createMockResponse();

    await expect(MemberBookingsController.cancel(req, res as any)).rejects.toEqual(
      expect.objectContaining<AppError>({
        code: "BOOKING_CANCEL_WINDOW_CLOSED",
        statusCode: 400,
      })
    );
    expect(bookingRepo.save).not.toHaveBeenCalled();
    expect(queuePushSpy).not.toHaveBeenCalled();
  });
});
