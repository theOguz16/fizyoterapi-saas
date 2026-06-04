import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthController } from "../controllers/auth.controller";
import { AppDataSource } from "../data-source";
import { activeAccountMiddleware } from "../middlewares/active-account.middleware";
import { internalAdminMiddleware } from "../middlewares/internal-admin.middleware";
import { requireRole } from "../middlewares/rbac.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";
import { AuditLogService } from "../services/audit-log.service";
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
      clearCookie: vi.fn(),
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

  it("deletes an account without requiring email support", async () => {
    const account = {
      id: "account-1",
      email: "member@example.com",
      phone: "5551234567",
      first_name: "Member",
      last_name: "User",
      password_hash: "hash",
      onboarding_profile: { role: "MEMBER" },
      is_active: true,
    };
    const accountRepo = {
      findOne: vi.fn().mockResolvedValue(account),
      save: vi.fn().mockResolvedValue(account),
    };
    const membershipRepo = {
      find: vi.fn().mockResolvedValue([{ id: "membership-1", user_id: "user-1" }]),
      createQueryBuilder: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ affected: 1 }),
      }),
    };
    const applicationRepo = {
      createQueryBuilder: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ affected: 1 }),
      }),
    };
    const userRepo = { update: vi.fn().mockResolvedValue({ affected: 1 }) };
    const tenantRepo = {
      createQueryBuilder: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ affected: 1 }),
      }),
    };
    const manager = {
      getRepository(entity: any) {
        const name = entity?.name || "";
        if (name.includes("Account")) return accountRepo;
        if (name.includes("SalonMembership")) return membershipRepo;
        if (name.includes("SalonApplication")) return applicationRepo;
        if (name.includes("User")) return userRepo;
        if (name.includes("Tenant")) return tenantRepo;
        return {};
      },
    };
    vi.spyOn(AppDataSource, "transaction").mockImplementation(async (callback: any) => callback(manager));
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as any);

    const req = {
      method: "DELETE",
      originalUrl: "/api/auth/account",
      ip: "127.0.0.1",
      headers: {},
      auth: { accountId: "account-1", linkedUserId: "user-1", role: "MEMBER", loginScope: "ACCOUNT" },
    } as any;
    const res = createResponse();

    await AuthController.deleteAccount(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: { deleted: true } });
    expect(account.is_active).toBe(false);
    expect(account.email).toBe("deleted-account-1@deleted.fizyoflow.local");
    expect(account.onboarding_profile).toBeNull();
    expect(userRepo.update).toHaveBeenCalledWith(
      { id: "user-1" },
      expect.objectContaining({
        email: "deleted-user-1@deleted.fizyoflow.local",
        is_active: false,
        qr_code: expect.any(Function),
      })
    );
  });
});
