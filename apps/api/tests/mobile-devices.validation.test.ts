import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../errors/AppError";
import { MobileDevicesController } from "../controllers/mobile/devices.controller";

describe("MobileDevicesController validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects unsupported platforms", async () => {
    const req = {
      tenantId: "tenant-1",
      auth: { sub: "member-1" },
      body: { token: "ExponentPushToken[test]", platform: "DESKTOP" },
    } as any;
    const res = {} as any;

    await expect(MobileDevicesController.register(req, res)).rejects.toEqual(
      expect.objectContaining<AppError>({
        code: "VALIDATION_ERROR",
        statusCode: 400,
      })
    );
  });

  it("rejects empty device tokens", async () => {
    const req = {
      tenantId: "tenant-1",
      auth: { sub: "member-1" },
      body: { token: "   ", platform: "IOS" },
    } as any;
    const res = {} as any;

    await expect(MobileDevicesController.register(req, res)).rejects.toEqual(
      expect.objectContaining<AppError>({
        code: "VALIDATION_ERROR",
        statusCode: 400,
      })
    );
  });
});
