export type MobileReleasePlatform = "ios" | "android" | "all";

export type MobileReleaseEnvOptions = {
  platform?: MobileReleasePlatform;
};

function requireEnv(env: NodeJS.ProcessEnv, key: string) {
  const value = String(env[key] || "").trim();
  if (!value) {
    throw new Error(`Missing required mobile release env: ${key}`);
  }
  return value;
}

function assertHttpsUrl(name: string, value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }

  if (url.protocol !== "https:") {
    throw new Error(`${name} must use https in release builds`);
  }

  if (["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname)) {
    throw new Error(`${name} cannot point to a local host in release builds`);
  }

  return url;
}

export function validateMobileReleaseEnv(
  env: NodeJS.ProcessEnv = process.env,
  options: MobileReleaseEnvOptions = {}
) {
  const platform = options.platform || "all";
  const skipRevenueCat = String(env.MOBILE_RELEASE_SKIP_REVENUECAT || "").trim() === "true";
  const apiBase = requireEnv(env, "EXPO_PUBLIC_API_BASE");
  const apiUrl = assertHttpsUrl("EXPO_PUBLIC_API_BASE", apiBase);

  if (!apiUrl.pathname.replace(/\/$/, "").endsWith("/api")) {
    throw new Error("EXPO_PUBLIC_API_BASE must include the /api path");
  }

  if (!skipRevenueCat && (platform === "ios" || platform === "all")) {
    requireEnv(env, "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY");
  }

  if (!skipRevenueCat && (platform === "android" || platform === "all")) {
    requireEnv(env, "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY");
  }

  const detourApiKey = String(env.EXPO_PUBLIC_DETOUR_API_KEY || "").trim();
  const detourAppId = String(env.EXPO_PUBLIC_DETOUR_APP_ID || "").trim();
  if ((detourApiKey && !detourAppId) || (!detourApiKey && detourAppId)) {
    throw new Error("EXPO_PUBLIC_DETOUR_API_KEY and EXPO_PUBLIC_DETOUR_APP_ID must be configured together");
  }

  const sentryDsn = String(env.EXPO_PUBLIC_SENTRY_DSN || "").trim();
  if (sentryDsn) {
    assertHttpsUrl("EXPO_PUBLIC_SENTRY_DSN", sentryDsn);
  }

  const sentryOrg = String(env.SENTRY_ORG || "").trim();
  const sentryProject = String(env.SENTRY_PROJECT || "").trim();
  if ((sentryOrg && !sentryProject) || (!sentryOrg && sentryProject)) {
    throw new Error("SENTRY_ORG and SENTRY_PROJECT must be configured together");
  }

  return {
    ok: true,
    api_base: apiUrl.toString().replace(/\/$/, ""),
    platform,
    revenuecat_checked: !skipRevenueCat,
    detour_configured: Boolean(detourApiKey && detourAppId),
    sentry_configured: Boolean(sentryDsn),
    sentry_source_maps_configured: Boolean(sentryOrg && sentryProject),
  };
}
