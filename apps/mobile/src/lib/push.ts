// Bu helper modulu mobil tarafta push ile ilgili veri donusumu, is kurali veya API erisimini toplar.
// Ekranlar ham ayrintilar yerine bu dosyadaki yardimcilari kullanarak daha yalniz kalir.
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { PushDeepLinkHref, SessionRole } from "@fitnes-saas/contracts";
import { httpRequest } from "./http-client";

export type PushPermissionStatus = "granted" | "denied" | "undetermined";

type NotificationPayload = Record<string, unknown>;
type NotificationRouteContext = {
  role?: string | null;
};

type RegisterResult = {
  token: string | null;
};

const CANONICAL_PUSH_PATHS: Record<SessionRole, ReadonlySet<string>> = {
  ADMIN: new Set(["/(admin)/approvals", "/(admin)/calendar", "/(admin)/subscription"]),
  TRAINER: new Set(["/(trainer)/bookings", "/(trainer)/calendar", "/(trainer)/checkin", "/(trainer)/group-classes"]),
  MEMBER: new Set([
    "/(member)/attendance",
    "/(member)/bookings",
    "/(member)/calendar",
    "/(member)/campaigns",
    "/(member)/group-classes",
    "/(member)/home",
    "/(member)/package",
    "/(member)/referrals",
  ]),
};

function normalizePermissionStatus(status: Notifications.PermissionStatus | string | undefined): PushPermissionStatus {
  if (status === "granted" || status === "denied") {
    return status;
  }
  return "undetermined";
}

function normalizeRole(value: unknown): SessionRole | null {
  const role = String(value || "").trim().toUpperCase();
  return role === "ADMIN" || role === "TRAINER" || role === "MEMBER" ? role : null;
}

function resolveCanonicalPushHref(role: SessionRole, value: unknown): PushDeepLinkHref | null {
  const href = typeof value === "string" ? value.trim() : "";
  if (
    !/^\/\((admin|trainer|member|auth)\)\/[a-z0-9][a-z0-9/_%-]*(?:\?[^#\s]*)?$/i.test(href) ||
    href.includes("#") ||
    href.includes("\\") ||
    href.includes("..") ||
    href.includes("://")
  ) return null;

  try {
    const parsed = new URL(href, "https://push.fizyoflow.local");
    const isRoleRoute = CANONICAL_PUSH_PATHS[role].has(parsed.pathname);
    const isMemberInviteRoute = role === "MEMBER" && parsed.pathname === "/(auth)/invite-accept";
    if (parsed.origin !== "https://push.fizyoflow.local" || (!isRoleRoute && !isMemberInviteRoute)) return null;
    return href as PushDeepLinkHref;
  } catch {
    return null;
  }
}

export function resolveNotificationHref(payload: unknown, context: NotificationRouteContext = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const data = payload as NotificationPayload;
  const role = normalizeRole(data.role);
  const activeRole = normalizeRole(context.role);
  if (!role || (activeRole && activeRole !== role)) return null;
  return resolveCanonicalPushHref(role, data.href);
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
