import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataSource } from "../data-source";
import { isWithinQuietHours, MobileNotificationService, resolveCanonicalPushHref } from "../services/mobile-notification.service";

describe("MobileNotificationService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects overnight quiet hours in the tenant timezone", () => {
    expect(
      isWithinQuietHours(
        { enabled: true, start: "22:00", end: "08:00" },
        new Date("2026-06-14T20:30:00.000Z"),
        "Europe/Istanbul"
      )
    ).toBe(true);
    expect(
      isWithinQuietHours(
        { enabled: true, start: "22:00", end: "08:00" },
        new Date("2026-06-14T09:00:00.000Z"),
        "Europe/Istanbul"
      )
    ).toBe(false);
  });

  it.each([
    ["package", "MEMBER", "/(member)/package"],
    ["referral", "MEMBER", "/(member)/referrals"],
    ["approval", "ADMIN", "/(admin)/approvals"],
    ["member booking", "MEMBER", "/(member)/bookings"],
    ["trainer booking", "TRAINER", "/(trainer)/bookings"],
    ["check-in", "MEMBER", "/(member)/attendance"],
    ["campaign", "MEMBER", "/(member)/campaigns"],
    ["trial", "ADMIN", "/(admin)/subscription"],
  ] as const)("accepts the canonical %s target", (_category, role, href) => {
    expect(resolveCanonicalPushHref(role, href)).toBe(href);
  });

  it("allows only the member invite auth route outside a role group", () => {
    expect(resolveCanonicalPushHref("MEMBER", "/(auth)/invite-accept?token=safe-token")).toBe(
      "/(auth)/invite-accept?token=safe-token"
    );
    expect(() => resolveCanonicalPushHref("ADMIN", "/(member)/package")).toThrow("PUSH_DEEP_LINK_ROLE_MISMATCH");
    expect(() => resolveCanonicalPushHref("MEMBER", "fizyoflow://member/package")).toThrow("INVALID_PUSH_DEEP_LINK");
    expect(() => resolveCanonicalPushHref("MEMBER", "/(member)/../admin")).toThrow("INVALID_PUSH_DEEP_LINK");
    expect(() => resolveCanonicalPushHref("MEMBER", "/(member)/unknown-screen")).toThrow("PUSH_DEEP_LINK_ROLE_MISMATCH");
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
      deepLink: "/(member)/bookings",
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
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: "ok" }] }),
    } as Response);

    const result = await MobileNotificationService.queuePush({
      tenantId: "tenant-1",
      userId: "user-1",
      roleScope: "MEMBER",
      type: "BOOKING_CREATED",
      title: "Yeni randevu",
      body: "Yeni randevu planlandı",
      deepLink: "/(member)/bookings",
      meta: { booking_id: "book-1" },
    });

    expect(result).toEqual({ queued: true, count: 1, failedCount: 0, eventId: "evt-1" });
    expect(eventRepo.save).toHaveBeenCalledTimes(2);
    expect(deliveryRepo.save).toHaveBeenCalledTimes(1);
    expect(eventRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ deep_link: "/(member)/bookings", role_scope: "MEMBER" }),
    }));
    const messages = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body || "[]"));
    expect(messages[0]?.data).toEqual(expect.objectContaining({
      href: "/(member)/bookings",
      role: "MEMBER",
      type: "BOOKING_CREATED",
    }));
  });
});
