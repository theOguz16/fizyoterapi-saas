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
});
