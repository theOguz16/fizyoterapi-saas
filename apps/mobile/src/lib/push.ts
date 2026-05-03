// Bu helper modulu mobil tarafta push ile ilgili veri donusumu, is kurali veya API erisimini toplar.
// Ekranlar ham ayrintilar yerine bu dosyadaki yardimcilari kullanarak daha yalniz kalir.
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { httpRequest } from "./http-client";
import { resolveAdminHome, resolveMemberHome } from "./navigation";

export type PushPermissionStatus = "granted" | "denied" | "undetermined";

type NotificationPayload = Record<string, unknown>;
type NotificationRouteContext = {
  role?: string | null;
  onboardingState?: string | null;
};

type RegisterResult = {
  token: string | null;
};

function normalizePermissionStatus(status: Notifications.PermissionStatus | string | undefined): PushPermissionStatus {
  if (status === "granted" || status === "denied") {
    return status;
  }
  return "undetermined";
}

function pickFirstString(payload: NotificationPayload, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function appendQueryParams(pathname: string, params?: unknown) {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return pathname;
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    query.set(key, String(value));
  }

  const suffix = query.toString();
  return suffix ? `${pathname}?${suffix}` : pathname;
}

export function resolveNotificationHref(payload: unknown, context: NotificationRouteContext = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const data = payload as NotificationPayload;
  const explicitHref = pickFirstString(data, ["href", "path", "pathname", "route"]);
  if (explicitHref?.startsWith("/")) {
    return appendQueryParams(explicitHref, data.params);
  }

  const screen = pickFirstString(data, ["screen", "target_screen", "targetScreen"]);
  const role = (pickFirstString(data, ["role", "target_role", "targetRole"]) || context.role || "").toUpperCase();
  const entity = (pickFirstString(data, ["entity", "resource", "kind"]) || "").toUpperCase();
  const bookingId = pickFirstString(data, ["booking_id", "bookingId", "id"]);
  const memberId = pickFirstString(data, ["member_id", "memberId", "profile_id", "profileId"]);
  const measurementId = pickFirstString(data, ["measurement_id", "measurementId", "record_id", "recordId"]);
  const approvalId = pickFirstString(data, ["approval_id", "approvalId", "application_id", "applicationId", "id"]);

  if (role === "ADMIN") {
    if (screen === "APPROVAL_DETAIL" && approvalId) return `/(admin)/approval/${approvalId}`;
    if (screen === "MEMBER_DETAIL" && memberId) return `/(admin)/members/${memberId}`;
    if (screen === "RISK_PREVIEW") return "/(admin)/dashboard/risk-preview";
    if (screen === "REVENUE_DETAIL") return "/(admin)/dashboard/revenue-detail";
    if (screen === "NOTIFICATIONS") return "/(admin)/notifications";
    if (entity === "APPROVAL" && approvalId) return `/(admin)/approval/${approvalId}`;
    if (entity === "MEMBER" && memberId) return `/(admin)/members/${memberId}`;
    return resolveAdminHome(context.onboardingState);
  }

  if (role === "TRAINER") {
    if (screen === "CHECKIN") {
      return appendQueryParams("/(trainer)/checkin", bookingId ? { sessionId: bookingId } : data.params);
    }
    if (screen === "MEMBER_DETAIL" && memberId) return `/(trainer)/members/${memberId}`;
    if (screen === "CALENDAR") return "/(trainer)/calendar";
    if (screen === "NOTES" && memberId) return appendQueryParams("/(trainer)/notes", { memberId });
    if (entity === "MEMBER" && memberId) return `/(trainer)/members/${memberId}`;
    if (entity === "BOOKING" && bookingId) {
      return appendQueryParams("/(trainer)/checkin", { sessionId: bookingId });
    }
    return "/(trainer)/home";
  }

  if (role === "MEMBER") {
    if (screen === "BOOKING_DETAIL" && bookingId) return `/(member)/booking/${bookingId}`;
    if (screen === "MEASUREMENT_DETAIL" && measurementId) return `/(member)/measurement/${measurementId}`;
    if (screen === "CALENDAR") return "/(member)/calendar";
    if (screen === "PACKAGE") return "/(member)/package";
    if (screen === "PROFILE") return "/(member)/profile";
    if (entity === "BOOKING" && bookingId) return `/(member)/booking/${bookingId}`;
    if (entity === "MEASUREMENT" && measurementId) return `/(member)/measurement/${measurementId}`;
    return resolveMemberHome(context.onboardingState);
  }

  if (screen === "NOTIFICATION_SETTINGS") {
    return "/(shared)/notification-settings";
  }

  return null;
}

export function resolveNotificationResponseHref(
  response: Notifications.NotificationResponse | null | undefined,
  context: NotificationRouteContext = {}
) {
  return resolveNotificationHref(response?.notification?.request?.content?.data, context);
}

async function registerCurrentDevice(): Promise<RegisterResult> {
  if (!Device.isDevice) {
    return { token: null };
  }

  let token: string | null = null;
  try {
    const pushTokenResult = await Notifications.getExpoPushTokenAsync();
    token = pushTokenResult.data;
  } catch {
    return { token: null };
  }

  await httpRequest("/mobile/devices/register", {
    method: "POST",
    body: {
      token,
      platform: Platform.OS === "ios" ? "IOS" : "ANDROID",
    },
  });

  return { token };
}

export async function getPushPermissionStatus(): Promise<PushPermissionStatus> {
  const permission = await Notifications.getPermissionsAsync();
  return normalizePermissionStatus(permission.status);
}

export async function registerPushDeviceIfPermitted(): Promise<RegisterResult> {
  const status = await getPushPermissionStatus();
  if (status !== "granted") {
    return { token: null };
  }
  return registerCurrentDevice();
}

export async function requestPushPermissionAndRegister(): Promise<RegisterResult & { status: PushPermissionStatus }> {
  if (!Device.isDevice) {
    return { token: null, status: "undetermined" };
  }

  const currentStatus = await getPushPermissionStatus();
  if (currentStatus === "granted") {
    const result = await registerCurrentDevice();
    return { ...result, status: "granted" };
  }

  const requested = await Notifications.requestPermissionsAsync();
  const finalStatus = normalizePermissionStatus(requested.status);
  if (finalStatus !== "granted") {
    return { token: null, status: finalStatus };
  }

  const result = await registerCurrentDevice();
  return { ...result, status: finalStatus };
}

export async function registerPushDevice(): Promise<RegisterResult> {
  const result = await requestPushPermissionAndRegister();
  return { token: result.token };
}

export async function unregisterPushDevice(token: string | null | undefined) {
  if (!token) return;
  const encoded = encodeURIComponent(token);
  await httpRequest(`/mobile/devices/${encoded}`, {
    method: "DELETE",
  });
}
