import { describe, expect, it } from "vitest";
import { resolveAdminHome, resolveBackNavigation, resolveIndexRedirect, resolveMemberHome, resolveRoleGroup, resolveRoleHome } from "@/lib/navigation";

describe("mobile navigation rules", () => {
  it("routes admins to onboarding or dashboard depending on lifecycle state", () => {
    expect(resolveAdminHome("NO_CLINIC")).toBe("/(admin)/salon/setup");
    expect(resolveAdminHome("CLINIC_READ_ONLY")).toBe("/(admin)/subscription");
    expect(resolveAdminHome("PENDING_CLINIC_REVIEW")).toBe("/(admin)/dashboard");
    expect(resolveAdminHome("ACTIVE_SALON")).toBe("/(admin)/dashboard");
  });

  it("routes members to setup flows before active salon state", () => {
    expect(resolveMemberHome("PACKAGE_SELECTION_REQUIRED")).toBe("/(intake-member)/packages");
    expect(resolveMemberHome("DAY_SELECTION_REQUIRED")).toBe("/(intake-member)/time-selection");
    expect(resolveMemberHome("PAYMENT_PENDING")).toBe("/(intake-member)/approval-pending");
    expect(resolveMemberHome("ACTIVE_SALON")).toBe("/(member)/home");
  });

  it("returns correct route groups for each role", () => {
    expect(resolveRoleGroup("ADMIN", "NO_CLINIC")).toBe("(admin)");
    expect(resolveRoleGroup("TRAINER", "NO_SALON")).toBe("(shared)");
    expect(resolveRoleGroup("TRAINER", "ACTIVE_SALON", { role: "TRAINER" })).toBe("(trainer)");
    expect(resolveRoleGroup("MEMBER", "ACTIVE_SALON")).toBe("(member)");
  });

  it("resolves index redirect from session state", () => {
    expect(resolveIndexRedirect(null, "ACTIVE_SALON", { mobile: true })).toBe("/(auth)/welcome");
    expect(resolveIndexRedirect({ role: "TRAINER" }, "NO_SALON", { mobile: true })).toBe("/(shared)/invite-join");
    expect(resolveIndexRedirect({ role: "TRAINER" }, "ACTIVE_SALON", { mobile: true })).toBe("/(trainer)/home");
    expect(resolveIndexRedirect({ role: "ADMIN" }, "NO_CLINIC", { mobile: true })).toBe("/(admin)/salon/setup");
    expect(resolveIndexRedirect({ role: "ADMIN" }, "CLINIC_READ_ONLY", { mobile: true })).toBe("/(admin)/subscription");
    expect(resolveIndexRedirect({ role: "MEMBER" }, "ACTIVE_SALON", { mobile: false })).toBe("/(auth)/welcome");
  });

  it("resolves role home consistently", () => {
    expect(resolveRoleHome("ADMIN", "ACTIVE_SALON")).toBe("/(admin)/dashboard");
    expect(resolveRoleHome("ADMIN", "CLINIC_READ_ONLY")).toBe("/(admin)/subscription");
    expect(resolveRoleHome("MEMBER", "ACTIVE_SALON")).toBe("/(member)/home");
    expect(resolveRoleHome("MEMBER", "NO_SALON")).toBe("/(intake-member)");
  });

  it("prefers contextual fallback over tab history when a fallback exists", () => {
    expect(resolveBackNavigation(true, "/(admin)/salon")).toEqual({ type: "replace", href: "/(admin)/salon" });
    expect(resolveBackNavigation(false, "/(admin)/salon")).toEqual({ type: "replace", href: "/(admin)/salon" });
    expect(resolveBackNavigation(false, null)).toEqual({ type: "back" });
  });
});
