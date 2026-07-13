import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}));
vi.mock("expo-application", () => ({ nativeApplicationVersion: "2.4.0" }));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("@/lib/mobile-api", () => ({ submitProductEventApi: vi.fn() }));
vi.mock("@/lib/http-client", () => ({ setProductAnalyticsHeaders: vi.fn() }));

import { buildProductEventPayload, isAuthenticatedProductEvent } from "@/lib/product-analytics";

describe("product analytics contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a privacy-safe event envelope with installation and session context", () => {
    const payload = buildProductEventPayload({
      eventName: "purchase_started",
      eventId: "event-1",
      installId: "install-1",
      sessionId: "session-1",
      occurredAt: new Date("2026-07-13T12:00:00.000Z"),
      metadata: { screen: "admin_subscription", billing_cycle: "monthly", omitted: undefined },
    });

    expect(payload).toEqual({
      event_name: "purchase_started",
      event_id: "event-1",
      occurred_at: "2026-07-13T12:00:00.000Z",
      install_id: "install-1",
      session_id: "session-1",
      metadata: {
        source: "mobile",
        platform: "ios",
        app_version: "2.4.0",
        screen: "admin_subscription",
        billing_cycle: "monthly",
      },
    });
  });

  it("routes only post-login interaction events through the authenticated endpoint", () => {
    expect(isAuthenticatedProductEvent("app_opened")).toBe(false);
    expect(isAuthenticatedProductEvent("clinic_signup_started")).toBe(false);
    expect(isAuthenticatedProductEvent("clinic_qr_viewed")).toBe(true);
    expect(isAuthenticatedProductEvent("member_invite_started")).toBe(true);
    expect(isAuthenticatedProductEvent("subscription_viewed")).toBe(true);
    expect(isAuthenticatedProductEvent("purchase_started")).toBe(true);
  });
});
