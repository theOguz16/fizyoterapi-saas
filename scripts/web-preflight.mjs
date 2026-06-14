import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.cwd().endsWith("/apps/web") ? path.resolve(process.cwd(), "../..") : process.cwd();
const webDir = path.join(root, "apps/web");

function requireFile(relativePath) {
  const fullPath = path.join(webDir, relativePath);
  assert.ok(fs.existsSync(fullPath), `Missing required web file: ${relativePath}`);
  return fullPath;
}

function requireSourceContains(relativePath, pattern, label) {
  const fullPath = requireFile(relativePath);
  const source = fs.readFileSync(fullPath, "utf8");
  assert.ok(pattern.test(source), `Missing required web source signal: ${label || pattern}`);
}

function assertHttpsUrl(name, value, { requireApiPath = false } = {}) {
  assert.ok(value, `${name} is required`);
  const url = new URL(value);
  assert.equal(url.protocol, "https:", `${name} must use https`);
  assert.ok(!["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname), `${name} cannot point to localhost`);
  if (requireApiPath) {
    assert.ok(url.pathname.replace(/\/$/, "").endsWith("/api"), `${name} must include /api path`);
  }
  return url;
}

function subdomainForHost(hostname) {
  const host = hostname.split(":")[0].trim().toLowerCase();
  if (host.endsWith(".fizyoflow.com")) return host.replace(".fizyoflow.com", "");
  if (host.endsWith(".localhost")) return host.replace(".localhost", "");
  return "";
}

function resolveRoute(hostname, pathname) {
  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.includes(".")) return { type: "next" };
  if (["fizyoflow.com", "www.fizyoflow.com", "localhost", "127.0.0.1"].includes(hostname)) return { type: "next" };
  const reserved = new Set(["admin", "api", "app", "assets", "cdn", "mail", "status", "support", "www"]);
  const subdomain = subdomainForHost(hostname);
  if (subdomain === "app") return { type: "redirect", pathname: pathname === "/" ? "/login" : pathname };
  if (!subdomain || reserved.has(subdomain)) return { type: "next" };
  return { type: "rewrite", pathname: `/${subdomain}${pathname === "/" ? "" : pathname}` };
}

function assertMiddlewareCases() {
  assert.deepEqual(resolveRoute("demo-salon.fizyoflow.com", "/"), { type: "rewrite", pathname: "/demo-salon" });
  assert.deepEqual(resolveRoute("demo-salon.fizyoflow.com", "/hizmetler"), { type: "rewrite", pathname: "/demo-salon/hizmetler" });
  assert.deepEqual(resolveRoute("demo-salon.localhost", "/"), { type: "rewrite", pathname: "/demo-salon" });
  assert.deepEqual(resolveRoute("app.fizyoflow.com", "/"), { type: "redirect", pathname: "/login" });
  assert.deepEqual(resolveRoute("api.fizyoflow.com", "/health"), { type: "next" });
  assert.deepEqual(resolveRoute("fizyoflow.com", "/"), { type: "next" });
}

function main() {
  requireFile("app/page.tsx");
  requireFile("app/[salonSlug]/page.tsx");
  requireFile("app/join/[salonSlug]/page.tsx");
  requireFile("app/sitemap.ts");
  requireFile("app/robots.ts");
  requireFile("app/gizlilik-politikasi/page.tsx");
  requireFile("app/kvkk/page.tsx");
  requireFile("app/kullanim-sartlari/page.tsx");
  requireFile("app/cerez-politikasi/page.tsx");
  requireFile("app/tesekkurler/page.tsx");
  requireFile("public/brand/fizyoflow-og.svg");
  requireFile("public/llms.txt");
  requireFile("public/llms-full.txt");
  requireSourceContains("app/page.tsx", /Fizyoflow nedir\?/, "home product explanation");
  requireSourceContains("app/page.tsx", /OperationalFlowSection/, "home clinic flow section");
  requireSourceContains("app/page.tsx", /Gerçek ürün ekranları/, "home product screen gallery");
  requireSourceContains("app/page.tsx", /Güven ve kontrol/, "home trust section");
  requireSourceContains("app/page.tsx", /FAQPage/, "home FAQ structured data");
  requireSourceContains("components/brand-lockup.tsx", /fizyoflow-mark\.svg/, "shared vector brand lockup");
  requireSourceContains("components/marketing-link.tsx", /trackMarketingEvent/, "marketing CTA analytics");
  requireSourceContains("app/robots.ts", /OAI-SearchBot/, "AI search crawler access");
  requireSourceContains("app/[salonSlug]/page.tsx", /Telefonla Bilgi Al/, "clinic phone fallback CTA");
  requireSourceContains("app/[salonSlug]/page.tsx", /Bu hizmet için bilgi al/, "clinic service WhatsApp CTA");
  requireSourceContains("app/[salonSlug]/page.tsx", /Bugün açık olabilir/, "clinic open status signal");
  requireSourceContains("app/[salonSlug]/page.tsx", /SectionViewTracker/, "clinic section view tracking");
  requireSourceContains("app/[salonSlug]/page.tsx", /ScrollDepthTracker/, "clinic scroll depth tracking");
  requireSourceContains("app/[salonSlug]/page.tsx", /data-track-section="location"/, "clinic location section");
  requireSourceContains("app/[salonSlug]/page.tsx", /LocalBusiness/, "clinic LocalBusiness structured data");
  requireSourceContains("components/public-event.tsx", /utm_source/, "clinic UTM attribution tracking");
  requireSourceContains("components/demo-lead-form.tsx", /primary_need/, "demo form lead qualification");
  requireSourceContains("components/lead-form.tsx", /Sonraki adım/, "clinic lead next-step state");

  if (process.env.WEB_PREFLIGHT_STRICT === "1") {
    assertHttpsUrl("NEXT_PUBLIC_WEB_BASE_URL", process.env.NEXT_PUBLIC_WEB_BASE_URL || "https://fizyoflow.com");
    assertHttpsUrl("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL || "https://app.fizyoflow.com");
    assertHttpsUrl("NEXT_PUBLIC_API_BASE", process.env.NEXT_PUBLIC_API_BASE || "https://api.fizyoflow.com/api", { requireApiPath: true });
    const iosUrl = process.env.NEXT_PUBLIC_IOS_APP_URL || process.env.NEXT_PUBLIC_APP_STORE_URL;
    const androidUrl = process.env.NEXT_PUBLIC_ANDROID_APP_URL || process.env.NEXT_PUBLIC_PLAY_STORE_URL;
    if (iosUrl) assertHttpsUrl("NEXT_PUBLIC_IOS_APP_URL/NEXT_PUBLIC_APP_STORE_URL", iosUrl);
    if (androidUrl) assertHttpsUrl("NEXT_PUBLIC_ANDROID_APP_URL/NEXT_PUBLIC_PLAY_STORE_URL", androidUrl);
  }

  assertMiddlewareCases();
  console.log(JSON.stringify({ event: "web_preflight_passed", strict: process.env.WEB_PREFLIGHT_STRICT === "1" }));
}

main();
