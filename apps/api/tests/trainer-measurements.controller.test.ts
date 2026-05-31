import { afterEach, describe, expect, it, vi } from "vitest";
import { TrainerMeasurementsController } from "../controllers/trainer/measurements.controller";
import { AppDataSource } from "../data-source";
import { AuditLogService } from "../services/audit-log.service";
import { TrainerScopeService } from "../services/trainer-scope.service";
import { createMockResponse } from "./helpers/route-chain";

function createQueryBuilderMock(result: {
  many?: unknown[];
}) {
  return {
    distinctOn: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue(result.many ?? []),
  };
}

describe("trainer measurements controller", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("lists measurements and builds numeric trend payloads", async () => {
    const measurementQuery = createQueryBuilderMock({
      many: [
        { id: "m-2", measured_at: "2026-05-02T09:00:00.000Z", weight_kg: "68.50" },
        { id: "m-1", measured_at: "2026-05-01T09:00:00.000Z", weight_kg: "69.10" },
      ],
    });
    const measurementRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(measurementQuery),
      find: vi.fn().mockResolvedValue([
        {
          measured_at: "2026-05-01T09:00:00.000Z",
          weight_kg: "69.10",
          fat_percent: "18.50",
          muscle_kg: null,
          height_cm: "170.00",
        },
        {
          measured_at: "2026-05-02T09:00:00.000Z",
          weight_kg: "68.50",
          fat_percent: null,
          muscle_kg: "28.00",
          height_cm: "170.00",
        },
      ]),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Measurement")) return measurementRepo as any;
      return {} as any;
    });
    vi.spyOn(TrainerScopeService, "hasTrainerMemberScope").mockResolvedValue(true);

    const listReq = {
      tenantId: "tenant-1",
      auth: { sub: "trainer-1", role: "TRAINER" },
      query: { memberId: "member-1" },
    } as any;
    const listRes = createMockResponse();
    await TrainerMeasurementsController.list(listReq, listRes as any);

    expect(listRes.body).toEqual({
      data: [
        expect.objectContaining({
          id: "m-2",
          measured_at: "2026-05-02T09:00:00.000Z",
          weight_kg: "68.50",
        }),
        expect.objectContaining({
          id: "m-1",
          measured_at: "2026-05-01T09:00:00.000Z",
          weight_kg: "69.10",
        }),
      ],
    });

    const trendReq = {
      tenantId: "tenant-1",
      auth: { sub: "trainer-1", role: "TRAINER" },
      query: { memberId: "member-1" },
    } as any;
    const trendRes = createMockResponse();
    await TrainerMeasurementsController.trend(trendReq, trendRes as any);

    expect(trendRes.body).toEqual({
      data: {
        labels: ["2026-05-01T09:00:00.000Z", "2026-05-02T09:00:00.000Z"],
        weight_kg: [69.1, 68.5],
        fat_percent: [18.5, null],
        muscle_kg: [null, 28],
        height_cm: [170, 170],
      },
    });
  });

  it("creates and updates measurements with validation and audit", async () => {
    const measurementRepo = {
      create: vi.fn().mockImplementation((input) => ({ id: "measurement-1", ...input, created_at: null, updated_at: null })),
      save: vi.fn().mockImplementation(async (input) => input),
      findOne: vi.fn().mockResolvedValue({
        id: "measurement-1",
        tenant_id: "tenant-1",
        trainer_id: "trainer-1",
        member_id: "member-1",
        measured_at: new Date("2026-05-01T09:00:00.000Z"),
        height_cm: "170.00",
        weight_kg: "69.10",
        fat_percent: null,
        muscle_kg: null,
        extras: {},
      }),
    };
    const userRepo = {
      findOne: vi.fn().mockResolvedValue({
        id: "member-1",
        is_active: true,
      }),
    };
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Measurement")) return measurementRepo as any;
      if (name.includes("User")) return userRepo as any;
      return {} as any;
    });
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);

    const createReq = {
      tenantId: "tenant-1",
      auth: { sub: "trainer-1", role: "TRAINER" },
      body: {
        member_id: "member-1",
        measured_at: "2026-05-03T09:00:00.000Z",
        weight_kg: 68.2,
        height_cm: 170,
        extras: { note: "stable" },
      },
      method: "POST",
      originalUrl: "/api/trainer/measurements",
      headers: { "user-agent": "vitest" },
    } as any;
    const createRes = createMockResponse();
    await TrainerMeasurementsController.create(createReq, createRes as any);

    expect(createRes.statusCode).toBe(201);
    expect(createRes.body).toEqual({
      data: expect.objectContaining({
        id: "measurement-1",
        member_id: "member-1",
        trainer_id: "trainer-1",
        weight_kg: "68.20",
        height_cm: "170.00",
        extras: { note: "stable" },
      }),
    });

    const updateReq = {
      tenantId: "tenant-1",
      auth: { sub: "trainer-1", role: "TRAINER" },
      params: { id: "measurement-1" },
      body: {
        weight_kg: 67.8,
        muscle_kg: 28.4,
      },
      method: "PUT",
      originalUrl: "/api/trainer/measurements/measurement-1",
      headers: { "user-agent": "vitest" },
    } as any;
    const updateRes = createMockResponse();
    await TrainerMeasurementsController.update(updateReq, updateRes as any);

    expect(updateRes.body).toEqual({
      data: expect.objectContaining({
        id: "measurement-1",
        weight_kg: "67.80",
        muscle_kg: "28.40",
      }),
    });
    expect(AuditLogService.log).toHaveBeenCalledTimes(2);
  });

  it("builds due list with threshold clamping and missing-measurement members", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-30T12:00:00.000Z"));

    const userRepo = {
      find: vi.fn().mockResolvedValue([
        { id: "member-1", first_name: "Ada", last_name: "Yilmaz", email: "ada@demo.local", phone: "555" },
        { id: "member-2", first_name: "Ece", last_name: "Kara", email: "ece@demo.local", phone: "556" },
      ]),
    };
    const measurementRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(
        createQueryBuilderMock({
          many: [
            {
              member_id: "member-1",
              measured_at: "2026-05-01T12:00:00.000Z",
            },
          ],
        })
      ),
    };
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("User")) return userRepo as any;
      if (name.includes("Measurement")) return measurementRepo as any;
      return {} as any;
    });
    vi.spyOn(TrainerScopeService, "resolveTrainerMemberIds").mockResolvedValue(["member-1", "member-2"]);

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "trainer-1", role: "TRAINER" },
      query: { thresholdDays: "999" },
    } as any;
    const res = createMockResponse();
    await TrainerMeasurementsController.dueList(req, res as any);

    expect(res.body).toEqual({
      data: [
        {
          member_id: "member-2",
          full_name: "Ece Kara",
          email: "ece@demo.local",
          phone: "556",
          last_measured_at: null,
          days_since_last: null,
          due: true,
        },
      ],
      thresholdDays: 365,
    });
  });

  it("archives trainer measurements instead of hard deleting them", async () => {
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
    await TrainerMeasurementsController.remove(
      {
        tenantId: "tenant-1",
        auth: { sub: "trainer-1", role: "TRAINER" },
        params: { id: "measurement-1" },
        method: "DELETE",
        originalUrl: "/api/trainer/measurements/measurement-1",
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
