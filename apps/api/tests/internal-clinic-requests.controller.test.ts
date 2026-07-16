import { afterEach, describe, expect, it, vi } from "vitest";
import { InternalClinicRequestsController } from "../controllers/internal/clinic-requests.controller";
import { AppDataSource } from "../data-source";
import { ProductDemoLead } from "../entities/product-demo-lead.entity";
import { AuditLogService } from "../services/audit-log.service";
import { createMockResponse } from "./helpers/route-chain";

describe("internal clinic requests controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists product site demo leads from the dedicated repository", async () => {
    const find = vi.fn().mockResolvedValue([
      {
        id: "demo-lead-1",
        created_at: new Date("2026-05-18T10:00:00.000Z"),
        source: "PRODUCT_SITE_DEMO",
        full_name: "Ayşe Yılmaz",
        clinic_name: "Denge Fizyo",
        email: "ayse@dengefizyo.com",
        phone: "05551112233",
        city: "Kadıköy",
        note: "Demo almak istiyoruz",
      },
    ]);
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === ProductDemoLead) {
        return { find } as any;
      }
      throw new Error(`Unexpected repository: ${String(entity?.name || entity)}`);
    });

    const res = createMockResponse();
    await InternalClinicRequestsController.listDemoLeads({} as any, res as any);

    expect(res.body).toEqual({
      data: [
        {
          id: "demo-lead-1",
          created_at: new Date("2026-05-18T10:00:00.000Z"),
          full_name: "Ayşe Yılmaz",
          clinic_name: "Denge Fizyo",
          email: "ayse@dengefizyo.com",
          phone: "05551112233",
          city: "Kadıköy",
          note: "Demo almak istiyoruz",
          source: "PRODUCT_SITE_DEMO",
        },
      ],
    });
    expect(find).toHaveBeenCalledWith({ order: { created_at: "DESC" }, take: 100 });
  });

  it("hard-deletes a demo lead and records only operational audit metadata", async () => {
    const demoLead = { id: "11111111-1111-4111-8111-111111111111", source: "PRODUCT_SITE_DEMO" };
    const repo = {
      findOne: vi.fn().mockResolvedValue(demoLead),
      remove: vi.fn().mockResolvedValue(demoLead),
    };
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === ProductDemoLead) return repo as any;
      throw new Error(`Unexpected repository: ${String(entity?.name || entity)}`);
    });
    const auditSpy = vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as any);

    const res = { ...createMockResponse(), send: vi.fn() };
    await InternalClinicRequestsController.hardDeleteDemoLead(
      {
        params: { id: demoLead.id },
        method: "DELETE",
        originalUrl: `/api/internal/clinic-requests/demo-leads/${demoLead.id}`,
        headers: { "user-agent": "vitest" },
      } as any,
      res as any
    );

    expect(repo.remove).toHaveBeenCalledWith(demoLead);
    expect(res.statusCode).toBe(204);
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({
      event_type: "INTERNAL_DEMO_LEAD_HARD_DELETED",
      target_id: demoLead.id,
      metadata: {
        demo_lead_id: demoLead.id,
        source: "PRODUCT_SITE_DEMO",
        status: "HARD_DELETED",
      },
    }));
  });

  it("rejects malformed demo lead ids before querying the repository", async () => {
    const repoSpy = vi.spyOn(AppDataSource, "getRepository");

    await expect(InternalClinicRequestsController.hardDeleteDemoLead(
      { params: { id: "not-a-uuid" } } as any,
      createMockResponse() as any
    )).rejects.toMatchObject({ code: "INVALID_DEMO_LEAD_ID", statusCode: 400 });

    expect(repoSpy).not.toHaveBeenCalled();
  });
});
