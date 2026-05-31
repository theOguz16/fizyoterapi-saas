import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminSessionsController } from "../controllers/admin/sessions.controller";
import { AppDataSource } from "../data-source";
import { SessionStatus, SessionType } from "../entities/class-session.entity";
import { AuditLogService } from "../services/audit-log.service";
import { createMockResponse } from "./helpers/route-chain";

describe("admin sessions controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects invited members that are not active members of the tenant", async () => {
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if ((entity?.name || "").includes("SalonMembership")) {
        return { find: vi.fn().mockResolvedValue([]) } as any;
      }
      return {
        findOne: vi.fn().mockResolvedValue(null),
        create: vi.fn((value: any) => ({ ...value, id: "session-1" })),
        save: vi.fn(),
      } as any;
    });

    const req = {
      tenantId: "tenant-1",
      body: {
        type: SessionType.GROUP,
        title: "Mat Pilates",
        starts_at: "2026-05-11T10:00:00.000Z",
        ends_at: "2026-05-11T11:00:00.000Z",
        invited_member_ids: ["member-other-tenant"],
      },
      method: "POST",
      originalUrl: "/api/admin/sessions",
      headers: {},
    } as any;

    await expect(AdminSessionsController.create(req, createMockResponse() as any)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
    });
  });

  it("cancels sessions instead of hard deleting them", async () => {
    const session = {
      id: "session-1",
      tenant_id: "tenant-1",
      status: SessionStatus.SCHEDULED,
      starts_at: new Date("2026-05-11T10:00:00.000Z"),
      ends_at: new Date("2026-05-11T11:00:00.000Z"),
    };
    const sessionRepo = {
      findOne: vi.fn().mockResolvedValue(session),
      save: vi.fn().mockImplementation(async (row) => row),
      remove: vi.fn(),
    };

    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(sessionRepo as any);
    vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as never);

    const req = {
      tenantId: "tenant-1",
      params: { id: "session-1" },
      method: "DELETE",
      originalUrl: "/api/admin/sessions/session-1",
      headers: {},
    } as any;
    const res = createMockResponse();

    await AdminSessionsController.remove(req, res as any);

    expect(sessionRepo.remove).not.toHaveBeenCalled();
    expect(sessionRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: SessionStatus.CANCELED }));
    expect(res.body.message).toBe("Seans iptal edildi");
  });
});
