import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminMeasurementsController } from "../controllers/admin/measurements.controller";
import { AppDataSource } from "../data-source";
import { AuditLogService } from "../services/audit-log.service";
import { createMockResponse } from "./helpers/route-chain";

describe("admin measurements controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("archives measurements instead of hard deleting them", async () => {
    const measurement = {
      id: "measurement-1",
      tenant_id: "tenant-1",
      trainer_id: "trainer-1",
      member_id: "member-1",
      measured_at: new Date("2026-05-01T09:00:00.000Z"),
      deleted_at: null,
    };
    const measurementRepo = {
      findOne: vi.fn().mockResolvedValue(measurement),
      save: vi.fn().mockImplementation(async (row) => row),
      remove: vi.fn(),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Measurement")) return measurementRepo as any;
      return {} as any;
    });
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);

    const res = createMockResponse();
    await AdminMeasurementsController.remove(
      {
        tenantId: "tenant-1",
        auth: { sub: "admin-1", role: "ADMIN" },
        params: { id: "measurement-1" },
        method: "DELETE",
        originalUrl: "/api/admin/measurements/measurement-1",
        headers: {},
      } as any,
      res as any
    );

    expect(measurementRepo.remove).not.toHaveBeenCalled();
    expect(measurement.deleted_at).toBeInstanceOf(Date);
    expect(measurementRepo.save).toHaveBeenCalledWith(expect.objectContaining({ deleted_at: expect.any(Date) }));
    expect(res.body.message).toBe("Olcum arşivlendi");
  });
});
