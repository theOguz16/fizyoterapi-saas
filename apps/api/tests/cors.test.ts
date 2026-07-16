import { describe, expect, it } from "vitest";
import { resolveCorsPolicyDecision } from "../app";

const productionPolicy = (origin: string | undefined, pathname: string, corsOrigin?: string) =>
  resolveCorsPolicyDecision({
    origin,
    pathname,
    nodeEnv: "production",
    corsOrigin,
  });

describe("API CORS policy", () => {
  it("allows only a production origin explicitly listed in CORS_ORIGIN", () => {
    expect(
      productionPolicy(
        "https://app.fizyoflow.com",
        "/health",
        "https://app.fizyoflow.com, https://fizyoflow.com"
      )
    ).toEqual({ allowed: true, credentials: true, source: "explicit" });
  });

  it("rejects an unlisted production subdomain outside the public API", () => {
    expect(
      productionPolicy(
        "https://preview.fizyoflow.com",
        "/health",
        "https://app.fizyoflow.com,https://fizyoflow.com"
      )
    ).toEqual({ allowed: false, credentials: false, source: "denied" });
  });

  it("allows a clinic subdomain only on the public API without credentials", () => {
    expect(
      productionPolicy(
        "https://atlas-fizyo.fizyoflow.com",
        "/api/public/salons/atlas-fizyo/events",
        "https://app.fizyoflow.com,https://fizyoflow.com"
      )
    ).toEqual({ allowed: true, credentials: false, source: "public-clinic" });
  });

  it("rejects the same clinic subdomain on auth, admin, billing and internal surfaces", () => {
    for (const pathname of [
      "/api/auth/login",
      "/api/admin/tenants",
      "/api/billing/subscription",
      "/api/internal/jobs",
    ]) {
      expect(
        productionPolicy(
          "https://atlas-fizyo.fizyoflow.com",
          pathname,
          "https://app.fizyoflow.com,https://fizyoflow.com"
        )
      ).toEqual({ allowed: false, credentials: false, source: "denied" });
    }
  });

  it("keeps an explicitly listed app origin credentialed on the public API", () => {
    expect(
      productionPolicy(
        "https://app.fizyoflow.com",
        "/api/public/salons/atlas-fizyo/events",
        "https://app.fizyoflow.com"
      )
    ).toEqual({ allowed: true, credentials: true, source: "explicit" });
  });

  it.each([
    "http://atlas-fizyo.fizyoflow.com",
    "https://atlas-fizyo.fizyoflow.com:444",
    "https://nested.atlas-fizyo.fizyoflow.com",
    "https://user@atlas-fizyo.fizyoflow.com",
    "https://app.fizyoflow.com",
  ])("rejects an unsafe or reserved dynamic public origin: %s", (origin) => {
    expect(
      productionPolicy(origin, "/api/public/salons/atlas-fizyo/events", "https://fizyoflow.com")
    ).toEqual({ allowed: false, credentials: false, source: "denied" });
  });

  it("selects credentialed policy for an explicitly listed auth preflight origin", () => {
    expect(
      productionPolicy("https://app.fizyoflow.com", "/api/auth/login", "https://app.fizyoflow.com")
    ).toEqual({ allowed: true, credentials: true, source: "explicit" });
  });

  it("keeps localhost defaults outside production", () => {
    expect(
      resolveCorsPolicyDecision({
        origin: "http://localhost:3939",
        pathname: "/health",
        nodeEnv: "development",
      })
    ).toEqual({ allowed: true, credentials: true, source: "explicit" });
  });

  it.each([undefined, "", "   "])("fails closed when production CORS_ORIGIN is %s", (corsOrigin) => {
    expect(productionPolicy("https://fizyoflow.com", "/health", corsOrigin)).toEqual({
      allowed: false,
      credentials: false,
      source: "denied",
    });
    expect(
      productionPolicy("https://atlas-fizyo.fizyoflow.com", "/api/public/salons/atlas-fizyo/events", corsOrigin)
    ).toEqual({ allowed: false, credentials: false, source: "denied" });
  });

  it("allows native and server calls without an Origin header", () => {
    expect(productionPolicy(undefined, "/health")).toEqual({
      allowed: true,
      credentials: true,
      source: "no-origin",
    });
  });

  it("rejects an unlisted auth preflight origin", () => {
    expect(
      productionPolicy("https://evil.example.com", "/api/auth/login", "https://app.fizyoflow.com")
    ).toEqual({ allowed: false, credentials: false, source: "denied" });
  });
});
