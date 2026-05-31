import * as Application from "expo-application";
import Constants from "expo-constants";
import * as Sentry from "@sentry/react-native";
import type { SessionUser } from "@/lib/mobile-api";

let initialized = false;

function readDsn() {
  return String(process.env.EXPO_PUBLIC_SENTRY_DSN || "").trim();
}

function readEnvironment() {
  return String(process.env.EXPO_PUBLIC_APP_ENV || process.env.NODE_ENV || "development").trim();
}

function buildRelease() {
  const appId = Application.applicationId || Constants.expoConfig?.slug || "fizyoflow-mobile";
  const version = Application.nativeApplicationVersion || Constants.expoConfig?.version || "0.0.0";
  const build = Application.nativeBuildVersion || "dev";
  return `${appId}@${version}+${build}`;
}

function readSampleRate(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 0) return 0;
  if (parsed > 1) return 1;
  return parsed;
}

export function initMobileSentry() {
  if (initialized) return initialized;

  const dsn = readDsn();
  if (!dsn) return false;

  Sentry.init({
    dsn,
    enabled: true,
    environment: readEnvironment(),
    release: buildRelease(),
    dist: Application.nativeBuildVersion || undefined,
    sendDefaultPii: false,
    enableAutoSessionTracking: true,
    tracesSampleRate: readSampleRate(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE, 0),
    profilesSampleRate: readSampleRate(process.env.EXPO_PUBLIC_SENTRY_PROFILES_SAMPLE_RATE, 0),
  });

  initialized = true;
  return initialized;
}

export function isMobileSentryEnabled() {
  return initialized;
}

export function wrapMobileRoot<T>(component: T): T {
  return initialized ? (Sentry.wrap(component as any) as T) : component;
}

export function captureMobileException(error: unknown, context?: Record<string, unknown>) {
  if (!initialized) return;
  Sentry.captureException(error, {
    extra: context,
  });
}

export function setSentryUserContext(user: SessionUser | null | undefined) {
  if (!initialized) return;

  if (!user) {
    Sentry.setUser(null);
    Sentry.setTag("role", undefined);
    Sentry.setTag("tenant_id", undefined);
    Sentry.setTag("tenant_slug", undefined);
    return;
  }

  Sentry.setUser({ id: user.id });
  Sentry.setTag("role", String(user.role || "UNKNOWN"));
  Sentry.setTag("tenant_id", user.tenantId || "none");
  Sentry.setTag("tenant_slug", user.tenantSlug || "none");
}
