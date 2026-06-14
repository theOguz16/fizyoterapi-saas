import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataSource } from "../data-source";
import { NotificationEvent } from "../entities/notification-event.entity";
import { User } from "../entities/user.entity";
import { MobileNotificationService } from "../services/mobile-notification.service";
import { TrainerBookingsController } from "../controllers/trainer/bookings.controller";

function responseMock() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn((value) => value);
  return res;
}

describe("trainer request center", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists only requests created by the active trainer", async () => {
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === NotificationEvent) return {
        find: vi.fn().mockResolvedValue([
          { id: "r1", created_at: new Date("2026-06-10"), payload: { trainer_id: "trainer-1", status: "PENDING" } },
          { id: "r2", created_at: new Date("2026-06-09"), payload: { trainer_id: "trainer-2", status: "APPROVED" } },
        ]),
      } as any;
      throw new Error("unexpected repository");
    });
    const res = responseMock();
    await TrainerBookingsController.listScheduleChangeRequests({ tenantId: "tenant-1", auth: { sub: "trainer-1" } } as any, res);
    expect(res.json).toHaveBeenCalledWith({ data: [expect.objectContaining({ id: "r1", status: "PENDING" })] });
  });

  it("sends a bulk message and reports delivered recipients", async () => {
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === User) return {
        find: vi.fn().mockResolvedValue([
          { id: "member-1", first_name: "Ada", last_name: "Yilmaz" },
          { id: "member-2", first_name: "Ece", last_name: "Kaya" },
        ]),
      } as any;
      throw new Error("unexpected repository");
    });
    vi.spyOn(MobileNotificationService, "queuePush")
      .mockResolvedValueOnce({ queued: true } as any)
      .mockResolvedValueOnce({ queued: false, reason: "NO_ACTIVE_DEVICE" } as any);
    const res = responseMock();
    await TrainerBookingsController.sendBulkNotification({
      tenantId: "tenant-1",
      auth: { sub: "trainer-1" },
      body: { member_ids: ["member-1", "member-2"], title: "Program", body: "Saatleri kontrol edin." },
    } as any, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ data: expect.objectContaining({ requested: 2, delivered: 1 }) });
  });
});
