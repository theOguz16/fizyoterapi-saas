import type { SessionEnvelope, SessionUser } from "@/lib/mobile-api";

export type NormalizedSessionSnapshot = {
  user: SessionUser | null;
  onboardingState: SessionEnvelope["onboarding_state"] | null;
  membershipState: SessionEnvelope["membership_state"] | null;
  membershipStatus: string | null;
  recommendedEntrySurface: SessionEnvelope["recommended_entry_surface"] | null;
  hasActiveMembership: boolean;
  hasPendingApplication: boolean;
  hasManagedClinic: boolean;
  availablePersonas: NonNullable<SessionEnvelope["available_personas"]>;
  activeMembership: SessionEnvelope["active_membership"] | null;
  managedClinic: SessionEnvelope["managed_clinic"] | null;
  pendingApplication: SessionEnvelope["pending_application"] | null;
  pendingPaymentRequest: SessionEnvelope["pending_payment_request"] | null;
  activeChangeRequests: NonNullable<SessionEnvelope["active_change_requests"]>;
  availableMobileActions: NonNullable<SessionEnvelope["available_mobile_actions"]>;
  scanCapabilities: NonNullable<SessionEnvelope["scan_capabilities"]>;
  availableSurfaces: SessionEnvelope["available_surfaces"] | null;
};

export type SessionEnvelopeInput = Partial<SessionEnvelope> & {
  user?: SessionUser | null | undefined;
  available_surfaces?: SessionEnvelope["available_surfaces"] | null | undefined;
};

export type SessionSnapshotAction =
  | { type: "APPLY"; payload: SessionEnvelopeInput }
  | { type: "RESET" };

export function createEmptySessionSnapshot(): NormalizedSessionSnapshot {
  return {
    user: null,
    onboardingState: null,
    membershipState: null,
    membershipStatus: null,
    recommendedEntrySurface: null,
    hasActiveMembership: false,
    hasPendingApplication: false,
    hasManagedClinic: false,
    availablePersonas: [],
    activeMembership: null,
    managedClinic: null,
    pendingApplication: null,
    pendingPaymentRequest: null,
    activeChangeRequests: [],
    availableMobileActions: [],
    scanCapabilities: [],
    availableSurfaces: null,
  };
}

export function normalizeSessionEnvelope(
  payload: SessionEnvelopeInput
): NormalizedSessionSnapshot {
  const hasResolvedActiveMembership = Boolean(payload.active_membership);
  const user = payload.user || null;
  const isMember = user?.role === "MEMBER";

  return {
    user,
    onboardingState: hasResolvedActiveMembership ? "ACTIVE_SALON" : payload.onboarding_state || null,
    membershipState: hasResolvedActiveMembership ? "ACTIVE_SALON" : payload.membership_state || payload.onboarding_state || null,
    membershipStatus: payload.membership_status || null,
    recommendedEntrySurface:
      hasResolvedActiveMembership && isMember
        ? "MEMBER_HOME"
        : payload.recommended_entry_surface || null,
    hasActiveMembership: Boolean(payload.has_active_membership || hasResolvedActiveMembership),
    hasPendingApplication: hasResolvedActiveMembership ? false : Boolean(payload.has_pending_application || payload.pending_application),
    hasManagedClinic: Boolean(payload.has_managed_clinic || payload.managed_clinic),
    availablePersonas: Array.isArray(payload.available_personas) ? payload.available_personas : user?.role ? [user.role] : [],
    activeMembership: payload.active_membership || null,
    managedClinic: payload.managed_clinic || null,
    pendingApplication: payload.pending_application || null,
    pendingPaymentRequest: payload.pending_payment_request || null,
    activeChangeRequests: Array.isArray(payload.active_change_requests) ? payload.active_change_requests : [],
    availableMobileActions: Array.isArray(payload.available_mobile_actions) ? payload.available_mobile_actions : [],
    scanCapabilities: Array.isArray(payload.scan_capabilities) ? payload.scan_capabilities : [],
    availableSurfaces: payload.available_surfaces || null,
  };
}

export function sessionSnapshotReducer(
  _state: NormalizedSessionSnapshot,
  action: SessionSnapshotAction
): NormalizedSessionSnapshot {
  if (action.type === "RESET") {
    return createEmptySessionSnapshot();
  }

  return normalizeSessionEnvelope(action.payload);
}
