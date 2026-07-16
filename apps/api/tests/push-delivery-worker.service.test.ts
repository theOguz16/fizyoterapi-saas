import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataSource } from "../data-source";
import { DeviceToken } from "../entities/device-token.entity";
import {
  NotificationDelivery,
  NotificationDeliveryChannel,
  NotificationDeliveryStatus,
} from "../entities/notification-delivery.entity";
import {
  isPermanentExpoError,
  PushDeliveryWorkerService,
  pushRetryDelayMs,
} from "../services/push-delivery-worker.service";

function delivery(overrides: Partial<NotificationDelivery> = {}) {
  return {
    id: "delivery-1",
    tenant_id: "tenant-1",
    event_id: "event-1",
    member_id: "member-1",
    channel: NotificationDeliveryChannel.EXPO_PUSH,
    status: NotificationDeliveryStatus.QUEUED,
    device_token_id: "device-1",
    token_snapshot: "ExponentPushToken[test]",
    platform: "IOS",
    title: "Hatırlatma",
    body: "Dersiniz yaklaşıyor",
    data: { href: "/(member)/bookings" },
    attempt_count: 0,
    max_attempts: 4,
    receipt_attempt_count: 0,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as NotificationDelivery;
}

describe("PushDeliveryWorkerService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses bounded exponential retry delays and classifies provider errors", () => {
    expect([1, 2, 3, 4, 99].map(pushRetryDelayMs)).toEqual([30_000, 120_000, 600_000, 1_800_000, 1_800_000]);
    expect(isPermanentExpoError("DeviceNotRegistered")).toBe(true);
    expect(isPermanentExpoError("MessageRateExceeded")).toBe(false);
    expect(isPermanentExpoError("ExpoServerError")).toBe(false);
  });

  it("keeps an accepted ticket pending until its receipt confirms delivery", async () => {
    const row = delivery();
    const deliveryRepo = { save: vi.fn().mockImplementation(async (value) => value) };
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === NotificationDelivery) return deliveryRepo as any;
      return { update: vi.fn() } as any;
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ status: "ok", id: "ticket-1" }] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { "ticket-1": { status: "ok" } } }),
      } as Response);
    const now = new Date("2026-07-16T10:00:00.000Z");

    await PushDeliveryWorkerService.send([row], now);

    expect(row.status).toBe(NotificationDeliveryStatus.AWAITING_RECEIPT);
    expect(row.provider_ticket_id).toBe("ticket-1");
    expect(row.delivered_at).toBeUndefined();

    await PushDeliveryWorkerService.checkReceipts([row], new Date("2026-07-16T10:01:00.000Z"));

    expect(row.status).toBe(NotificationDeliveryStatus.DELIVERED);
    expect(row.delivered_at?.toISOString()).toBe("2026-07-16T10:01:00.000Z");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("deactivates a token when Expo reports DeviceNotRegistered", async () => {
    const row = delivery({
      status: NotificationDeliveryStatus.AWAITING_RECEIPT,
      provider_ticket_id: "ticket-dead",
      attempt_count: 1,
    });
    const deliveryRepo = { save: vi.fn().mockImplementation(async (value) => value) };
    const tokenRepo = { update: vi.fn().mockResolvedValue({ affected: 1 }) };
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === NotificationDelivery) return deliveryRepo as any;
      if (entity === DeviceToken) return tokenRepo as any;
      return {} as any;
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          "ticket-dead": {
            status: "error",
            message: "The device is not registered",
            details: { error: "DeviceNotRegistered" },
          },
        },
      }),
    } as Response);

    await PushDeliveryWorkerService.checkReceipts([row], new Date("2026-07-16T10:00:00.000Z"));

    expect(row.status).toBe(NotificationDeliveryStatus.FAILED);
    expect(row.error_message).toContain("DeviceNotRegistered");
    expect(tokenRepo.update).toHaveBeenCalledWith(
      { id: "device-1" },
      expect.objectContaining({ is_active: false })
    );
  });

  it("retries transport failures and stops at the configured attempt limit", async () => {
    const retrying = delivery({ attempt_count: 0, max_attempts: 2 });
    const exhausted = delivery({ id: "delivery-2", attempt_count: 1, max_attempts: 2 });
    const deliveryRepo = { save: vi.fn().mockImplementation(async (value) => value) };
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(deliveryRepo as any);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network unavailable"));
    const now = new Date("2026-07-16T10:00:00.000Z");

    await PushDeliveryWorkerService.send([retrying, exhausted], now);

    expect(retrying.status).toBe(NotificationDeliveryStatus.RETRY_SCHEDULED);
    expect(retrying.next_attempt_at?.toISOString()).toBe("2026-07-16T10:00:30.000Z");
    expect(exhausted.status).toBe(NotificationDeliveryStatus.FAILED);
    expect(exhausted.error_message).toBe("network unavailable");
  });
});
