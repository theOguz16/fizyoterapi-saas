import { afterEach, describe, expect, it, vi } from "vitest";
import { MemberMeasurementsController } from "../controllers/member/measurements.controller";
import { AppDataSource } from "../data-source";
import { AuditLogService } from "../services/audit-log.service";
import { createMockResponse } from "./helpers/route-chain";

describe("member measurements controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a measurement with the latest trainer context and normalized numeric fields", async () => {
    const bookingRepo = {
      findOne: vi.fn().mockResolvedValue({ trainer_id: "trainer-9" }),
    };
    const attendanceRepo = {
      findOne: vi.fn().mockResolvedValue(null),
    };
    const createdMeasurement = {
      id: "measurement-1",
      member_id: "member-1",
      trainer_id: "trainer-9",
      measured_at: new Date("2026-04-23T09:00:00.000Z"),
      height_cm: "178.00",
      weight_kg: "74.00",
      fat_percent: "18.00",
      muscle_kg: "31.00",
      extras: { note: "stable" },
    };
    const measurementRepo = {
      create: vi.fn().mockImplementation((payload) => ({ ...createdMeasurement, ...payload })),
      save: vi.fn().mockImplementation(async (payload) => payload),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Booking")) return bookingRepo as any;
      if (name.includes("Attendance")) return attendanceRepo as any;
      if (name.includes("Measurement")) return measurementRepo as any;
      return {} as any;
    });
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "member-1", linkedUserId: "member-1", role: "MEMBER" },
      body: {
        measured_at: "2026-04-23T09:00:00.000Z",
        height_cm: 178,
        weight_kg: 74,
        fat_percent: 18,
        muscle_kg: 31,
        extras: { note: "stable" },
      },
      method: "POST",
      originalUrl: "/api/member/measurements",
      headers: { "user-agent": "vitest" },
      requestId: "req-1",
      ip: "127.0.0.1",
    } as any;
    const res = createMockResponse();

    await MemberMeasurementsController.createMine(req, res as any);

    expect(res.statusCode).toBe(201);
    expect(measurementRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant-1",
        member_id: "member-1",
        trainer_id: "trainer-9",
        height_cm: "178.00",
        weight_kg: "74.00",
        fat_percent: "18.00",
        muscle_kg: "31.00",
      })
    );
    expect(res.body).toEqual({
      data: expect.objectContaining({
        id: "measurement-1",
        trainer_id: "trainer-9",
        extras: { note: "stable" },
      }),
    });
    expect(AuditLogService.log).toHaveBeenCalledTimes(1);
  });

  it("rejects negative numeric fields with validation errors", async () => {
    const bookingRepo = {
      findOne: vi.fn().mockResolvedValue(null),
    };
    const attendanceRepo = {
      findOne: vi.fn().mockResolvedValue(null),
    };
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Booking")) return bookingRepo as any;
      if (name.includes("Attendance")) return attendanceRepo as any;
      return {
        create: vi.fn(),
        save: vi.fn(),
      } as any;
    });

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "member-1" },
      body: { weight_kg: -3 },
    } as any;
    const res = createMockResponse();

    await expect(MemberMeasurementsController.createMine(req, res as any)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
    });
  });

  it("lists and trends member measurements as DTOs and numeric series", async () => {
    const rows = [
      {
        id: "measurement-2",
        measured_at: "2026-04-24T09:00:00.000Z",
        height_cm: "178.00",
        weight_kg: "74.50",
        fat_percent: "17.80",
        muscle_kg: "31.20",
        extras: {},
        trainer_id: "trainer-1",
      },
      {
        id: "measurement-1",
        measured_at: "2026-04-20T09:00:00.000Z",
        height_cm: "178.00",
        weight_kg: "75.10",
        fat_percent: "18.40",
        muscle_kg: "30.70",
        extras: {},
        trainer_id: "trainer-1",
      },
    ];
    const measurementRepo = {
      find: vi.fn().mockResolvedValue(rows),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Measurement")) return measurementRepo as any;
      return {} as any;
    });

    const req = {
      tenantId: "tenant-1",
      auth: { sub: "member-1" },
    } as any;

    const listRes = createMockResponse();
    await MemberMeasurementsController.listMine(req, listRes as any);
    expect(listRes.body).toEqual({
      data: [
        expect.objectContaining({ id: "measurement-2", weight_kg: "74.50" }),
        expect.objectContaining({ id: "measurement-1", weight_kg: "75.10" }),
      ],
    });

    const trendRes = createMockResponse();
    await MemberMeasurementsController.trendMine(req, trendRes as any);
    expect(trendRes.body).toEqual({
      data: {
        labels: ["2026-04-24T09:00:00.000Z", "2026-04-20T09:00:00.000Z"],
        weight_kg: [74.5, 75.1],
        fat_percent: [17.8, 18.4],
        muscle_kg: [31.2, 30.7],
        height_cm: [178, 178],
      },
    });
  });
});
