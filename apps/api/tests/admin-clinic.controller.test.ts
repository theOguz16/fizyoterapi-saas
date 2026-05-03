import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminClinicController } from "../controllers/admin/clinic.controller";
import { AppDataSource } from "../data-source";
import { createMockResponse } from "./helpers/route-chain";

describe("admin clinic controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.PUBLIC_WEB_BASE_URL;
    delete process.env.DETOUR_LINK_BASE_URL;
  });

  it("returns a stable onboarding qr payload url", async () => {
    process.env.PUBLIC_WEB_BASE_URL = "https://join.example.com/";
    process.env.DETOUR_LINK_BASE_URL = "https://detour.example.com/";
    const tenant = {
      id: "tenant-1",
      slug: "demo-salon",
      name: "Demo Salon",
      qr_code: "CLN-DEMO-001",
    };
    const repo = {
      findOne: vi.fn().mockResolvedValue(tenant),
      save: vi.fn(async (row) => row),
    };

    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(repo as any);

    const req = {
      tenantId: "tenant-1",
    } as any;
    const res = createMockResponse();

    await AdminClinicController.getClinicQr(req, res as any);

    expect(res.body).toEqual({
      data: expect.objectContaining({
        qr_code: "CLN-DEMO-001",
        qr_payload: "https://join.example.com/join/demo-salon?code=CLN-DEMO-001",
        join_url: "https://join.example.com/join/demo-salon?code=CLN-DEMO-001",
      }),
    });
  });

  it("prefers detour url for qr payload when detour domain is configured", async () => {
    process.env.PUBLIC_WEB_BASE_URL = "https://join.example.com/";
    process.env.DETOUR_LINK_BASE_URL = "https://clinerva.godetour.link/2IbxPluNu4";
    const tenant = {
      id: "tenant-1",
      slug: "demo-salon",
      name: "Demo Salon",
      qr_code: "CLN-DEMO-001",
    };
    const repo = {
      findOne: vi.fn().mockResolvedValue(tenant),
      save: vi.fn(async (row) => row),
    };

    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(repo as any);

    const req = { tenantId: "tenant-1" } as any;
    const res = createMockResponse();

    await AdminClinicController.getClinicQr(req, res as any);

    expect(res.body).toEqual({
      data: expect.objectContaining({
        qr_payload: expect.stringContaining("https://clinerva.app.link/?"),
        join_url: "https://join.example.com/join/demo-salon?code=CLN-DEMO-001",
      }),
    });
  });
});
