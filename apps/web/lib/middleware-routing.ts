const DEFAULT_ROOT_DOMAINS = ["fizyoflow.com", "www.fizyoflow.com"];
const DEFAULT_RESERVED_SUBDOMAINS = ["admin", "api", "app", "assets", "cdn", "mail", "status", "support", "www"];

export type MiddlewareRouteDecision =
  | { type: "next" }
  | { type: "redirect"; pathname: string }
  | { type: "rewrite"; pathname: string };

function normalizeHostname(hostname: string) {
  return hostname.split(":")[0]?.trim().toLowerCase() || "";
}

export function getSubdomainForHost(hostnameInput: string, rootDomains = DEFAULT_ROOT_DOMAINS) {
  const hostname = normalizeHostname(hostnameInput);
  if (!hostname) return "";

  for (const rootDomain of rootDomains) {
    const normalizedRoot = normalizeHostname(rootDomain).replace(/^www\./, "");
    if (hostname === normalizedRoot || hostname === `www.${normalizedRoot}`) return "";
    if (hostname.endsWith(`.${normalizedRoot}`)) {
      return hostname.slice(0, -1 * (`.${normalizedRoot}`).length);
    }
  }

  if (hostname.endsWith(".localhost")) {
    return hostname.replace(".localhost", "");
  }

  return "";
}

export function resolveMiddlewareRoute(input: {
  hostname: string;
  pathname: string;
  search?: string;
  rootDomains?: string[];
  reservedSubdomains?: string[];
}): MiddlewareRouteDecision {
  const pathname = input.pathname || "/";
  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.includes(".")) {
    return { type: "next" };
  }

  const hostname = normalizeHostname(input.hostname);
  const rootDomains = input.rootDomains || DEFAULT_ROOT_DOMAINS;
  const reserved = new Set(input.reservedSubdomains || DEFAULT_RESERVED_SUBDOMAINS);
  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1" || rootDomains.map(normalizeHostname).includes(hostname)) {
    return { type: "next" };
  }

  const subdomain = getSubdomainForHost(hostname, rootDomains);
  if (subdomain === "app") {
    return { type: "redirect", pathname: pathname === "/" ? "/login" : pathname };
  }

  if (!subdomain || reserved.has(subdomain)) {
    return { type: "next" };
  }

  return {
    type: "rewrite",
    pathname: `/${subdomain}${pathname === "/" ? "" : pathname}`,
  };
}
