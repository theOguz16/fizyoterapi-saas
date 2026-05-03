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

  it("resolves explicit href payloads with query params", async () => {
    const { resolveNotificationHref } = await import("@/lib/push");

    expect(
      resolveNotificationHref({
        href: "/(trainer)/checkin",
        params: { sessionId: "booking-1", source: "push" },
      })
    ).toBe("/(trainer)/checkin?sessionId=booking-1&source=push");
  });

  it("resolves trainer booking notifications to check-in", async () => {
    const { resolveNotificationHref } = await import("@/lib/push");

    expect(
      resolveNotificationHref(
        {
          role: "TRAINER",
          entity: "BOOKING",
          booking_id: "booking-42",
        },
        { role: "TRAINER" }
      )
    ).toBe("/(trainer)/checkin?sessionId=booking-42");
  });

  it("resolves member measurement notifications to detail screen", async () => {
    const { resolveNotificationHref } = await import("@/lib/push");

    expect(
      resolveNotificationHref(
        {
          role: "MEMBER",
          screen: "MEASUREMENT_DETAIL",
          measurement_id: "measure-9",
        },
        { role: "MEMBER", onboardingState: "ACTIVE_SALON" }
      )
    ).toBe("/(member)/measurement/measure-9");
  });

  it("falls back to admin home when payload has no specific target", async () => {
    const { resolveNotificationHref } = await import("@/lib/push");

    expect(resolveNotificationHref({ role: "ADMIN" }, { role: "ADMIN", onboardingState: "NO_CLINIC" })).toBe(
      "/(admin)/salon/setup"
    );
  });
});
