import { describe, expect, it } from "vitest";
import { validateMobileReleaseEnv } from "../../src/lib/release-env";

describe("mobile release env", () => {
  it("rejects missing api base", () => {
    expect(() => validateMobileReleaseEnv({} as NodeJS.ProcessEnv)).toThrow(/EXPO_PUBLIC_API_BASE/);
  });

  it("rejects localhost api base", () => {
    expect(() =>
      validateMobileReleaseEnv({
        EXPO_PUBLIC_API_BASE: "http://localhost:4949/api",
        EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: "ios-key",
        EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: "android-key",
      } as NodeJS.ProcessEnv)
    ).toThrow(/https/);
  });

  it("accepts strict release config", () => {
    expect(
      validateMobileReleaseEnv({
        EXPO_PUBLIC_API_BASE: "https://api.example.com/api",
        EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: "ios-key",
        EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: "android-key",
        EXPO_PUBLIC_DETOUR_API_KEY: "detour-key",
        EXPO_PUBLIC_DETOUR_APP_ID: "detour-app",
      } as NodeJS.ProcessEnv)
    ).toEqual({
      ok: true,
      api_base: "https://api.example.com/api",
      platform: "all",
      revenuecat_checked: true,
      detour_configured: true,
      sentry_configured: false,
      sentry_source_maps_configured: false,
    });
  });

  it("can validate non-RevenueCat release readiness", () => {
    expect(
      validateMobileReleaseEnv({
        EXPO_PUBLIC_API_BASE: "https://api.example.com/api",
        MOBILE_RELEASE_SKIP_REVENUECAT: "true",
      } as NodeJS.ProcessEnv)
    ).toMatchObject({
      ok: true,
      revenuecat_checked: false,
    });
  });

  it("accepts Sentry runtime and source map configuration", () => {
    expect(
      validateMobileReleaseEnv({
        EXPO_PUBLIC_API_BASE: "https://api.example.com/api",
        EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: "ios-key",
        EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: "android-key",
        EXPO_PUBLIC_SENTRY_DSN: "https://public@sentry.example.com/123",
        SENTRY_ORG: "fizyoflow",
        SENTRY_PROJECT: "mobile",
      } as NodeJS.ProcessEnv)
    ).toMatchObject({
      sentry_configured: true,
      sentry_source_maps_configured: true,
    });
  });

  it("rejects partial Sentry source map configuration", () => {
    expect(() =>
      validateMobileReleaseEnv({
        EXPO_PUBLIC_API_BASE: "https://api.example.com/api",
        EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: "ios-key",
        EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: "android-key",
        SENTRY_ORG: "fizyoflow",
      } as NodeJS.ProcessEnv)
    ).toThrow(/SENTRY_ORG/);
  });
});
