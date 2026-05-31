import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthController } from "../controllers/auth.controller";
import { AppDataSource } from "../data-source";
import { activeAccountMiddleware } from "../middlewares/active-account.middleware";
import { internalAdminMiddleware } from "../middlewares/internal-admin.middleware";
import { requireRole } from "../middlewares/rbac.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";
import { TenantLifecycleService } from "../services/tenant-lifecycle.service";

describe("security middlewares", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalFizyoFlowSecret = process.env.FIZYOFLOW_ADMIN_SECRET;

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.FIZYOFLOW_ADMIN_SECRET = originalFizyoFlowSecret;
  });

  function createResponse() {
    return {
      statusCode: 200,
      body: null as any,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        this.body = payload;
        return this;
      },
    };
  }

  it("rejects forbidden roles", () => {
    const middleware = requireRole(["ADMIN"]);
    const req = { auth: { role: "TRAINER" } } as any;
    const res = createResponse();
    const next = vi.fn();

    middleware(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("allows GET requests for read-only tenants", async () => {
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Tenant")) {
        return { findOne: vi.fn().mockResolvedValue({ id: "tenant-1" }) } as any;
      }
      if (name.includes("User")) {
        return { findOne: vi.fn().mockResolvedValue({ id: "admin-1", is_active: true }) } as any;
      }
      return {} as any;
    });
    vi.spyOn(TenantLifecycleService, "syncTenantState").mockResolvedValue({
      id: "tenant-1",
      is_active: true,
      subscription_status: "READ_ONLY",
    } as any);

    const req = {
      method: "GET",
      auth: { sub: "admin-1", tenantId: "tenant-1", role: "ADMIN" },
    } as any;
    const res = createResponse();
    const next = vi.fn();

    await tenantMiddleware(req, res as any, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.tenantId).toBe("tenant-1");
  });

  it("rejects inactive tenants", async () => {
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue({
      findOne: vi.fn().mockResolvedValue({ id: "tenant-1" }),
    } as any);
    vi.spyOn(TenantLifecycleService, "syncTenantState").mockResolvedValue({
      id: "tenant-1",
      is_active: false,
      subscription_status: "ACTIVE",
    } as any);

    const req = {
      method: "POST",
      auth: { tenantId: "tenant-1", role: "ADMIN" },
    } as any;
    const res = createResponse();
    const next = vi.fn();

    await tenantMiddleware(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe("TENANT_INACTIVE");
  });

  it("rejects tenantless account routes when account is inactive", async () => {
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if ((entity?.name || "").includes("Account")) {
        return { findOne: vi.fn().mockResolvedValue({ id: "account-1", is_active: false }) } as any;
      }
      return { findOne: vi.fn() } as any;
    });

    const req = {
      method: "POST",
      auth: { sub: "account-1", accountId: "account-1", role: "MEMBER", loginScope: "ACCOUNT" },
    } as any;
    const res = createResponse();
    const next = vi.fn();

    await activeAccountMiddleware(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_INACTIVE");
  });

  it("rejects tenantless member routes when token membership is no longer active", async () => {
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Account")) {
        return { findOne: vi.fn().mockResolvedValue({ id: "account-1", is_active: true }) } as any;
      }
      if (name.includes("SalonMembership")) {
        return { findOne: vi.fn().mockResolvedValue(null) } as any;
      }
      if (name.includes("User")) {
        return { findOne: vi.fn().mockResolvedValue({ id: "member-1", is_active: true }) } as any;
      }
      return { findOne: vi.fn() } as any;
    });

    const req = {
      method: "GET",
      auth: {
        sub: "member-1",
        accountId: "account-1",
        linkedUserId: "member-1",
        tenantId: "tenant-1",
        membershipId: "membership-1",
        role: "MEMBER",
      },
    } as any;
    const res = createResponse();
    const next = vi.fn();

    await activeAccountMiddleware(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe("SESSION_REVOKED");
  });

  it("does not use JWT_SECRET as the internal admin secret in production", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "jwt-secret";
    delete process.env.FIZYOFLOW_ADMIN_SECRET;

    const req = { headers: { "x-fizyoflow-admin-secret": "jwt-secret" } } as any;
    const res = createResponse();
    const next = vi.fn();

    internalAdminMiddleware(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe("CONFIG_ERROR");
  });

  it("rejects internal admin requests without headers instead of throwing", () => {
    process.env.NODE_ENV = "test";
    process.env.FIZYOFLOW_ADMIN_SECRET = "internal-secret";

    const req = {} as any;
    const res = createResponse();
    const next = vi.fn();

    internalAdminMiddleware(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe("INVALID_INTERNAL_ADMIN");
  });

  it("rejects /auth/me for inactive account sessions", async () => {
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if ((entity?.name || "").includes("Account")) {
        return { findOne: vi.fn().mockResolvedValue({ id: "account-1", is_active: false }) } as any;
      }
      return { findOne: vi.fn() } as any;
    });

    const req = {
      auth: {
        sub: "account-1",
        accountId: "account-1",
        role: "MEMBER",
        loginScope: "ACCOUNT",
      },
    } as any;
    const res = createResponse();

    await expect(AuthController.me(req, res as any)).rejects.toMatchObject({
      code: "ACCOUNT_INACTIVE",
      statusCode: 403,
    });
  });
});
