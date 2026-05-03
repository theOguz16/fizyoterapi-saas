import jwt from "jsonwebtoken";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataSource } from "../data-source";
import { TrainerMeasurementsController } from "../controllers/trainer/measurements.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/rbac.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";
import { TenantLifecycleService } from "../services/tenant-lifecycle.service";
import { runRouteChain } from "./helpers/route-chain";

function createToken(payload: { sub: string; tenantId?: string | null; role: "ADMIN" | "TRAINER" | "MEMBER" }) {
  return jwt.sign(payload, process.env.JWT_SECRET || "test-secret");
}

describe("trainer measurements route integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  it("blocks trainer measurement writes for non-trainer roles before controller execution", async () => {
    process.env.JWT_SECRET = "test-secret";
    const tenantRepo = {
      findOne: vi.fn().mockResolvedValue({ id: "tenant-1" }),
    };
    const measurementRepo = {
      save: vi.fn(),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Tenant")) return tenantRepo as any;
      if (name.includes("Measurement")) return measurementRepo as any;
      return {} as any;
    });
    vi.spyOn(TenantLifecycleService, "syncTenantState").mockResolvedValue({
      id: "tenant-1",
      is_active: true,
      subscription_status: "ACTIVE",
    } as any);

    const token = createToken({ sub: "member-1", tenantId: "tenant-1", role: "MEMBER" });
    const response = await runRouteChain(
      [
        authMiddleware as any,
        tenantMiddleware as any,
        requireRole(["TRAINER"]) as any,
        TrainerMeasurementsController.create as any,
      ],
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        cookies: {},
        body: { member_id: "member-1", weight_kg: 68.5 },
      }
    );

    expect(response.statusCode).toBe(403);
    expect((response.body as any).error.code).toBe("FORBIDDEN");
    expect(measurementRepo.save).not.toHaveBeenCalled();
  });

  it("creates a trainer measurement when auth tenant and payload are valid", async () => {
    process.env.JWT_SECRET = "test-secret";
    const tenantRepo = {
      findOne: vi.fn().mockResolvedValue({ id: "tenant-1" }),
    };
    const userRepo = {
      findOne: vi.fn().mockResolvedValue({
        id: "member-1",
        is_active: true,
      }),
    };
    const measurementRepo = {
      create: vi.fn().mockImplementation((input) => ({
        id: "measurement-1",
        ...input,
        created_at: new Date("2026-05-03T09:00:00.000Z"),
        updated_at: new Date("2026-05-03T09:00:00.000Z"),
      })),
      save: vi.fn().mockImplementation(async (input) => input),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("Tenant")) return tenantRepo as any;
      if (name.includes("User")) return userRepo as any;
      if (name.includes("Measurement")) return measurementRepo as any;
      return {} as any;
    });
    vi.spyOn(TenantLifecycleService, "syncTenantState").mockResolvedValue({
      id: "tenant-1",
      is_active: true,
      subscription_status: "ACTIVE",
    } as any);

    const token = createToken({ sub: "trainer-1", tenantId: "tenant-1", role: "TRAINER" });
    const response = await runRouteChain(
      [
        authMiddleware as any,
        tenantMiddleware as any,
        requireRole(["TRAINER"]) as any,
        TrainerMeasurementsController.create as any,
      ],
      {
        method: "POST",
        originalUrl: "/api/trainer/measurements",
        headers: { authorization: `Bearer ${token}`, "user-agent": "vitest" },
        cookies: {},
        body: {
          member_id: "member-1",
          measured_at: "2026-05-03T09:00:00.000Z",
          weight_kg: 68.5,
          muscle_kg: 29.1,
          extras: { source: "integration" },
        },
      }
    );

    expect(response.statusCode).toBe(201);
    expect((response.body as any).data).toEqual(
      expect.objectContaining({
        id: "measurement-1",
        member_id: "member-1",
        trainer_id: "trainer-1",
        weight_kg: "68.50",
        muscle_kg: "29.10",
        extras: { source: "integration" },
      })
    );
    expect(measurementRepo.save).toHaveBeenCalledTimes(1);
  });
});
