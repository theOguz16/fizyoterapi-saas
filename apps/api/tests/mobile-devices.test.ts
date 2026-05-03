import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataSource } from "../data-source";
import { MobileDevicesController } from "../controllers/mobile/devices.controller";

describe("MobileDevicesController", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers a mobile device token", async () => {
    const repo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((input) => ({ id: "dev-1", ...input })),
      save: vi.fn().mockImplementation(async (input) => input),
    };
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(repo as any);

    const req: any = {
      tenantId: "tenant-1",
      auth: { sub: "member-1" },
      body: { token: "ExponentPushToken[test]", platform: "IOS" },
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    await MobileDevicesController.register(req, res);

    expect(repo.findOne).toHaveBeenCalledWith({ where: { token: "ExponentPushToken[test]" } });
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          token: "ExponentPushToken[test]",
          platform: "IOS",
          is_active: true,
        }),
      })
    );
  });

  it("unregisters a mobile device token idempotently", async () => {
    const repo = {
      findOne: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
    };
    vi.spyOn(AppDataSource, "getRepository").mockReturnValue(repo as any);

    const req: any = {
      tenantId: "tenant-1",
      auth: { sub: "member-1" },
      params: { token: encodeURIComponent("ExponentPushToken[test]") },
    };
    const res: any = {
      json: vi.fn().mockReturnThis(),
    };

    await MobileDevicesController.unregister(req, res);

    expect(repo.findOne).toHaveBeenCalledWith({
      where: {
        tenant_id: "tenant-1",
        member_id: "member-1",
        token: "ExponentPushToken[test]",
      },
    });
    expect(repo.save).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ data: { removed: false } });
  });
});
