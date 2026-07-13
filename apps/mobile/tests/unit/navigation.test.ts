import { describe, expect, it } from "vitest";
import {
  resolveAdminHome,
  resolveBackNavigation,
  resolveIndexRedirect,
  resolveMemberHome,
  resolvePendingSalonHome,
  resolveRoleGroup,
  resolveRoleHome,
  resolveRootNavigation,
} from "@/lib/navigation";

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

  it("waits for bootstrap state and leaves E2E routes untouched", () => {
    expect(
      resolveRootNavigation({
        loading: true,
        pendingSalonSlug: undefined,
        user: null,
        signupFlowState: "idle",
        segments: [],
      })
    ).toEqual({ type: "none", reason: "BOOTSTRAP_PENDING" });

    expect(
      resolveRootNavigation({
        loading: false,
        pendingSalonSlug: null,
        user: null,
        signupFlowState: "idle",
        segments: ["e2e-login"],
      })
    ).toEqual({ type: "none", reason: "E2E_ROUTE" });
  });

  it("guards unauthenticated routes and preserves the selected signup path", () => {
    expect(
      resolveRootNavigation({
        loading: false,
        pendingSalonSlug: null,
        user: null,
        signupFlowState: "idle",
        segments: ["(admin)", "dashboard"],
      })
    ).toEqual({ type: "replace", href: "/(auth)/welcome", reason: "AUTH_REQUIRED" });

    expect(
      resolveRootNavigation({
        loading: false,
        pendingSalonSlug: null,
        user: null,
        signupFlowState: "post-assessment",
        selectedPersona: "ADMIN",
        segments: ["(auth)", "welcome"],
      })
    ).toEqual({ type: "replace", href: "/(auth)/owner-plan", reason: "SIGNUP_FLOW_GUARD" });
  });

  it("prioritizes mobile access and notification permission guards", () => {
    expect(
      resolveRootNavigation({
        loading: false,
        pendingSalonSlug: null,
        user: { role: "ADMIN" },
        onboardingState: "ACTIVE_SALON",
        mobileAvailable: false,
        signupFlowState: "idle",
        segments: ["(admin)", "dashboard"],
      })
    ).toEqual({ type: "replace", href: "/(auth)/welcome", reason: "MOBILE_SURFACE_DISABLED" });

    expect(
      resolveRootNavigation({
        loading: false,
        pendingSalonSlug: null,
        user: { role: "ADMIN" },
        onboardingState: "ACTIVE_SALON",
        mobileAvailable: true,
        pendingPostAuthScreen: "NOTIFICATION_PERMISSION",
        signupFlowState: "idle",
        segments: ["(auth)", "login"],
      })
    ).toEqual({
      type: "replace",
      href: "/(auth)/notification-permission",
      reason: "NOTIFICATION_PERMISSION_REQUIRED",
    });
  });

  it("allows member connection, purchase and shared utility exceptions", () => {
    const common = {
      loading: false,
      pendingSalonSlug: null,
      mobileAvailable: true,
      signupFlowState: "idle" as const,
    };

    expect(
      resolveRootNavigation({
        ...common,
        user: { role: "MEMBER" },
        onboardingState: "NO_SALON",
        segments: ["(auth)", "scan-salon-qr"],
      })
    ).toEqual({ type: "none", reason: "CURRENT_ROUTE_ALLOWED" });

    expect(
      resolveRootNavigation({
        ...common,
        user: { role: "MEMBER" },
        onboardingState: "ACTIVE_SALON",
        segments: ["(intake-member)", "packages"],
      })
    ).toEqual({ type: "none", reason: "CURRENT_ROUTE_ALLOWED" });

    expect(
      resolveRootNavigation({
        ...common,
        user: { role: "TRAINER" },
        onboardingState: "ACTIVE_SALON",
        segments: ["(shared)", "notification-settings"],
      })
    ).toEqual({ type: "none", reason: "CURRENT_ROUTE_ALLOWED" });
  });

  it("redirects role mismatches to the lifecycle-aware home", () => {
    expect(
      resolveRootNavigation({
        loading: false,
        pendingSalonSlug: null,
        user: { role: "ADMIN" },
        onboardingState: "NO_CLINIC",
        mobileAvailable: true,
        signupFlowState: "idle",
        segments: ["(member)", "home"],
      })
    ).toEqual({ type: "replace", href: "/(admin)/salon/setup", reason: "ROLE_GROUP_MISMATCH" });
  });

  it("resolves pending salon links without changing active member context", () => {
    expect(resolvePendingSalonHome({ pendingSalonSlug: " Demo-Salon ", user: null })).toBe(
      "/(intake-member)/salons/demo-salon"
    );
    expect(
      resolvePendingSalonHome({
        pendingSalonSlug: "demo-salon",
        user: { role: "MEMBER", tenantSlug: "other-salon" },
        onboardingState: "ACTIVE_SALON",
      })
    ).toBe("/(member)/home");
    expect(
      resolvePendingSalonHome({
        pendingSalonSlug: "demo-salon",
        user: { role: "TRAINER" },
        onboardingState: "ACTIVE_SALON",
      })
    ).toBeNull();
  });
});
