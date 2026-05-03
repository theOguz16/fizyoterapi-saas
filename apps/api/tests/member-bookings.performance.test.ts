import { performance } from "node:perf_hooks";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemberBookingsController } from "../controllers/member/bookings.controller";
import { AppDataSource } from "../data-source";
import { BookingStatus } from "../entities/booking.entity";
import { createMockResponse } from "./helpers/route-chain";

describe("member bookings controller load behavior", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps 500 bookings with a single trainer/session lookup per relation set", async () => {
    const bookingRows = Array.from({ length: 500 }, (_, index) => ({
      id: `booking-${index + 1}`,
      tenant_id: "tenant-1",
      member_id: "member-1",
      trainer_id: `trainer-${(index % 10) + 1}`,
      session_id: `session-${(index % 20) + 1}`,
      status: index % 9 === 0 ? BookingStatus.CANCELED : BookingStatus.APPROVED,
      starts_at: new Date(`2026-04-${String((index % 28) + 1).padStart(2, "0")}T09:00:00.000Z`),
      meta: {
        package_title: `Paket ${index + 1}`,
      },
    }));

    const trainerRows = Array.from({ length: 10 }, (_, index) => ({
      id: `trainer-${index + 1}`,
      first_name: `Trainer${index + 1}`,
      last_name: "Test",
    }));

    const sessionRows = Array.from({ length: 20 }, (_, index) => ({
      id: `session-${index + 1}`,
      title: `Ders ${index + 1}`,
      type: index % 2 === 0 ? "PRIVATE" : "GROUP",
      lesson_category: index % 2 === 0 ? "PT" : "GRUP",
    }));

    const bookingRepo = {
      find: vi.fn().mockResolvedValue(bookingRows),
    };
    const trainerRepo = {
      find: vi.fn().mockResolvedValue(trainerRows),
    };
    const sessionRepo = {
      find: vi.fn().mockResolvedValue(sessionRows),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Booking")) return bookingRepo as any;
      if (name.includes("User")) return trainerRepo as any;
      if (name.includes("ClassSession")) return sessionRepo as any;
      return {} as any;
    });

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "member-1" },
      query: {},
    } as any;
    const res = createMockResponse();

    const startedAt = performance.now();
    await MemberBookingsController.list(req, res as any);
    const elapsedMs = performance.now() - startedAt;

    expect(res.statusCode).toBe(200);
    expect((res.body as any).data).toHaveLength(500);
    expect((res.body as any).data[0]).toEqual(
      expect.objectContaining({
        id: "booking-1",
        trainer_full_name: "Trainer1 Test",
        session_title: "Ders 1",
        package_name: "Paket 1",
      })
    );
    expect((res.body as any).data[499]).toEqual(
      expect.objectContaining({
        id: "booking-500",
        trainer_full_name: "Trainer10 Test",
        session_title: "Ders 20",
        package_name: "Paket 500",
      })
    );

    expect(bookingRepo.find).toHaveBeenCalledTimes(1);
    expect(trainerRepo.find).toHaveBeenCalledTimes(1);
    expect(sessionRepo.find).toHaveBeenCalledTimes(1);
    expect(elapsedMs).toBeLessThan(250);
  });
});
