import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminPackagesController } from "../controllers/admin/packages.controller";
import { AppDataSource } from "../data-source";
import { AuditLogService } from "../services/audit-log.service";
import { createMockResponse } from "./helpers/route-chain";

vi.mock("../services/package.service", () => ({
  derivePackageFromCatalog: vi.fn(),
  enrichPackageRowForDisplay: vi.fn((pkg) => ({ ...pkg, pricing_label: `${pkg.display_price} TL` })),
  normalizeLessonCatalogServices: vi.fn((services) => services || []),
}));

describe("admin packages controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists packages with enriched display fields", async () => {
    const packageRepo = {
      find: vi.fn().mockResolvedValue([{ id: "pkg-1", title: "Starter", display_price: 4200 }]),
    };
    const salonProfileRepo = {
      findOne: vi.fn().mockResolvedValue({ services: [] }),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Package")) return packageRepo as any;
      if (name.includes("SalonProfile")) return salonProfileRepo as any;
      return {} as any;
    });

    const req = { tenantId: "tenant-1" } as any;
    const res = createMockResponse();

    await AdminPackagesController.list(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      data: [{ id: "pkg-1", title: "Starter", display_price: 4200, pricing_label: "4200 TL" }],
    });
  });

  it("rejects package creation when required business fields are missing", async () => {
    const req = {
      tenantId: "tenant-1",
      body: {},
    } as any;
    const res = createMockResponse();

    await expect(AdminPackagesController.create(req, res as any)).rejects.toMatchObject({
      code: "MISSING_FIELDS",
      statusCode: 400,
    });
  });

  it("creates a package using derived catalog defaults and audits the action", async () => {
    const { derivePackageFromCatalog } = await import("../services/package.service");
    vi.mocked(derivePackageFromCatalog).mockReturnValue({
      catalogItem: { active: true, title: "Reformer", code: "REFORMER" },
      packageType: "LESSON",
      capacity: 1,
      rules: { summary: "Smoke package create flow" },
      displayPrice: 4200,
    } as any);

    const savedPackage = {
      id: "pkg-2",
      tenant_id: "tenant-1",
      title: "QA Smoke Paket",
      type: "LESSON",
      total_credits: 6,
      duration_days: 21,
      capacity: 1,
      rules: { summary: "Smoke package create flow" },
      display_price: 4200,
      is_active: true,
      is_visible: true,
      is_public: false,
    };
    const packageRepo = {
      save: vi.fn().mockResolvedValue(savedPackage),
    };
    const salonProfileRepo = {
      findOne: vi.fn().mockResolvedValue({ services: [{ active: true, code: "REFORMER", title: "Reformer" }] }),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Package")) return packageRepo as any;
      if (name.includes("SalonProfile")) return salonProfileRepo as any;
      return {} as any;
    });
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "admin-1", role: "ADMIN" },
      body: {
        title: "QA Smoke Paket",
        total_credits: 6,
        duration_days: 21,
        service_key: "REFORMER",
        display_price: 4200,
        summary: "Smoke package create flow",
      },
      method: "POST",
      originalUrl: "/api/admin/packages",
      headers: { "user-agent": "vitest" },
      requestId: "req-2",
      ip: "127.0.0.1",
    } as any;
    const res = createMockResponse();

    await AdminPackagesController.create(req, res as any);

    expect(packageRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        title: "QA Smoke Paket",
        total_credits: 6,
        duration_days: 21,
        capacity: 1,
        display_price: 4200,
        is_active: true,
        is_visible: true,
        is_public: false,
      })
    );
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ data: savedPackage });
    expect(AuditLogService.log).toHaveBeenCalledTimes(1);
  });

  it("archives packages instead of hard deleting them", async () => {
    const pkg = {
      id: "pkg-1",
      tenant_id: "tenant-1",
      title: "Starter",
      type: "GROUP",
      total_credits: 8,
      duration_days: 30,
      is_active: true,
      is_visible: true,
      is_public: true,
    };
    const packageRepo = {
      findOne: vi.fn().mockResolvedValue(pkg),
      save: vi.fn().mockImplementation(async (row) => row),
      remove: vi.fn(),
    };

    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(packageRepo as any);
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);

    const req = {
      tenantId: "tenant-1",
      params: { id: "pkg-1" },
      method: "DELETE",
      originalUrl: "/api/admin/packages/pkg-1",
      headers: {},
    } as any;
    const res = createMockResponse();

    await AdminPackagesController.remove(req, res as any);

    expect(packageRepo.remove).not.toHaveBeenCalled();
    expect(packageRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ is_active: false, is_visible: false, is_public: false })
    );
    expect(res.body.message).toBe("Package arşivlendi");
  });
});
