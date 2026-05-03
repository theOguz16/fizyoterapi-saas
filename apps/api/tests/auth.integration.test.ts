import jwt from "jsonwebtoken";
import { afterEach, describe, expect, it } from "vitest";
import { authMiddleware } from "../middlewares/auth.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";
import { requireRole } from "../middlewares/rbac.middleware";
import { MobileDevicesController } from "../controllers/mobile/devices.controller";
import { runRouteChain } from "./helpers/route-chain";

describe("auth middleware integration", () => {
  afterEach(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  it("returns config error when JWT secret is missing", async () => {
    delete process.env.JWT_SECRET;
    const response = await runRouteChain(
      [
        authMiddleware as any,
        tenantMiddleware as any,
        requireRole(["ADMIN", "TRAINER", "MEMBER"]) as any,
        MobileDevicesController.register as any,
      ],
      {
        method: "POST",
        headers: {},
        cookies: {},
        body: { token: "ExponentPushToken[test]", platform: "IOS" },
      }
    );

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: "CONFIG_ERROR",
        message: "Sunucu yapılandırması eksik",
      },
    });
  });

  it("falls back to cookie session when bearer token is invalid", async () => {
    process.env.JWT_SECRET = "test-secret";
    const cookieToken = jwt.sign({ sub: "member-1", tenantId: null, role: "MEMBER" }, process.env.JWT_SECRET);
    const response = await runRouteChain(
      [
        authMiddleware as any,
        tenantMiddleware as any,
        requireRole(["ADMIN", "TRAINER", "MEMBER"]) as any,
        MobileDevicesController.register as any,
      ],
      {
        method: "POST",
        headers: { authorization: "Bearer invalid-token" },
        cookies: { accessToken: cookieToken },
        body: { token: "ExponentPushToken[test]", platform: "IOS" },
      }
    );

    expect(response.statusCode).toBe(403);
    expect((response.body as any).error.code).toBe("NO_ACTIVE_SALON");
  });
});
