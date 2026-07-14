export type SessionRole = "ADMIN" | "TRAINER" | "MEMBER";

export type RecommendedEntrySurface =
  | "ADMIN_HOME"
  | "OWNER_SETUP"
  | "MEMBER_HOME"
  | "DISCOVERY"
  | "APPLICATION_STATUS"
  | "TRAINER_HOME";

export type MembershipLifecycleState =
  | "NO_SALON"
  | "PENDING_APPLICATION"
  | "DAY_SELECTION_REQUIRED"
  | "PACKAGE_SELECTION_REQUIRED"
  | "TRAINER_SELECTION_REQUIRED"
  | "PAYMENT_PENDING"
  | "ACTIVE_SALON"
  | "NO_CLINIC"
  | "PENDING_CLINIC_REVIEW"
  | "CLINIC_REJECTED"
  | "CLINIC_READ_ONLY";

export type SessionUser = {
  id: string;
  email: string;
  role: SessionRole;
  tenantId?: string | null;
  tenantSlug?: string | null;
  fullName: string;
  accountId?: string;
  phone?: string;
};

export type ActiveMembership = {
  id?: string;
  role: SessionRole;
  status: string;
  payment_status?: string;
  tenant_id: string;
  tenant_slug?: string | null;
  tenant_name?: string | null;
  linked_user_id?: string | null;
};

export type ManagedClinicSummary = {
  id: string;
  slug: string;
  name: string;
  review_status: string;
  subscription_status: string;
  is_public: boolean;
  trial_starts_at?: string | null;
  trial_ends_at?: string | null;
  subscription_started_at?: string | null;
  subscription_current_period_ends_at?: string | null;
  subscription_last_event_at?: string | null;
  review_note?: string | null;
  is_boosted?: boolean;
  city?: string | null;
  district?: string | null;
};

export type SessionEnvelope<
  TPaymentRequest = unknown,
  TChangeRequest = unknown,
  TScanCapability extends string = "SALON_ENTRY" | "TRAINER_CHECKIN",
> = {
  accessToken?: string;
  sub?: string;
  tenantId?: string | null;
  role?: SessionRole;
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
  managed_clinic?: ManagedClinicSummary | null;
  pending_application?: {
    id: string;
    tenant_id: string;
    status: string;
    payment_status: string;
    payment_reference?: string | null;
    payment_confirmed_at?: string | null;
  } | null;
  pending_payment_request?: TPaymentRequest | null;
  active_change_requests?: TChangeRequest[] | null;
  available_mobile_actions?: string[] | null;
  scan_capabilities?: TScanCapability[] | null;
  available_surfaces?: { mobile: boolean; web: boolean };
};
