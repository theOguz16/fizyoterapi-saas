import { extractSalonSlugFromQrPayload } from "./salon-qr";

type IncomingLinkOptions = {
  allowE2E?: boolean;
};

export type IncomingLinkAction =
  | { type: "internal"; href: string }
  | { type: "salon"; slug: string }
  | { type: "none" };

const ROUTE_GROUP_PATTERN = /^\([a-z0-9-]+\)$/i;

export function resolveInternalHrefFromIncomingUrl(
  rawUrl: string | null | undefined,
  options: IncomingLinkOptions = {}
) {
  const normalized = String(rawUrl || "").trim();
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    if (url.protocol !== "fizyoflow:") return null;

    const host = String(url.hostname || "").trim().toLowerCase();
    const pathname = normalizePathname(url.pathname);

    if (host === "join" || pathname.startsWith("/join/")) return null;
    if (host === "salons" || pathname.startsWith("/salons/")) return null;

    const routePath = ROUTE_GROUP_PATTERN.test(host)
      ? `/${host}${pathname === "/" ? "" : pathname}`
      : pathname !== "/"
        ? pathname
        : host
          ? `/${host}`
          : "";

    if (!routePath) return null;
    if ((routePath === "/e2e-login" || routePath === "/e2e-reset") && !options.allowE2E) return null;

    return `${routePath}${url.search}`;
  } catch {
    return null;
  }
}

export function resolveIncomingLinkAction(
  rawUrl: string | null | undefined,
  options: IncomingLinkOptions = {}
): IncomingLinkAction {
  const internalHref = resolveInternalHrefFromIncomingUrl(rawUrl, options);
  if (internalHref) {
    return { type: "internal", href: internalHref };
  }

  const salonSlug = extractSalonSlugFromQrPayload(String(rawUrl || ""));
  if (salonSlug) {
    return { type: "salon", slug: salonSlug };
  }

  return { type: "none" };
}

function normalizePathname(value: string) {
  const pathname = String(value || "").trim();
  if (!pathname || pathname === "/") return "/";
  return `/${pathname.replace(/^\/+/, "")}`;
}
