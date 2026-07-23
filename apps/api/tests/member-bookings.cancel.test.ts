import { afterEach, describe, expect, it, vi } from "vitest";
import { MemberBookingsController } from "../controllers/member/bookings.controller";
import { AppDataSource } from "../data-source";
import { AppError } from "../errors/AppError";
import { BookingCheckinStatus, BookingStatus } from "../entities/booking.entity";
import { MobileNotificationService } from "../services/mobile-notification.service";
import { AuditLogService } from "../services/audit-log.service";
import { createMockResponse } from "./helpers/route-chain";

function request(id: string, confirmLateCancellation = false) {
  return {
    tenantId: "tenant-1",
    auth: { sub: "member-1", role: "MEMBER" },
    params: { id },
    body: { confirm_late_cancellation: confirmLateCancellation },
    method: "PATCH",
    originalUrl: `/api/member/bookings/${id}/cancel`,
    headers: { "user-agent": "vitest" },
    ip: "127.0.0.1",
    requestId: `req-${id}`,
  } as any;
}

function profileRepo() {
  return {
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
}

function installRepositories(input: {
  booking: Record<string, any>;
  userPackage?: Record<string, any>;
  admins?: Array<{ id: string }>;
}) {
  const bookingRepo = {
    findOne: vi.fn().mockResolvedValue(input.booking),
    save: vi.fn().mockImplementation(async (value) => value),
  };
  const userPackageQuery = {
    setLock: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    getOne: vi.fn().mockResolvedValue(input.userPackage || null),
  };
  const userPackageRepo = {
    createQueryBuilder: vi.fn(() => userPackageQuery),
    save: vi.fn().mockImplementation(async (value) => value),
  };
  const manager = {
    getRepository: vi.fn((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Booking")) return bookingRepo;
      if (name.includes("SalonProfile")) return profileRepo();
      if (name.includes("UserPackage")) return userPackageRepo;
      return {};
    }),
  };
  vi.spyOn(AppDataSource, "transaction").mockImplementation(async (callback: any) => callback(manager));
  vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
    if ((entity?.name || "").includes("User")) {
      return { find: vi.fn().mockResolvedValue(input.admins || []) } as any;
    }
    return {} as any;
  });
  return { bookingRepo, userPackageRepo };
}

describe("member booking cancel controller", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("enriches booking detail with trainer, clinic and package names", async () => {
    const booking = {
      id: "booking-detail-1",
      tenant_id: "tenant-1",
      member_id: "member-1",
      trainer_id: "trainer-9",
      session_id: null,
      starts_at: new Date("2026-03-06T09:00:00.000Z"),
      status: BookingStatus.APPROVED,
      meta: { package_title: "PT Bireysel Ders" },
    };
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name === "Booking") return { findOne: vi.fn().mockResolvedValue(booking) } as any;
      if (name === "SalonProfile") return { findOne: vi.fn().mockResolvedValue({ id: "profile-1", location: {} }) } as any;
      if (name === "User") {
        return {
          findOne: vi.fn().mockResolvedValue({ id: "trainer-9", first_name: "Elisa", last_name: "Uyar" }),
        } as any;
      }
      if (name === "Tenant") return { findOne: vi.fn().mockResolvedValue({ id: "tenant-1", name: "Demo-Salon" }) } as any;
      throw new Error(`Unexpected repository: ${name}`);
    });
    const res = createMockResponse();

    await MemberBookingsController.getById(
      {
        tenantId: "tenant-1",
        auth: { sub: "member-1", role: "MEMBER" },
        params: { id: booking.id },
      } as any,
      res as any
    );

    expect((res.body as any).data).toEqual(
      expect.objectContaining({
        trainer_full_name: "Elisa Uyar",
        tenant_name: "Demo-Salon",
        salon_name: "Demo-Salon",
        package_title: "PT Bireysel Ders",
        package_name: "PT Bireysel Ders",
      })
    );
  });

  it("preserves credit on an early cancellation and notifies member plus trainer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T09:00:00.000Z"));
    const booking = {
      id: "booking-1",
      tenant_id: "tenant-1",
      member_id: "member-1",
      trainer_id: "trainer-9",
      starts_at: new Date("2026-03-05T15:30:00.000Z"),
      status: BookingStatus.APPROVED,
      checkin_status: BookingCheckinStatus.PENDING,
      credits_charged: 0,
      meta: {},
    };
    const { bookingRepo, userPackageRepo } = installRepositories({
      booking,
      admins: [{ id: "admin-1" }],
    });
    const queuePushSpy = vi.spyOn(MobileNotificationService, "queuePush").mockResolvedValue(undefined as any);
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined);
    const res = createMockResponse();

    await MemberBookingsController.cancel(request("booking-1"), res as any);

    expect(booking.status).toBe(BookingStatus.CANCELED);
    expect((res.body as any).cancellation).toEqual(
      expect.objectContaining({ late: false, credits_deducted: 0, credit_preserved: true })
    );
    expect((booking.meta as any).cancellation).toEqual(
      expect.objectContaining({ canceled_by: "MEMBER", late: false, credit_preserved: true })
    );
    expect(bookingRepo.save).toHaveBeenCalledTimes(1);
    expect(userPackageRepo.save).not.toHaveBeenCalled();
    expect(queuePushSpy).toHaveBeenCalledTimes(3);
    expect(queuePushSpy).toHaveBeenCalledWith(expect.objectContaining({
      userId: "trainer-9",
      roleScope: "TRAINER",
      type: "BOOKING_CANCELED_EARLY",
    }));
    expect(queuePushSpy).toHaveBeenCalledWith(expect.objectContaining({
      userId: "admin-1",
      roleScope: "ADMIN",
      type: "BOOKING_CANCELED_EARLY",
    }));
  });

  it("requires explicit confirmation before a late cancellation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T09:00:00.000Z"));
    const booking = {
      id: "booking-2",
      tenant_id: "tenant-1",
      member_id: "member-1",
      trainer_id: "trainer-9",
      starts_at: new Date("2026-03-05T10:30:00.000Z"),
      status: BookingStatus.APPROVED,
      checkin_status: BookingCheckinStatus.PENDING,
      credits_charged: 0,
      meta: { package_id: "package-1" },
    };
    installRepositories({ booking });
    vi.spyOn(MobileNotificationService, "queuePush").mockResolvedValue(undefined as any);

    await expect(
      MemberBookingsController.cancel(request("booking-2"), createMockResponse() as any)
    ).rejects.toEqual(
      expect.objectContaining<AppError>({
        code: "LATE_CANCELLATION_CONFIRMATION_REQUIRED",
        statusCode: 409,
      })
    );
  });

  it("deducts exactly one credit after confirmed late cancellation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T09:00:00.000Z"));
    const booking = {
      id: "booking-3",
      tenant_id: "tenant-1",
      member_id: "member-1",
      trainer_id: "trainer-9",
      starts_at: new Date("2026-03-05T10:30:00.000Z"),
      status: BookingStatus.APPROVED,
      checkin_status: BookingCheckinStatus.PENDING,
      credits_charged: 0,
      meta: { package_id: "package-1", user_package_id: "user-package-1" },
    };
    const userPackage = {
      id: "user-package-1",
      package_id: "package-1",
      remaining_credits: 4,
      is_active: true,
    };
    const { bookingRepo, userPackageRepo } = installRepositories({ booking, userPackage });
    vi.spyOn(MobileNotificationService, "queuePush").mockResolvedValue(undefined as any);
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined);
    const res = createMockResponse();

    await MemberBookingsController.cancel(request("booking-3", true), res as any);

    expect(userPackage.remaining_credits).toBe(3);
    expect(userPackageRepo.save).toHaveBeenCalledTimes(1);
    expect(booking.credits_charged).toBe(1);
    expect(bookingRepo.save).toHaveBeenCalledTimes(1);
    expect((res.body as any).cancellation).toEqual(
      expect.objectContaining({ late: true, credits_deducted: 1, credit_preserved: false })
    );
  });
});
