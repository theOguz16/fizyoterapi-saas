import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const httpRequestMock = vi.fn();
const getPermissionsAsync = vi.fn();
const requestPermissionsAsync = vi.fn();
const getExpoPushTokenAsync = vi.fn();
const getLastNotificationResponseAsync = vi.fn();
const addNotificationResponseReceivedListener = vi.fn();
const platform = { OS: "ios" };
const deviceState = { isDevice: true };

vi.mock("@/lib/http-client", () => ({
  httpRequest: httpRequestMock,
}));

vi.mock("expo-device", () => deviceState);

vi.mock("expo-notifications", () => ({
  getPermissionsAsync,
  requestPermissionsAsync,
  getExpoPushTokenAsync,
  getLastNotificationResponseAsync,
  addNotificationResponseReceivedListener,
}));

vi.mock("react-native", () => ({
  Platform: platform,
}));

describe("push registration", () => {
  beforeEach(() => {
    httpRequestMock.mockReset();
    getPermissionsAsync.mockReset();
    requestPermissionsAsync.mockReset();
    getExpoPushTokenAsync.mockReset();
    getLastNotificationResponseAsync.mockReset();
    addNotificationResponseReceivedListener.mockReset();
    deviceState.isDevice = true;
    platform.OS = "ios";
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("skips push registration on simulators", async () => {
    deviceState.isDevice = false;
    const { registerPushDevice } = await import("@/lib/push");

    await expect(registerPushDevice()).resolves.toEqual({ token: null });
    expect(httpRequestMock).not.toHaveBeenCalled();
  });

  it("registers an iOS token after permissions are granted", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted" });
    getExpoPushTokenAsync.mockResolvedValue({ data: "ExponentPushToken[test]" });
    const { registerPushDeviceIfPermitted } = await import("@/lib/push");

    await expect(registerPushDeviceIfPermitted()).resolves.toEqual({ token: "ExponentPushToken[test]" });
    expect(httpRequestMock).toHaveBeenCalledWith("/mobile/devices/register", {
      method: "POST",
      body: {
        token: "ExponentPushToken[test]",
        platform: "IOS",
      },
    });
  });

  it("returns null token when permissions stay denied", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "denied" });
    const { registerPushDeviceIfPermitted } = await import("@/lib/push");

    await expect(registerPushDeviceIfPermitted()).resolves.toEqual({ token: null });
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
    expect(httpRequestMock).not.toHaveBeenCalled();
  });

  it("requests permission only when user explicitly continues", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "undetermined" });
    requestPermissionsAsync.mockResolvedValue({ status: "granted" });
    getExpoPushTokenAsync.mockResolvedValue({ data: "ExponentPushToken[test]" });
    const { requestPushPermissionAndRegister } = await import("@/lib/push");

    await expect(requestPushPermissionAndRegister()).resolves.toEqual({
      token: "ExponentPushToken[test]",
      status: "granted",
    });
    expect(requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(httpRequestMock).toHaveBeenCalledTimes(1);
  });

  it("reports denied status when explicit permission request is rejected", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "undetermined" });
    requestPermissionsAsync.mockResolvedValue({ status: "denied" });
    const { requestPushPermissionAndRegister } = await import("@/lib/push");

    await expect(requestPushPermissionAndRegister()).resolves.toEqual({
      token: null,
      status: "denied",
    });
    expect(httpRequestMock).not.toHaveBeenCalled();
  });

  it("unregisters devices with encoded token path", async () => {
    const { unregisterPushDevice } = await import("@/lib/push");

    await unregisterPushDevice("Exponent Push Token/with space");

    expect(httpRequestMock).toHaveBeenCalledWith("/mobile/devices/Exponent%20Push%20Token%2Fwith%20space", {
      method: "DELETE",
    });
  });

  it.each([
    ["package", "MEMBER", "/(member)/package"],
    ["referral", "MEMBER", "/(member)/referrals"],
    ["approval", "ADMIN", "/(admin)/approvals"],
    ["member booking", "MEMBER", "/(member)/bookings"],
    ["trainer booking", "TRAINER", "/(trainer)/bookings"],
    ["check-in", "MEMBER", "/(member)/attendance"],
    ["campaign", "MEMBER", "/(member)/campaigns"],
    ["trial", "ADMIN", "/(admin)/subscription"],
  ] as const)("resolves the canonical %s target", async (_category, role, href) => {
    const { resolveNotificationHref } = await import("@/lib/push");

    expect(resolveNotificationHref({ href, role }, { role })).toBe(href);
  });

  it("preserves a canonical query string", async () => {
    const { resolveNotificationHref } = await import("@/lib/push");

    expect(
      resolveNotificationHref({ href: "/(trainer)/checkin?sessionId=booking-42&source=push", role: "TRAINER" }, { role: "TRAINER" })
    ).toBe("/(trainer)/checkin?sessionId=booking-42&source=push");
  });

  it("accepts the member invite route and rejects legacy payload formats", async () => {
    const { resolveNotificationHref } = await import("@/lib/push");

    expect(resolveNotificationHref(
      { href: "/(auth)/invite-accept?token=safe-token", role: "MEMBER" },
      { role: "MEMBER" }
    )).toBe("/(auth)/invite-accept?token=safe-token");
    expect(resolveNotificationHref({ href: "fizyoflow://member/package", role: "MEMBER" }, { role: "MEMBER" })).toBeNull();
    expect(resolveNotificationHref({ path: "/(member)/package", role: "MEMBER" }, { role: "MEMBER" })).toBeNull();
    expect(resolveNotificationHref({ role: "MEMBER", screen: "PACKAGE" }, { role: "MEMBER" })).toBeNull();
  });

  it("rejects role mismatch and unsafe paths", async () => {
    const { resolveNotificationHref } = await import("@/lib/push");

    expect(resolveNotificationHref({ href: "/(member)/package", role: "MEMBER" }, { role: "ADMIN" })).toBeNull();
    expect(resolveNotificationHref({ href: "/(admin)/approvals", role: "MEMBER" }, { role: "MEMBER" })).toBeNull();
    expect(resolveNotificationHref({ href: "/(member)/../admin", role: "MEMBER" }, { role: "MEMBER" })).toBeNull();
    expect(resolveNotificationHref({ href: "/(member)/unknown-screen", role: "MEMBER" }, { role: "MEMBER" })).toBeNull();
  });
});
