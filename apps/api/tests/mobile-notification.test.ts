import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataSource } from "../data-source";
import { MobileNotificationService } from "../services/mobile-notification.service";

describe("MobileNotificationService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns NO_ACTIVE_DEVICE when no token exists", async () => {
    const tokenRepo = {
      find: vi.fn().mockResolvedValue([]),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("DeviceToken")) return tokenRepo as any;
      return { findOne: vi.fn().mockResolvedValue(null) } as any;
    });

    const result = await MobileNotificationService.queuePush({
      tenantId: "tenant-1",
      userId: "user-1",
      roleScope: "MEMBER",
      type: "BOOKING_CREATED",
      title: "Yeni randevu",
      body: "Yeni randevu planlandı",
    });

    expect(result).toEqual({ queued: false, reason: "NO_ACTIVE_DEVICE" });
  });

  it("creates event and delivery records when active token exists", async () => {
    const tokenRepo = {
      find: vi.fn().mockResolvedValue([
        { id: "dev-1", token: "ExponentPushToken[x]", platform: "IOS" },
      ]),
    };
    const eventRepo = {
      create: vi.fn().mockImplementation((input) => input),
      save: vi.fn().mockImplementation(async (input) => ({ id: "evt-1", ...input })),
    };
    const deliveryRepo = {
      create: vi.fn().mockImplementation((input) => input),
      save: vi.fn().mockResolvedValue([]),
    };
    const tenantRepo = {
      findOne: vi.fn().mockResolvedValue({ id: "tenant-1", slug: "demo-salon" }),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("DeviceToken")) return tokenRepo as any;
      if (name.includes("NotificationEvent")) return eventRepo as any;
      if (name.includes("NotificationDelivery")) return deliveryRepo as any;
      if (name.includes("Tenant")) return tenantRepo as any;
      return {} as any;
    });

    const result = await MobileNotificationService.queuePush({
      tenantId: "tenant-1",
      userId: "user-1",
      roleScope: "MEMBER",
      type: "BOOKING_CREATED",
      title: "Yeni randevu",
      body: "Yeni randevu planlandı",
      deepLink: "clinerva://member/bookings",
      meta: { booking_id: "book-1" },
    });

    expect(result).toEqual({ queued: true, count: 1, eventId: "evt-1" });
    expect(eventRepo.save).toHaveBeenCalledTimes(1);
    expect(deliveryRepo.save).toHaveBeenCalledTimes(1);
  });
});
