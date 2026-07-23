import { describe, expect, it } from "vitest";
import { resolveIncomingLinkAction, resolveInternalHrefFromIncomingUrl } from "@/lib/incoming-link";

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
    expect(resolveInternalHrefFromIncomingUrl("fizyoflow://e2e-connectivity?status=offline")).toBeNull();
    expect(resolveInternalHrefFromIncomingUrl("fizyoflow://e2e-reset", { allowE2E: true })).toBe("/e2e-reset");
    expect(resolveInternalHrefFromIncomingUrl("fizyoflow://e2e-connectivity?status=offline", { allowE2E: true })).toBe(
      "/e2e-connectivity?status=offline"
    );
  });

  it("classifies internal routes, salon links and invalid input for the root hook", () => {
    expect(resolveIncomingLinkAction("fizyoflow:///(member)/calendar")).toEqual({
      type: "internal",
      href: "/(member)/calendar",
    });
    expect(resolveIncomingLinkAction("fizyoflow://join/demo-salon")).toEqual({
      type: "salon",
      slug: "demo-salon",
    });
    expect(resolveIncomingLinkAction("fizyoflow://join/demo-salon?code=FYF-DEMO_001")).toEqual({
      type: "salon",
      slug: "demo-salon",
      code: "FYF-DEMO_001",
    });
    expect(resolveIncomingLinkAction("https://fizyoflow.com/join/demo-salon?code=FYF-DEMO_001")).toEqual({
      type: "salon",
      slug: "demo-salon",
      code: "FYF-DEMO_001",
    });
    expect(resolveIncomingLinkAction("fizyoflow://join/demo-salon?code=unsafe%20code%2Fvalue")).toEqual({
      type: "salon",
      slug: "demo-salon",
    });
    expect(resolveIncomingLinkAction("https://example.com/unrelated")).toEqual({ type: "none" });
  });

  it("keeps E2E action classification behind the build flag", () => {
    expect(resolveIncomingLinkAction("fizyoflow://e2e-reset")).toEqual({ type: "none" });
    expect(resolveIncomingLinkAction("fizyoflow://e2e-reset", { allowE2E: true })).toEqual({
      type: "internal",
      href: "/e2e-reset",
    });
  });
});
