import jwt from "jsonwebtoken";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataSource } from "../data-source";
import { AdminClinicController } from "../controllers/admin/clinic.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";
import { requireRole } from "../middlewares/rbac.middleware";
import { TenantLifecycleService } from "../services/tenant-lifecycle.service";
import { AuditLogService } from "../services/audit-log.service";
import { runRouteChain } from "./helpers/route-chain";

function createToken(payload: { sub: string; tenantId: string; role: "ADMIN"; accountId?: string | null }) {
  return jwt.sign(payload, process.env.JWT_SECRET || "test-secret");
}

describe("admin clinic subscription integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env.JWT_SECRET = "test-secret";
    delete process.env.REVENUECAT_REST_API_KEY;
    delete process.env.REVENUECAT_ENTITLEMENT_ID;
  });

  it("returns subscription summary for a published inactive clinic", async () => {
    process.env.JWT_SECRET = "test-secret";
    const tenant = {
      id: "tenant-1",
      slug: "salon",
      name: "Salon",
      is_active: true,
      review_status: "PUBLISHED",
      subscription_status: "INACTIVE",
      is_public: true,
      trial_starts_at: null,
      trial_ends_at: null,
    };
    const tenantRepo = {
      findOne: vi.fn().mockResolvedValue(tenant),
    };

    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(tenantRepo as any);
    vi.spyOn(TenantLifecycleService, "syncTenantState").mockResolvedValue(tenant as any);

    const token = createToken({ sub: "admin-user", tenantId: "tenant-1", role: "ADMIN", accountId: "account-1" });
    const response = await runRouteChain(
      [
        authMiddleware as any,
        tenantMiddleware as any,
        requireRole(["ADMIN"]) as any,
        AdminClinicController.getSubscription as any,
      ],
      {
        method: "GET",
        headers: { authorization: `Bearer ${token}` },
        cookies: {},
      }
    );

    expect(response.statusCode).toBe(200);
    expect((response.body as any).data).toEqual(
      expect.objectContaining({
        tenant_id: "tenant-1",
        can_start_trial: true,
        can_purchase_in_app: false,
        purchase_provider: "REVENUECAT",
        recommended_action: "START_TRIAL",
      })
    );
  });

  it("starts a twenty-one-day trial and publishes an inactive clinic without manual review", async () => {
    process.env.JWT_SECRET = "test-secret";
    const tenant = {
      id: "tenant-1",
      slug: "salon",
      name: "Salon",
      is_active: true,
      review_status: "PENDING_REVIEW",
      subscription_status: "INACTIVE",
      is_public: false,
      trial_starts_at: null as Date | null,
      trial_ends_at: null as Date | null,
    };
    const tenantRepo = {
      findOne: vi.fn().mockResolvedValue(tenant),
      save: vi.fn().mockImplementation(async (input) => input),
    };

    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(tenantRepo as any);
    vi.spyOn(TenantLifecycleService, "syncTenantState").mockResolvedValue(tenant as any);
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined);
    const productEventSpy = vi.spyOn(AuditLogService, "logProductEvent").mockResolvedValue(true);

    const token = createToken({ sub: "admin-user", tenantId: "tenant-1", role: "ADMIN", accountId: "account-1" });
    const response = await runRouteChain(
      [
        authMiddleware as any,
        tenantMiddleware as any,
        requireRole(["ADMIN"]) as any,
        AdminClinicController.startTrial as any,
      ],
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "user-agent": "vitest" },
        cookies: {},
        ip: "127.0.0.1",
      }
    );

    expect(response.statusCode).toBe(200);
    expect(tenant.review_status).toBe("PUBLISHED");
    expect(tenant.is_public).toBe(true);
    expect(tenant.subscription_status).toBe("TRIAL");
    expect(tenant.trial_starts_at).toBeInstanceOf(Date);
    expect(tenant.trial_ends_at).toBeInstanceOf(Date);
    expect((tenant.trial_ends_at!.getTime() - tenant.trial_starts_at!.getTime()) / (24 * 60 * 60 * 1000)).toBeCloseTo(21, 4);
    expect((response.body as any).data).toEqual(
      expect.objectContaining({
        subscription_status: "TRIAL",
        can_start_trial: false,
        can_purchase_in_app: true,
        trial_days_total: 21,
      })
    );
    expect(tenantRepo.save).toHaveBeenCalledTimes(1);
    expect(productEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event_name: "trial_started", tenant_id: "tenant-1" })
    );
  });

  it("syncs a RevenueCat entitlement and moves trial clinics to active", async () => {
    process.env.REVENUECAT_REST_API_KEY = "rc-secret";
    process.env.REVENUECAT_ENTITLEMENT_ID = "clinic_pro";
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const purchasedAt = new Date(Date.now() - 60_000);
    const tenant = {
      id: "tenant-1",
      slug: "salon",
      name: "Salon",
      review_status: "PUBLISHED",
      subscription_status: "TRIAL",
      is_public: true,
      trial_starts_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      trial_ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
    const tenantRepo = {
      findOne: vi.fn().mockResolvedValue(tenant),
      save: vi.fn().mockImplementation(async (input) => input),
    };

    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(tenantRepo as any);
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          subscriber: {
            original_app_user_id: "tenant-1",
            entitlements: {
              clinic_pro: {
                product_identifier: "fizyoflow_admin_monthly",
                purchase_date: purchasedAt.toISOString(),
                expires_date: expiresAt.toISOString(),
              },
            },
            subscriptions: {
              fizyoflow_admin_monthly: {
                purchase_date: purchasedAt.toISOString(),
                expires_date: expiresAt.toISOString(),
                store: "APP_STORE",
              },
            },
          },
        }),
      })
    );

    const response = await runRouteChain(
      [AdminClinicController.syncSubscription as any],
      {
        method: "POST",
        originalUrl: "/api/admin/clinic/subscription/sync",
        tenantId: "tenant-1",
        auth: { role: "ADMIN", sub: "admin-user", accountId: "account-1" },
        headers: { "user-agent": "vitest" },
        ip: "127.0.0.1",
      }
    );

    expect(response.statusCode).toBe(200);
    expect(tenant.subscription_status).toBe("ACTIVE");
    expect(tenant.review_status).toBe("PUBLISHED");
    expect(tenant.is_public).toBe(true);
    expect(tenant.subscription_started_at).toEqual(purchasedAt);
    expect(tenant.subscription_current_period_ends_at).toEqual(expiresAt);
    expect(tenant.revenuecat_product_id).toBe("fizyoflow_admin_monthly");
    expect(tenant.revenuecat_entitlement_id).toBe("clinic_pro");
    expect(tenant.revenuecat_store).toBe("APP_STORE");
    expect(tenant.revenuecat_last_event_type).toBe("SYNC");
    expect((response.body as any).data).toEqual(
      expect.objectContaining({
        subscription_status: "ACTIVE",
        sync_state: "SYNCED",
      })
    );
    expect(tenantRepo.save).toHaveBeenCalledTimes(1);
  });

  it("keeps sync pending when RevenueCat server credentials are not configured", async () => {
    const tenant = {
      id: "tenant-1",
      slug: "salon",
      name: "Salon",
      review_status: "PUBLISHED",
      subscription_status: "READ_ONLY",
      is_public: false,
    };
    const tenantRepo = {
      findOne: vi.fn().mockResolvedValue(tenant),
      save: vi.fn(),
    };

    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(tenantRepo as any);
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined);

    const response = await runRouteChain(
      [AdminClinicController.syncSubscription as any],
      {
        method: "POST",
        originalUrl: "/api/admin/clinic/subscription/sync",
        tenantId: "tenant-1",
        auth: { role: "ADMIN", sub: "admin-user", accountId: "account-1" },
        headers: { "user-agent": "vitest" },
      }
    );

    expect(response.statusCode).toBe(202);
    expect((response.body as any).data).toEqual(
      expect.objectContaining({
        subscription_status: "READ_ONLY",
        sync_state: "PENDING_SYNC",
      })
    );
    expect(tenantRepo.save).not.toHaveBeenCalled();
  });
});
