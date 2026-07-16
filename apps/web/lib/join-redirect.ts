export type JoinRedirectOptions = {
  salonSlug: string;
  salonCode?: string;
  iosStoreUrl?: string;
  androidStoreUrl?: string;
};

const JOIN_CODE_PATTERN = /^[a-z0-9_-]{1,128}$/i;

export function normalizeJoinCode(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  return JOIN_CODE_PATTERN.test(normalized) ? normalized : "";
}

export function normalizeJoinSlug(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "");
}

export function buildJoinDeepLink(salonSlug: string, salonCode?: string) {
  const normalizedSlug = normalizeJoinSlug(salonSlug);
  const normalizedCode = normalizeJoinCode(salonCode);
  const query = normalizedCode ? `?code=${encodeURIComponent(normalizedCode)}` : "";
  return `fizyoflow://join/${encodeURIComponent(normalizedSlug)}${query}`;
}

export function resolveJoinStoreUrl(userAgent: string, iosStoreUrl: string, androidStoreUrl: string) {
  return userAgent.toLowerCase().includes("android") ? androidStoreUrl : iosStoreUrl;
}

function normalizeStoreUrl(value: string | undefined, platform: "ios" | "android") {
  const normalized = String(value || "").trim();
  if (!normalized) return "";

  try {
    const url = new URL(normalized);
    const isIosListing =
      platform === "ios" &&
      url.protocol === "https:" &&
      url.hostname === "apps.apple.com" &&
      url.pathname.split("/").some((segment) => /^id\d+$/.test(segment));
    const isAndroidListing =
      platform === "android" &&
      url.protocol === "https:" &&
      url.hostname === "play.google.com" &&
      url.pathname === "/store/apps/details" &&
      Boolean(url.searchParams.get("id"));
    return isIosListing || isAndroidListing ? normalized : "";
  } catch {
    return "";
  }
}

export function resolveJoinRedirect({ salonSlug, salonCode, iosStoreUrl, androidStoreUrl }: JoinRedirectOptions) {
  const normalizedSlug = normalizeJoinSlug(salonSlug);
  const normalizedCode = normalizeJoinCode(salonCode);
  const deepLink = buildJoinDeepLink(normalizedSlug, normalizedCode);
  return {
    salonSlug: normalizedSlug,
    salonCode: normalizedCode,
    deepLink,
    iosStoreUrl: normalizeStoreUrl(iosStoreUrl, "ios") || deepLink,
    androidStoreUrl: normalizeStoreUrl(androidStoreUrl, "android") || deepLink,
  };
}
