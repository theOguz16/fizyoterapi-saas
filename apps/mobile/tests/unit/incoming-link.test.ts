import { describe, expect, it } from "vitest";
import { resolveInternalHrefFromIncomingUrl } from "@/lib/incoming-link";

describe("incoming mobile links", () => {
  it("normalizes current and legacy route-group links", () => {
    expect(resolveInternalHrefFromIncomingUrl("fizyoflow:///(member)/package")).toBe("/(member)/package");
    expect(resolveInternalHrefFromIncomingUrl("fizyoflow://(member)/package?tab=active")).toBe("/(member)/package?tab=active");
  });

  it("leaves salon join links for the salon onboarding handler", () => {
    expect(resolveInternalHrefFromIncomingUrl("fizyoflow://join/demo-salon")).toBeNull();
    expect(resolveInternalHrefFromIncomingUrl("fizyoflow:///salons/demo-salon")).toBeNull();
  });

  it("only exposes test routes when the E2E build flag is enabled", () => {
    expect(resolveInternalHrefFromIncomingUrl("fizyoflow://e2e-reset")).toBeNull();
    expect(resolveInternalHrefFromIncomingUrl("fizyoflow://e2e-reset", { allowE2E: true })).toBe("/e2e-reset");
  });
});
