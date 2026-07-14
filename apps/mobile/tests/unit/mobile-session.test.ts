import { describe, expect, it } from "vitest";
import {
  createEmptySessionSnapshot,
  normalizeSessionEnvelope,
  sessionSnapshotReducer,
} from "@/lib/mobile-session";

describe("mobile session state", () => {
  it("normalizes active memberships as the authoritative member lifecycle", () => {
    const snapshot = normalizeSessionEnvelope({
      user: { id: "member-1", role: "MEMBER", email: "member@example.com", fullName: "Demo Member" },
      onboarding_state: "PAYMENT_PENDING",
      membership_state: "PAYMENT_PENDING",
      has_pending_application: true,
      active_membership: {
        id: "membership-1",
        tenant_id: "tenant-1",
        tenant_slug: "demo-clinic",
        tenant_name: "Demo Clinic",
        role: "MEMBER",
        status: "ACTIVE",
        payment_status: "VERIFIED",
      },
    });

    expect(snapshot.onboardingState).toBe("ACTIVE_SALON");
    expect(snapshot.membershipState).toBe("ACTIVE_SALON");
    expect(snapshot.recommendedEntrySurface).toBe("MEMBER_HOME");
    expect(snapshot.hasActiveMembership).toBe(true);
    expect(snapshot.hasPendingApplication).toBe(false);
  });

  it("derives personas and collection defaults from a partial refresh payload", () => {
    const snapshot = normalizeSessionEnvelope({
      user: { id: "trainer-1", role: "TRAINER", email: "trainer@example.com", fullName: "Demo Trainer" },
      onboarding_state: "ACTIVE_SALON",
    });

    expect(snapshot.availablePersonas).toEqual(["TRAINER"]);
    expect(snapshot.activeChangeRequests).toEqual([]);
    expect(snapshot.availableMobileActions).toEqual([]);
    expect(snapshot.scanCapabilities).toEqual([]);
  });

  it("applies every session field atomically through the reducer", () => {
    const next = sessionSnapshotReducer(createEmptySessionSnapshot(), {
      type: "APPLY",
      payload: {
        user: { id: "admin-1", role: "ADMIN", email: "admin@example.com", fullName: "Demo Admin" },
        onboarding_state: "NO_CLINIC",
        has_managed_clinic: true,
        available_personas: ["ADMIN", "TRAINER"],
        available_surfaces: { mobile: true, web: false },
      },
    });

    expect(next).toEqual(
      expect.objectContaining({
        user: expect.objectContaining({ id: "admin-1" }),
        onboardingState: "NO_CLINIC",
        hasManagedClinic: true,
        availablePersonas: ["ADMIN", "TRAINER"],
        availableSurfaces: { mobile: true, web: false },
      })
    );
  });

  it("resets all related session fields from one reducer action", () => {
    const populated = normalizeSessionEnvelope({
      user: { id: "admin-1", role: "ADMIN", email: "admin@example.com", fullName: "Demo Admin" },
      onboarding_state: "ACTIVE_SALON",
      has_managed_clinic: true,
      available_personas: ["ADMIN", "TRAINER"],
      available_mobile_actions: ["MANAGE_CLINIC"],
    });

    expect(sessionSnapshotReducer(populated, { type: "RESET" })).toEqual(createEmptySessionSnapshot());
  });
});
