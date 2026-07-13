// Mobile API auth domain endpointleri.
import { httpRequest } from "../http-client";
import { isE2EModeEnabled } from "../e2e-mode";
import type { ActiveMembership, MemberChangeRequest, MembershipLifecycleState, PaymentRequest, QrScanContext, RecommendedEntrySurface, SessionEnvelope, SessionRole, SessionUser } from "./types";

// Auth endpointleri SessionEnvelope donduruyor.
// Bu sayede login/register/me akislari ayni shape'i paylasiyor.
export async function registerApi(input: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  account_type?: "CLINIC_ADMIN";
  onboarding_profile?: {
    role: "ADMIN";
    primary_goal: string;
    rhythm: string;
    support_style: string;
  };
}) {
  return httpRequest<SessionEnvelope>("/auth/register", {
    method: "POST",
    auth: false,
    body: input,
  });
}

export async function loginApi(input: { email: string; password: string; tenantSlug?: string; role?: SessionRole; e2e?: boolean }) {
  const { e2e, ...body } = input;
  const useE2EEndpoint = e2e && isE2EModeEnabled();
  return httpRequest<SessionEnvelope>(useE2EEndpoint ? "/internal/e2e/session" : "/auth/login", {
    method: "POST",
    auth: false,
    body,
  });
}

export async function switchRoleApi(role: SessionRole) {
  return httpRequest<SessionEnvelope>("/auth/switch-role", {
    method: "POST",
    body: { role },
  });
}

export async function meApi() {
  return httpRequest<{
    sub: string;
    tenantId?: string | null;
    role: SessionRole;
    user: SessionUser;
    onboarding_state?: MembershipLifecycleState;
    membership_state?: MembershipLifecycleState;
    membership_status?: string;
    recommended_entry_surface?: RecommendedEntrySurface;
    has_active_membership?: boolean;
    has_pending_application?: boolean;
    has_managed_clinic?: boolean;
    available_personas?: SessionRole[];
    active_membership?: ActiveMembership | null;
    managed_clinic?: SessionEnvelope["managed_clinic"];
    pending_application?: SessionEnvelope["pending_application"];
    pending_payment_request?: PaymentRequest | null;
    active_change_requests?: MemberChangeRequest[] | null;
    available_mobile_actions?: string[] | null;
    scan_capabilities?: QrScanContext[] | null;
    available_surfaces?: { mobile: boolean; web: boolean };
  }>("/auth/me");
}

export async function logoutApi() {
  return httpRequest<boolean>("/auth/logout", { method: "POST" });
}

export async function deleteAccountApi() {
  return httpRequest<{ deleted: boolean }>("/auth/account", { method: "DELETE" });
}
