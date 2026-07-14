export type JoinRedirectOptions = {
  salonSlug: string;
  iosStoreUrl?: string;
  androidStoreUrl?: string;
};

export function buildJoinDeepLink(salonSlug: string) {
  return `fizyoflow://(intake-member)/salons/${encodeURIComponent(String(salonSlug || "").trim())}`;
}

export function resolveJoinStoreUrl(userAgent: string, iosStoreUrl: string, androidStoreUrl: string) {
  return userAgent.toLowerCase().includes("android") ? androidStoreUrl : iosStoreUrl;
}

export function resolveJoinRedirect({ salonSlug, iosStoreUrl, androidStoreUrl }: JoinRedirectOptions) {
  const normalizedSlug = String(salonSlug || "").trim();
  const deepLink = buildJoinDeepLink(normalizedSlug);
  return {
    salonSlug: normalizedSlug,
    deepLink,
    iosStoreUrl: iosStoreUrl?.trim() || deepLink,
    androidStoreUrl: androidStoreUrl?.trim() || deepLink,
  };
}
