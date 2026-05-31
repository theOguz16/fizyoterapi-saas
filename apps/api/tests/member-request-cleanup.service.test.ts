import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataSource } from "../data-source";
import { MemberRequestCleanupService } from "../services/member-request-cleanup.service";

describe("member request cleanup service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns actionable queued payment requests when any requested package overlaps", async () => {
    const notificationRepo = {
      find: vi.fn().mockResolvedValue([
        {
          id: "evt-1",
          payload: {
            package_id: "pkg-legacy",
            package_ids: ["pkg-2", "pkg-3"],
          },
        },
      ]),
      save: vi.fn(),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = typeof entity === "function" ? entity.name : String(entity);
      if (name === "NotificationEvent") return notificationRepo as any;
      return {} as any;
    });

    const row = await MemberRequestCleanupService.findActionablePaymentRequest({
      identifiers: ["member-1"],
      tenantId: "tenant-1",
      packageIds: ["pkg-4", "pkg-2"],
    });

    expect(row).toEqual(
      expect.objectContaining({
        id: "evt-1",
      })
    );
  });

  it("parses string payloads when checking queued payment package overlap", async () => {
    const notificationRepo = {
      find: vi.fn().mockResolvedValue([
        {
          id: "evt-1",
          payload: JSON.stringify({
            package_id: "pkg-legacy",
            package_ids: ["pkg-2"],
          }),
        },
      ]),
      save: vi.fn(),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = typeof entity === "function" ? entity.name : String(entity);
      if (name === "NotificationEvent") return notificationRepo as any;
      return {} as any;
    });

    const row = await MemberRequestCleanupService.findActionablePaymentRequest({
      identifiers: ["member-1"],
      tenantId: "tenant-1",
      packageIds: ["pkg-2"],
    });

    expect(row).toEqual(expect.objectContaining({ id: "evt-1" }));
  });

  it("ignores queued payment requests when requested packages do not overlap", async () => {
    const notificationRepo = {
      find: vi.fn().mockResolvedValue([
        {
          id: "evt-1",
          payload: {
            package_id: "pkg-1",
            package_ids: ["pkg-2"],
          },
        },
      ]),
      save: vi.fn(),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = typeof entity === "function" ? entity.name : String(entity);
      if (name === "NotificationEvent") return notificationRepo as any;
      return {} as any;
    });

    const row = await MemberRequestCleanupService.findActionablePaymentRequest({
      identifiers: ["member-1"],
      tenantId: "tenant-1",
      packageIds: ["pkg-9"],
    });

    expect(row).toBeNull();
  });

  it("loads linked salon applications with tenant scope when validating pending payment requests", async () => {
    const notificationRepo = {
      find: vi.fn().mockResolvedValue([
        {
          id: "evt-1",
          payload: {
            package_id: "pkg-1",
            application_id: "application-1",
          },
        },
      ]),
      save: vi.fn(),
    };
    const applicationRepo = {
      findOne: vi.fn().mockResolvedValue({ id: "application-1", status: "PENDING" }),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = typeof entity === "function" ? entity.name : String(entity);
      if (name === "NotificationEvent") return notificationRepo as any;
      if (name === "SalonApplication") return applicationRepo as any;
      return {} as any;
    });

    await MemberRequestCleanupService.findActionablePaymentRequest({
      identifiers: ["member-1"],
      tenantId: "tenant-1",
      packageIds: ["pkg-1"],
    });

    expect(applicationRepo.findOne).toHaveBeenCalledWith({
      where: { id: "application-1", tenant_id: "tenant-1" },
    });
  });

  it("preserves parsed payload fields when clearing tenant scoped pending state", async () => {
    const savedRows: any[] = [];
    const updateBuilder = {
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ affected: 0 }),
    };
    const notificationRepo = {
      find: vi.fn().mockResolvedValue([
        {
          id: "evt-1",
          payload: JSON.stringify({ package_id: "pkg-1", note: "Bekleyen odeme" }),
        },
      ]),
      save: vi.fn(async (rows: any[]) => {
        savedRows.push(...rows);
        return rows;
      }),
    };

    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      const name = typeof entity === "function" ? entity.name : String(entity);
      if (name === "SalonApplication") return { createQueryBuilder: vi.fn().mockReturnValue(updateBuilder) } as any;
      if (name === "NotificationEvent") return notificationRepo as any;
      return {} as any;
    });

    await MemberRequestCleanupService.clearTenantScopedPendingState({
      tenantId: "tenant-1",
      accountId: "account-1",
      identifiers: ["account-1"],
      reason: "LEFT_SALON",
    });

    expect(savedRows[0].payload).toEqual(
      expect.objectContaining({
        package_id: "pkg-1",
        note: "Bekleyen odeme",
        decision: "CANCELLED",
        status: "CANCELLED",
        cancel_reason: "LEFT_SALON",
      })
    );
  });
});
