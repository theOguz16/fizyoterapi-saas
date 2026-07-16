import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ storage: new Map<string, string>(), authToken: "token" as string | null }));
const submitProductEventApi = vi.hoisted(() => vi.fn());

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => state.storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { state.storage.set(key, value); }),
  },
}));
vi.mock("expo-application", () => ({ nativeApplicationVersion: "2.4.0" }));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("@/lib/mobile-api", () => ({ submitProductEventApi }));
vi.mock("@/lib/http-client", () => ({
  setProductAnalyticsHeaders: vi.fn(),
  getAuthToken: vi.fn(() => state.authToken),
}));

import {
  buildProductEventPayload,
  flushProductEventQueue,
  isAuthenticatedProductEvent,
  trackProductEvent,
} from "@/lib/product-analytics";

const QUEUE_KEY = "fizyoflow.product-analytics.queue.v2";

describe("product analytics contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.storage.clear();
    state.authToken = "token";
  });

  it("builds a privacy-safe event envelope with funnel context", () => {
    const payload = buildProductEventPayload({
      eventName: "purchase_started",
      eventId: "event-1",
      installId: "install-1",
      sessionId: "session-1",
      funnelId: "funnel-1",
      occurredAt: new Date("2026-07-13T12:00:00.000Z"),
      metadata: { screen: "admin_subscription", billing_cycle: "monthly", omitted: undefined },
    });

    expect(payload).toEqual({
      event_name: "purchase_started",
      event_id: "event-1",
      occurred_at: "2026-07-13T12:00:00.000Z",
      install_id: "install-1",
      session_id: "session-1",
      funnel_id: "funnel-1",
      metadata: {
        source: "mobile",
        platform: "ios",
        app_version: "2.4.0",
        screen: "admin_subscription",
        billing_cycle: "monthly",
      },
    });
  });

  it("uses authenticated delivery only for client-owned post-login events", () => {
    expect(isAuthenticatedProductEvent("app_opened")).toBe(false);
    expect(isAuthenticatedProductEvent("clinic_signup_started")).toBe(false);
    expect(isAuthenticatedProductEvent("clinic_created")).toBe(false);
    expect(isAuthenticatedProductEvent("clinic_qr_viewed")).toBe(true);
    expect(isAuthenticatedProductEvent("purchase_started")).toBe(true);
  });

  it("keeps a failed event offline and retries with the same event id", async () => {
    submitProductEventApi.mockRejectedValueOnce(new Error("offline"));
    await trackProductEvent("purchase_started", { screen: "subscription" });
    await flushProductEventQueue();

    const queued = JSON.parse(state.storage.get(QUEUE_KEY) || "[]");
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ authenticated: true, attempt_count: 1 });
    const eventId = queued[0].payload.event_id;

    queued[0].next_attempt_at = new Date(0).toISOString();
    state.storage.set(QUEUE_KEY, JSON.stringify(queued));
    submitProductEventApi.mockResolvedValueOnce({ accepted: true });
    await flushProductEventQueue();

    expect(JSON.parse(state.storage.get(QUEUE_KEY) || "[]")).toEqual([]);
    expect(submitProductEventApi.mock.calls[1][0].event_id).toBe(eventId);
  });

  it("preserves authenticated events until a session token is available", async () => {
    state.authToken = null;
    await trackProductEvent("clinic_qr_viewed", { screen: "clinic_qr" });
    await flushProductEventQueue();
    expect(submitProductEventApi).not.toHaveBeenCalled();
    expect(JSON.parse(state.storage.get(QUEUE_KEY) || "[]")).toHaveLength(1);

    state.authToken = "token";
    await flushProductEventQueue();
    expect(submitProductEventApi).toHaveBeenCalledOnce();
    expect(JSON.parse(state.storage.get(QUEUE_KEY) || "[]")).toEqual([]);
  });
});
