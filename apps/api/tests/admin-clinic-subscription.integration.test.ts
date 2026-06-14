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
    process.env.JWT_SECRET = "test-secret";
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

  it("starts a five-day trial and publishes an inactive clinic without manual review", async () => {
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
    expect((response.body as any).data).toEqual(
      expect.objectContaining({
        subscription_status: "TRIAL",
        can_start_trial: false,
        can_purchase_in_app: true,
        trial_days_total: 5,
      })
    );
    expect(tenantRepo.save).toHaveBeenCalledTimes(1);
  });
});
