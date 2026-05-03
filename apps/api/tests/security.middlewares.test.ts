import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataSource } from "../data-source";
import { requireRole } from "../middlewares/rbac.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";
import { TenantLifecycleService } from "../services/tenant-lifecycle.service";

describe("security middlewares", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects forbidden roles", () => {
    const middleware = requireRole(["ADMIN"]);
    const req = { auth: { role: "TRAINER" } } as any;
    const res = {
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
    const next = vi.fn();

    middleware(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("allows GET requests for read-only tenants", async () => {
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue({
      findOne: vi.fn().mockResolvedValue({ id: "tenant-1" }),
    } as any);
    vi.spyOn(TenantLifecycleService, "syncTenantState").mockResolvedValue({
      id: "tenant-1",
      is_active: true,
      subscription_status: "READ_ONLY",
    } as any);

    const req = {
      method: "GET",
      auth: { tenantId: "tenant-1", role: "ADMIN" },
    } as any;
    const res = {
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
    const res = {
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
    const next = vi.fn();

    await tenantMiddleware(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe("TENANT_INACTIVE");
  });
});
