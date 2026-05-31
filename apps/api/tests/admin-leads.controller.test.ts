import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminLeadsController } from "../controllers/admin/leads.controller";
import { AppDataSource } from "../data-source";
import { LeadStatus } from "../entities/lead.entity";
import { AuditLogService } from "../services/audit-log.service";
import { createMockResponse } from "./helpers/route-chain";

describe("admin leads controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("archives leads instead of hard deleting them", async () => {
    const lead = {
      id: "lead-1",
      tenant_id: "tenant-1",
      full_name: "Ada Yilmaz",
      phone: "555",
      status: LeadStatus.NEW,
      deleted_at: null,
    };
    const leadRepo = {
      findOne: vi.fn().mockResolvedValue(lead),
      save: vi.fn().mockImplementation(async (row) => row),
      remove: vi.fn(),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Lead")) return leadRepo as any;
      return {} as any;
    });
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);

    const res = createMockResponse();
    await AdminLeadsController.remove(
      {
        tenantId: "tenant-1",
        auth: { sub: "admin-1", role: "ADMIN" },
        params: { id: "lead-1" },
        method: "DELETE",
        originalUrl: "/api/admin/leads/lead-1",
        headers: {},
      } as any,
      res as any
    );

    expect(leadRepo.remove).not.toHaveBeenCalled();
    expect(lead.deleted_at).toBeInstanceOf(Date);
    expect(leadRepo.save).toHaveBeenCalledWith(expect.objectContaining({ deleted_at: expect.any(Date) }));
    expect(res.body.message).toBe("Lead arşivlendi");
  });
});
