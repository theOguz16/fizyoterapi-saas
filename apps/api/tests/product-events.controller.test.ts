import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileProductEventsController } from "../controllers/mobile/product-events.controller";
import { PublicController } from "../controllers/public.controller";
import { AuditLogService } from "../services/audit-log.service";

function createResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe("product event controllers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts allowlisted anonymous funnel events without trusting identity fields", async () => {
    const logProductEvent = vi.spyOn(AuditLogService, "logProductEvent").mockResolvedValue(true);
    const res = createResponse();

    await PublicController.trackProductEvent(
      {
        method: "POST",
        originalUrl: "/api/public/product-events",
        body: {
          event_name: "clinic_signup_started",
          event_id: "event-1",
          install_id: "install-1",
          session_id: "session-1",
          funnel_id: "funnel-1",
          tenant_id: "spoofed-tenant",
          metadata: { screen: "welcome", source: "primary_cta", private_value: "drop-me" },
        },
        headers: { "user-agent": "vitest" },
        ip: "127.0.0.1",
      } as any,
      res as any
    );

    expect(logProductEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "clinic_signup_started",
        install_id: "install-1",
        funnel_id: "funnel-1",
        metadata: {
          source: "primary_cta",
          screen: "welcome",
          platform: null,
          app_version: null,
        },
      })
    );
    expect(logProductEvent.mock.calls[0][0]).not.toHaveProperty("tenant_id");
    expect(res.status).toHaveBeenCalledWith(202);
  });

  it("rejects backend-authoritative events on the anonymous endpoint", async () => {
    await expect(
      PublicController.trackProductEvent(
        { body: { event_name: "clinic_created" } } as any,
        createResponse() as any
      )
    ).rejects.toMatchObject({ code: "INVALID_PRODUCT_EVENT", statusCode: 422 });
  });

  it("derives authenticated event ownership from the verified session", async () => {
    const logProductEvent = vi.spyOn(AuditLogService, "logProductEvent").mockResolvedValue(true);
    const res = createResponse();

    await MobileProductEventsController.track(
      {
        method: "POST",
        originalUrl: "/api/mobile/product-events",
        auth: {
          sub: "user-1",
          linkedUserId: "linked-user-1",
          accountId: "account-1",
          tenantId: "tenant-1",
          role: "ADMIN",
        },
        body: {
          event_name: "purchase_started",
          event_id: "event-2",
          funnel_id: "funnel-2",
          tenant_id: "spoofed-tenant",
          metadata: { screen: "admin_subscription", billing_cycle: "yearly" },
        },
        headers: {},
      } as any,
      res as any
    );

    expect(logProductEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "purchase_started",
        tenant_id: "tenant-1",
        actor_user_id: "linked-user-1",
        actor_account_id: "account-1",
        funnel_id: "funnel-2",
        metadata: expect.objectContaining({ billing_cycle: "yearly" }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(202);
  });
});
