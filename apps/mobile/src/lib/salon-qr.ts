export function extractSalonSlugFromQrPayload(input: string): string | null {
  const raw = String(input || "").trim();
  if (!raw) return null;

  const urlSlug = readSlugFromUrlLikeValue(raw);
  if (urlSlug) return urlSlug;

  if (looksLikeNavigationDeepLink(raw)) {
    return null;
  }

  const codeSlug = readSlugFromClinicCode(raw);
  if (codeSlug) return codeSlug;

  return null;
}

function readSlugFromUrlLikeValue(value: string): string | null {
  try {
    const url = new URL(value);

    const querySlug = normalizeSlug(url.searchParams.get("salon_slug"));
    if (querySlug) return querySlug;

    const screenPathSlug = normalizeSlug(matchScreenPathSlug(url.searchParams.get("screen_path")));
    if (screenPathSlug) return screenPathSlug;

    const webJoinPathSlug = normalizeSlug(matchJoinSlug(url.searchParams.get("web_join_path")));
    if (webJoinPathSlug) return webJoinPathSlug;

    const deepLinkPathSlug = normalizeSlug(matchJoinSlug(url.searchParams.get("$deeplink_path")));
    if (deepLinkPathSlug) return deepLinkPathSlug;

    const fallbackUrlSlug: string | null = readSlugFromNestedUrl(url.searchParams.get("$fallback_url"));
    if (fallbackUrlSlug) return fallbackUrlSlug;

    const desktopUrlSlug: string | null = readSlugFromNestedUrl(url.searchParams.get("$desktop_url"));
    if (desktopUrlSlug) return desktopUrlSlug;

    const joinSlug = normalizeSlug(matchJoinSlug(url.pathname));
    if (joinSlug) return joinSlug;

    const customJoinSlug = normalizeSlug(matchJoinSlug(`/${url.hostname}${url.pathname}`));
    if (customJoinSlug) return customJoinSlug;

    const directSalonSlug = normalizeSlug(matchDirectSalonSlug(url.pathname));
    if (directSalonSlug) return directSalonSlug;

    const customDirectSalonSlug = normalizeSlug(matchDirectSalonSlug(`/${url.hostname}${url.pathname}`));
    if (customDirectSalonSlug) return customDirectSalonSlug;
  } catch {
    const joinSlug = normalizeSlug(matchJoinSlug(value));
    if (joinSlug) return joinSlug;

    const directSalonSlug = normalizeSlug(matchDirectSalonSlug(value));
    if (directSalonSlug) return directSalonSlug;

    const screenPathSlug = normalizeSlug(matchScreenPathSlug(value));
    if (screenPathSlug) return screenPathSlug;
  }

  return null;
}

function readSlugFromNestedUrl(value: string | null | undefined): string | null {
  const decoded = safeDecode(value);
  if (!decoded) return null;

  return readSlugFromUrlLikeValue(decoded);
}

function readSlugFromClinicCode(value: string): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const normalizedCode = raw.replace(/^CLN-/i, "");
  const codeParts = normalizedCode.split("-").filter(Boolean);

  if (codeParts.length < 2) return null;

  return normalizeSlug(codeParts.slice(0, -1).join("-"));
}

function matchJoinSlug(value: string | null | undefined): string | null {
  const decoded = safeDecode(value);
  const match = decoded.match(/\/join\/([^/?#]+)/i);

  return match?.[1] || null;
}

function matchScreenPathSlug(value: string | null | undefined): string | null {
  const decoded = safeDecode(value);
  const match = decoded.match(/\/salons\/([^/?#]+)/i);

  return match?.[1] || null;
}

function matchDirectSalonSlug(value: string | null | undefined): string | null {
  const decoded = safeDecode(value);
  const match = decoded.match(/\/salons\/([^/?#]+)/i);

  return match?.[1] || null;
}

function looksLikeNavigationDeepLink(value: string): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return false;

  return normalized.includes("://") || normalized.includes("?") || normalized.includes("/");
}

function safeDecode(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function normalizeSlug(value: string | null | undefined): string | null {
  const normalized = String(value || "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();

  if (!normalized) return null;

  const safeSlug = normalized.replace(/[^a-z0-9-_]/g, "");
  return safeSlug || null;
}