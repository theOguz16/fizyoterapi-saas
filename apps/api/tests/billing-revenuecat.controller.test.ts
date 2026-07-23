import { afterEach, describe, expect, it, vi } from "vitest";
import { BillingController } from "../controllers/billing.controller";
import { AppDataSource } from "../data-source";
import { AuditLogService } from "../services/audit-log.service";
import { createMockResponse } from "./helpers/route-chain";

describe("billing revenuecat webhook", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.REVENUECAT_WEBHOOK_AUTH;
    delete process.env.REVENUECAT_ENTITLEMENT_ID;
  });

  it("activates tenant on initial purchase", async () => {
    process.env.REVENUECAT_WEBHOOK_AUTH = "Bearer test-webhook";
    process.env.REVENUECAT_ENTITLEMENT_ID = "clinic_pro";
    const eventAt = Date.now();
    const purchasedAt = eventAt - 60_000;
    const expiresAt = eventAt + 30 * 24 * 60 * 60 * 1000;

    const tenant = {
      id: "tenant-1",
      subscription_status: "TRIAL",
      is_public: true,
    };
    const tenantRepo = {
      findOne: vi.fn().mockResolvedValue(tenant),
      save: vi.fn().mockImplementation(async (input) => input),
    };

    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(tenantRepo as any);
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined);

    const req = {
      method: "POST",
      originalUrl: "/api/billing/revenuecat/webhook",
      headers: {
        authorization: "Bearer test-webhook",
        "user-agent": "RevenueCat",
      },
      ip: "127.0.0.1",
      body: {
        api_version: "1.0",
        event: {
          type: "INITIAL_PURCHASE",
          app_user_id: "tenant-1",
          entitlement_ids: ["clinic_pro"],
          product_id: "fizyoflow_admin_monthly",
          period_type: "NORMAL",
          store: "APP_STORE",
          event_timestamp_ms: eventAt,
          purchased_at_ms: purchasedAt,
          expiration_at_ms: expiresAt,
          transaction_id: "tx-1",
          original_transaction_id: "otx-1",
        },
      },
    } as any;
    const res = createMockResponse();

    await BillingController.revenueCatWebhook(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(tenant.subscription_status).toBe("ACTIVE");
    expect(tenant.subscription_started_at).toEqual(new Date(purchasedAt));
    expect(tenant.subscription_current_period_ends_at).toEqual(new Date(expiresAt));
    expect(tenant.subscription_last_event_at).toEqual(new Date(eventAt));
    expect(tenant.revenuecat_product_id).toBe("fizyoflow_admin_monthly");
    expect(tenant.revenuecat_entitlement_id).toBe("clinic_pro");
    expect(tenant.revenuecat_store).toBe("APP_STORE");
    expect(tenant.revenuecat_last_event_type).toBe("INITIAL_PURCHASE");
    expect(tenantRepo.save).toHaveBeenCalledTimes(1);
  });

  it("keeps trial expiry aligned with RevenueCat trial period", async () => {
    process.env.REVENUECAT_WEBHOOK_AUTH = "Bearer test-webhook";
    process.env.REVENUECAT_ENTITLEMENT_ID = "clinic_pro";
    const eventAt = Date.now();
    const expiresAt = eventAt + 5 * 24 * 60 * 60 * 1000;

    const tenant = {
      id: "tenant-1",
      subscription_status: "TRIAL",
      is_public: true,
      trial_ends_at: new Date(eventAt - 60_000),
    };
    const tenantRepo = {
      findOne: vi.fn().mockResolvedValue(tenant),
      save: vi.fn().mockImplementation(async (input) => input),
    };

    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(tenantRepo as any);
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined);

    const req = {
      method: "POST",
      originalUrl: "/api/billing/revenuecat/webhook",
      headers: { authorization: "Bearer test-webhook" },
      ip: "127.0.0.1",
      body: {
        event: {
          type: "INITIAL_PURCHASE",
          app_user_id: "tenant-1",
          entitlement_ids: ["clinic_pro"],
          period_type: "TRIAL",
          event_timestamp_ms: eventAt,
          expiration_at_ms: expiresAt,
        },
      },
    } as any;

    await BillingController.revenueCatWebhook(req, createMockResponse() as any);

    expect(tenant.subscription_status).toBe("TRIAL");
    expect(tenant.trial_ends_at).toEqual(new Date(expiresAt));
    expect(tenant.subscription_current_period_ends_at).toEqual(new Date(expiresAt));
    expect(tenant.is_public).toBe(true);
  });

  it("moves tenant to read only on expiration", async () => {
    process.env.REVENUECAT_WEBHOOK_AUTH = "Bearer test-webhook";
    process.env.REVENUECAT_ENTITLEMENT_ID = "clinic_pro";

    const tenant = {
      id: "tenant-1",
      subscription_status: "ACTIVE",
      is_public: true,
      subscription_last_event_at: new Date(Date.now() - 60_000),
    };
    const tenantRepo = {
      findOne: vi.fn().mockResolvedValue(tenant),
      save: vi.fn().mockImplementation(async (input) => input),
    };

    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(tenantRepo as any);
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined);

    const req = {
      method: "POST",
      originalUrl: "/api/billing/revenuecat/webhook",
      headers: {
        authorization: "Bearer test-webhook",
        "user-agent": "RevenueCat",
      },
      ip: "127.0.0.1",
      body: {
        api_version: "1.0",
        event: {
          type: "EXPIRATION",
          app_user_id: "tenant-1",
          entitlement_ids: ["clinic_pro"],
          product_id: "fizyoflow_admin_monthly",
          period_type: "NORMAL",
          store: "PLAY_STORE",
          event_timestamp_ms: Date.now(),
          expiration_at_ms: Date.now() - 1_000,
        },
      },
    } as any;
    const res = createMockResponse();

    await BillingController.revenueCatWebhook(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(tenant.subscription_status).toBe("READ_ONLY");
    expect(tenant.is_public).toBe(false);
    expect(tenant.revenuecat_last_event_type).toBe("EXPIRATION");
  });

  it("extends the active period on renewal and clears a previous billing warning", async () => {
    process.env.REVENUECAT_WEBHOOK_AUTH = "Bearer test-webhook";
    process.env.REVENUECAT_ENTITLEMENT_ID = "clinic_pro";
    const eventAt = Date.now();
    const expiresAt = eventAt + 31 * 24 * 60 * 60 * 1000;
    const tenant = {
      id: "tenant-1",
      subscription_status: "ACTIVE",
      is_public: true,
      revenuecat_last_event_type: "BILLING_ISSUE",
      subscription_last_event_at: new Date(eventAt - 60_000),
    };
    const tenantRepo = {
      findOne: vi.fn().mockResolvedValue(tenant),
      save: vi.fn().mockImplementation(async (input) => input),
    };
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(tenantRepo as any);
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined);

    await BillingController.revenueCatWebhook(
      {
        method: "POST",
        originalUrl: "/api/billing/revenuecat/webhook",
        headers: { authorization: "Bearer test-webhook" },
        body: {
          event: {
            type: "RENEWAL",
            app_user_id: "tenant-1",
            entitlement_ids: ["clinic_pro"],
            event_timestamp_ms: eventAt,
            expiration_at_ms: expiresAt,
          },
        },
      } as any,
      createMockResponse() as any
    );

    expect(tenant.subscription_status).toBe("ACTIVE");
    expect(tenant.subscription_current_period_ends_at).toEqual(new Date(expiresAt));
    expect(tenant.revenuecat_last_event_type).toBe("RENEWAL");
  });

  it.each(["BILLING_ISSUE", "CANCELLATION"])(
    "records %s without revoking access before the paid period ends",
    async (eventType) => {
      process.env.REVENUECAT_WEBHOOK_AUTH = "Bearer test-webhook";
      process.env.REVENUECAT_ENTITLEMENT_ID = "clinic_pro";
      const eventAt = Date.now();
      const expiresAt = eventAt + 10 * 24 * 60 * 60 * 1000;
      const tenant = {
        id: "tenant-1",
        subscription_status: "ACTIVE",
        is_public: true,
        subscription_last_event_at: new Date(eventAt - 60_000),
      };
      const tenantRepo = {
        findOne: vi.fn().mockResolvedValue(tenant),
        save: vi.fn().mockImplementation(async (input) => input),
      };
      vi.spyOn(AppDataSource, "getRepository").mockReturnValue(tenantRepo as any);
      vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined);

      await BillingController.revenueCatWebhook(
        {
          method: "POST",
          originalUrl: "/api/billing/revenuecat/webhook",
          headers: { authorization: "Bearer test-webhook" },
          body: {
            event: {
              type: eventType,
              app_user_id: "tenant-1",
              entitlement_ids: ["clinic_pro"],
              event_timestamp_ms: eventAt,
              expiration_at_ms: expiresAt,
            },
          },
        } as any,
        createMockResponse() as any
      );

      expect(tenant.subscription_status).toBe("ACTIVE");
      expect(tenant.is_public).toBe(true);
      expect(tenant.revenuecat_last_event_type).toBe(eventType);
      expect(tenant.subscription_current_period_ends_at).toEqual(new Date(expiresAt));
    }
  );

  it("ignores stale expiration events after a newer active RevenueCat event", async () => {
    process.env.REVENUECAT_WEBHOOK_AUTH = "Bearer test-webhook";
    process.env.REVENUECAT_ENTITLEMENT_ID = "clinic_pro";
    const latestEventAt = Date.now();

    const tenant = {
      id: "tenant-1",
      subscription_status: "ACTIVE",
      is_public: true,
      subscription_last_event_at: new Date(latestEventAt),
      subscription_current_period_ends_at: new Date(latestEventAt + 30 * 24 * 60 * 60 * 1000),
    };
    const tenantRepo = {
      findOne: vi.fn().mockResolvedValue(tenant),
      save: vi.fn().mockImplementation(async (input) => input),
    };

    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(tenantRepo as any);
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined);

    const req = {
      method: "POST",
      originalUrl: "/api/billing/revenuecat/webhook",
      headers: { authorization: "Bearer test-webhook" },
      ip: "127.0.0.1",
      body: {
        event: {
          type: "EXPIRATION",
          app_user_id: "tenant-1",
          entitlement_ids: ["clinic_pro"],
          event_timestamp_ms: latestEventAt - 5_000,
          expiration_at_ms: latestEventAt - 5_000,
        },
      },
    } as any;

    await BillingController.revenueCatWebhook(req, createMockResponse() as any);

    expect(tenant.subscription_status).toBe("ACTIVE");
    expect(tenant.is_public).toBe(true);
    expect(tenantRepo.save).not.toHaveBeenCalled();
    expect(AuditLogService.log).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ stale_event: true }),
    }));
  });

  it("requires a webhook secret in production", async () => {
    process.env.NODE_ENV = "production";

    const req = {
      method: "POST",
      originalUrl: "/api/billing/revenuecat/webhook",
      headers: { authorization: "Bearer anything" },
      body: {
        event: {
          type: "INITIAL_PURCHASE",
          app_user_id: "tenant-1",
        },
      },
    } as any;
    const res = createMockResponse();

    await expect(BillingController.revenueCatWebhook(req, res as any)).rejects.toMatchObject({
      code: "REVENUECAT_WEBHOOK_AUTH_MISSING",
      statusCode: 500,
    });
  });
});
