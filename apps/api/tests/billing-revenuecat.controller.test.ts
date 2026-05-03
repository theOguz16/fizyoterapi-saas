import { afterEach, describe, expect, it, vi } from "vitest";
import { BillingController } from "../controllers/billing.controller";
import { AppDataSource } from "../data-source";
import { AuditLogService } from "../services/audit-log.service";
import { createMockResponse } from "./helpers/route-chain";

describe("billing revenuecat webhook", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.REVENUECAT_WEBHOOK_AUTH;
    delete process.env.REVENUECAT_ENTITLEMENT_ID;
  });

  it("activates tenant on initial purchase", async () => {
    process.env.REVENUECAT_WEBHOOK_AUTH = "Bearer test-webhook";
    process.env.REVENUECAT_ENTITLEMENT_ID = "clinic_pro";

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
          product_id: "clinerva_admin_monthly",
          period_type: "NORMAL",
          store: "APP_STORE",
        },
      },
    } as any;
    const res = createMockResponse();

    await BillingController.revenueCatWebhook(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(tenant.subscription_status).toBe("ACTIVE");
    expect(tenantRepo.save).toHaveBeenCalledTimes(1);
  });

  it("moves tenant to read only on expiration", async () => {
    process.env.REVENUECAT_WEBHOOK_AUTH = "Bearer test-webhook";
    process.env.REVENUECAT_ENTITLEMENT_ID = "clinic_pro";

    const tenant = {
      id: "tenant-1",
      subscription_status: "ACTIVE",
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
          type: "EXPIRATION",
          app_user_id: "tenant-1",
          entitlement_ids: ["clinic_pro"],
          product_id: "clinerva_admin_monthly",
          period_type: "NORMAL",
          store: "PLAY_STORE",
        },
      },
    } as any;
    const res = createMockResponse();

    await BillingController.revenueCatWebhook(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(tenant.subscription_status).toBe("READ_ONLY");
    expect(tenant.is_public).toBe(false);
  });
});
