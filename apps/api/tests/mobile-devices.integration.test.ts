import jwt from "jsonwebtoken";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataSource } from "../data-source";
import { MobileDevicesController } from "../controllers/mobile/devices.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/rbac.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";
import { TenantLifecycleService } from "../services/tenant-lifecycle.service";
import { runRouteChain } from "./helpers/route-chain";

function createToken(payload: { sub: string; tenantId?: string | null; role: "ADMIN" | "TRAINER" | "MEMBER" }) {
  return jwt.sign(payload, process.env.JWT_SECRET || "test-secret");
}

describe("mobile devices route integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  it("rejects unauthenticated requests before controller execution", async () => {
    process.env.JWT_SECRET = "test-secret";
    const response = await runRouteChain(
      [
        authMiddleware as any,
        tenantMiddleware as any,
        requireRole(["ADMIN", "TRAINER", "MEMBER"]) as any,
        MobileDevicesController.register as any,
      ],
      {
        method: "POST",
        headers: {},
        cookies: {},
        body: { token: "ExponentPushToken[test]", platform: "IOS" },
      }
    );

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "NO_TOKEN",
        message: "Oturum bulunamadı. Lütfen tekrar giriş yapın.",
      },
    });
  });

  it("blocks member requests when tenant is missing", async () => {
    process.env.JWT_SECRET = "test-secret";
    const token = createToken({ sub: "member-1", tenantId: null, role: "MEMBER" });
    const response = await runRouteChain(
      [
        authMiddleware as any,
        tenantMiddleware as any,
        requireRole(["ADMIN", "TRAINER", "MEMBER"]) as any,
        MobileDevicesController.register as any,
      ],
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        cookies: {},
        body: { token: "ExponentPushToken[test]", platform: "IOS" },
      }
    );

    expect(response.statusCode).toBe(403);
    expect((response.body as any).error.code).toBe("NO_ACTIVE_SALON");
  });

  it("blocks write operations for read-only tenants", async () => {
    process.env.JWT_SECRET = "test-secret";
    const tenantRepo = {
      findOne: vi.fn().mockResolvedValue({ id: "tenant-1" }),
    };
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(tenantRepo as any);
    vi.spyOn(TenantLifecycleService, "syncTenantState").mockResolvedValue({
      id: "tenant-1",
      is_active: true,
      subscription_status: "READ_ONLY",
    } as any);

    const token = createToken({ sub: "member-1", tenantId: "tenant-1", role: "MEMBER" });
    const response = await runRouteChain(
      [
        authMiddleware as any,
        tenantMiddleware as any,
        requireRole(["ADMIN", "TRAINER", "MEMBER"]) as any,
        MobileDevicesController.register as any,
      ],
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        cookies: {},
        body: { token: "ExponentPushToken[test]", platform: "IOS" },
      }
    );

    expect(response.statusCode).toBe(403);
    expect((response.body as any).error.code).toBe("TENANT_READ_ONLY");
  });

  it("registers a device when auth, tenant and payload are valid", async () => {
    process.env.JWT_SECRET = "test-secret";
    const tenantRepo = {
      findOne: vi.fn().mockResolvedValue({ id: "tenant-1" }),
    };
    const deviceRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((input) => ({ id: "dev-1", ...input })),
      save: vi.fn().mockImplementation(async (input) => input),
    };
    const userRepo = {
      findOne: vi.fn().mockResolvedValue({ id: "member-1", is_active: true }),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Tenant")) return tenantRepo as any;
      if (name.includes("User")) return userRepo as any;
      if (name.includes("DeviceToken")) return deviceRepo as any;
      return {} as any;
    });
    vi.spyOn(TenantLifecycleService, "syncTenantState").mockImplementation(async (tenant) => ({
      ...tenant,
      is_active: true,
      subscription_status: "ACTIVE",
    } as any));

    const token = createToken({ sub: "member-1", tenantId: "tenant-1", role: "MEMBER" });
    const response = await runRouteChain(
      [
        authMiddleware as any,
        tenantMiddleware as any,
        requireRole(["ADMIN", "TRAINER", "MEMBER"]) as any,
        MobileDevicesController.register as any,
      ],
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        cookies: {},
        body: { token: "ExponentPushToken[test]", platform: "IOS" },
      }
    );

    expect(response.statusCode).toBe(201);
    expect((response.body as any).data).toEqual(
      expect.objectContaining({
        id: "dev-1",
        token: "ExponentPushToken[test]",
        platform: "IOS",
        is_active: true,
      })
    );
    expect(deviceRepo.save).toHaveBeenCalledTimes(1);
  });
});
