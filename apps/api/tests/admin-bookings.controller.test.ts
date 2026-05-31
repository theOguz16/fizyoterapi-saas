import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminBookingsController } from "../controllers/admin/bookings.controller";
import { AppDataSource } from "../data-source";
import { UserRole } from "../entities/user.entity";
import { createMockResponse } from "./helpers/route-chain";

describe("admin bookings controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects booking creation when member is not an active tenant member", async () => {
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if ((entity?.name || "").includes("User")) {
        return {
          findOne: vi.fn(async ({ where }: any) =>
            where.role === UserRole.TRAINER ? { id: where.id } : null
          ),
        } as any;
      }
      return {
        findOne: vi.fn(),
        save: vi.fn(),
      } as any;
    });

    const req = {
      tenantId: "tenant-1",
      body: {
        member_id: "member-other-tenant",
        trainer_id: "trainer-1",
        starts_at: "2026-05-11T10:00:00.000Z",
        ends_at: "2026-05-11T11:00:00.000Z",
      },
      method: "POST",
      originalUrl: "/api/admin/bookings",
      headers: {},
    } as any;

    await expect(AdminBookingsController.create(req, createMockResponse() as any)).rejects.toMatchObject({
      code: "MEMBER_NOT_FOUND",
      statusCode: 404,
    });
  });

  it("rejects booking creation when selected session belongs to another trainer", async () => {
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = entity?.name || "";
      if (name.includes("User")) {
        return {
          findOne: vi.fn(async ({ where }: any) => ({ id: where.id })),
        } as any;
      }
      if (name.includes("ClassSession")) {
        return {
          findOne: vi.fn().mockResolvedValue({ id: "session-1", trainer_id: "trainer-2" }),
        } as any;
      }
      return {
        save: vi.fn(),
      } as any;
    });

    const req = {
      tenantId: "tenant-1",
      body: {
        member_id: "member-1",
        trainer_id: "trainer-1",
        session_id: "session-1",
        starts_at: "2026-05-11T10:00:00.000Z",
        ends_at: "2026-05-11T11:00:00.000Z",
      },
      method: "POST",
      originalUrl: "/api/admin/bookings",
      headers: {},
    } as any;

    await expect(AdminBookingsController.create(req, createMockResponse() as any)).rejects.toMatchObject({
      code: "SESSION_TRAINER_MISMATCH",
      statusCode: 400,
    });
  });
});
