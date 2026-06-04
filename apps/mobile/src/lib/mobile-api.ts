// Bu helper modulu mobil tarafta mobile api ile ilgili veri donusumu, is kurali veya API erisimini toplar.
// Ekranlar ham ayrintilar yerine bu dosyadaki yardimcilari kullanarak daha yalniz kalir.
import { httpRequest } from "./http-client";

// Mobil uygulamanin backend ile sozlesme katmani.
// Type tanimlari ve endpoint fonksiyonlari burada tutuluyor ki ekranlar
// ham fetch ayrintilarini degil is alanlarini tuksun.
export type SessionRole = "ADMIN" | "TRAINER" | "MEMBER";
export type RecommendedEntrySurface = "ADMIN_HOME" | "OWNER_SETUP" | "MEMBER_HOME" | "DISCOVERY" | "APPLICATION_STATUS" | "TRAINER_HOME";
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
  id: string;
  role: SessionRole;
  status: string;
  payment_status: string;
  tenant_id: string;
  tenant_slug?: string | null;
  tenant_name?: string | null;
  linked_user_id?: string | null;
};

export type SalonDiscoverySummary = {
  id: string;
  slug: string;
  name: string;
  tenant_name?: string | null;
  city?: string | null;
  district?: string | null;
  location?: { city?: string | null; district?: string | null } | null;
  hero_title?: string | null;
  hero_subtitle?: string | null;
  about_text?: string | null;
  is_boosted?: boolean;
  services?: Array<{ title?: string | null; starting_price?: string | number | null; summary?: string | null; active_member_count?: number | null }>;
  trainers?: TrainerOption[];
  business_hours?: {
    start_time?: string | null;
    end_time?: string | null;
    lunch_break_start?: string | null;
    lunch_break_end?: string | null;
    slot_minutes?: number | null;
    break_duration_minutes?: number | null;
    working_days?: number[];
  } | null;
};

export type PurchaseDaySelection = {
  starts_at: string;
  ends_at: string;
  label: string;
  package_id?: string;
  package_title?: string;
  weekday?: number;
  weekday_label?: string;
  time_range_label?: string;
  lesson_name?: string | null;
  group_class_id?: string | null;
  group_title?: string | null;
  is_group_class?: boolean | null;
  is_recurring?: boolean | null;
  recurrence_label?: string | null;
  special_date?: string | null;
  price?: string | number | null;
  capacity?: number | null;
  joined_count?: number | null;
  trainer_can_invite_members?: boolean | null;
  notification_scope?: "SALON_MEMBERS" | "INVITED_MEMBERS" | null;
  requires_admin_approval?: boolean | null;
};

export type PackageOption = {
  id: string;
  title: string;
  type?: string | null;
  display_price?: string | number | null;
  total_credits?: number | null;
  summary?: string | null;
  rules?: Record<string, unknown> | null;
  service_key?: string | null;
  service_name?: string | null;
  lesson_category?: string | null;
  weekly_class_hours?: number | null;
  required_preference_slots?: number | null;
  required_trainer_free_slots?: number | null;
  is_available?: boolean;
  unavailable_reason?: string | null;
  lesson_mode?: string | null;
  sub_lessons?: string[];
  session_duration_minutes?: number | null;
  break_duration_minutes?: number | null;
  allow_member_multi_select?: boolean;
  allow_drop_in_booking?: boolean;
};

export type AdminPackage = {
  id: string;
  title: string;
  type: string;
  total_credits: number;
  duration_days: number;
  capacity: number;
  is_active: boolean;
  is_visible: boolean;
  is_public: boolean;
  display_price?: string | number | null;
  service_key?: string | null;
  service_name?: string | null;
  lesson_category?: string | null;
  capacity_label?: string | null;
  trainer_commission_rate?: number | null;
  commission_label?: string | null;
  pricing_label?: string | null;
  summary?: string | null;
  rules?: Record<string, unknown> | null;
  lesson_mode?: string | null;
  sub_lessons?: string[];
  linked_group_class_ids?: string[];
  linked_group_class_titles?: string[];
  session_duration_minutes?: number | null;
  break_duration_minutes?: number | null;
  allow_member_multi_select?: boolean;
  allow_drop_in_booking?: boolean;
};

export type AdminPackageFormTemplate = {
  service_key: string;
  lesson_category: string;
  service_name: string;
  category_group?: string | null;
  category_label?: string | null;
  sub_category_key?: string | null;
  sub_category_label?: string | null;
  capacity_label: string;
  suggested_capacity: number;
  starting_price: string;
  trainer_commission_rate: string;
  package_type: string;
  package_type_label?: string | null;
  session_duration_minutes?: number;
  break_duration_minutes?: number;
  lesson_mode?: "PRIVATE" | "DUO" | "GROUP" | string;
  lesson_mode_label?: string | null;
  sub_lessons?: string[];
  default_title?: string | null;
};

export type AdminPackageFormOptions = {
  templates?: AdminPackageFormTemplate[];
  lesson_mode_options?: Array<{ value: "PRIVATE" | "DUO" | "GROUP" | string; label: string; suggested_capacity: number }>;
  linkable_group_classes?: AdminSession[];
};

export type AdminPackageAssignment = {
  id: string;
  package_id: string;
  trainer_id: string;
  is_active: boolean;
  package_type?: string | null;
  package_title?: string | null;
  package_display_price?: string | number | null;
  package_service_name?: string | null;
  package_lesson_category?: string | null;
  package_capacity_label?: string | null;
  package_commission_label?: string | null;
  package_is_active?: boolean | null;
  trainer_full_name?: string | null;
  trainer_email?: string | null;
  trainer_is_active?: boolean | null;
};

export type TrainerAssignedPackage = {
  id: string;
  title: string;
  package_name?: string | null;
  display_price?: string | number | null;
  capacity?: number | null;
  service_name?: string | null;
  lesson_category?: string | null;
  lesson_category_label?: string | null;
  package_type?: string | null;
  trainer_commission_rate?: number | null;

  lesson_mode?: "PRIVATE" | "DUO" | "GROUP" | string | null;
  sub_lessons?: string[];
  session_duration_minutes?: number | null;
  break_duration_minutes?: number | null;
};

export type TrainerOption = {
  id: string;
  full_name: string;
  specialties?: string[];
  bio?: string | null;
  rating_label?: string | null;
  compatibility_note?: string | null;
  avatar_label?: string | null;
  matching_slots?: number | null;
  required_matching_slots?: number | null;
  is_available?: boolean;
  unavailable_reason?: string | null;
};

export type PaymentRequest = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "VERIFIED";
  amount?: number | null;
  currency?: string | null;
  package_id?: string | null;
  package_title?: string | null;
  trainer_id?: string | null;
  tenant_slug?: string | null;
  tenant_name?: string | null;
  note?: string | null;
  selected_days?: PurchaseDaySelection[];
};

export type MemberPurchaseDraft = {
  tenant_slug: string;
  selected_days: PurchaseDaySelection[];
  package_id: string;
  package_ids?: string[];
  selected_packages?: Array<{
    package_id: string;
    package_title?: string;
    package_price?: string | number | null;
    preferred_slots?: PurchaseDaySelection[];
    weekly_frequency?: number;
    duo_partner_name?: string;
    duo_partner_contact?: string;
  }>;
  trainer_id?: string;
  selected_sub_lesson?: string;
  duo_partner_name?: string;
  duo_partner_contact?: string;
  note?: string;
  availability_context?: {
    source: "MEMBER_AVAILABILITY";
    visibility: "TRAINER_HIDDEN";
    selected_by: "MEMBER";
  };
};

export type MemberChangeRequest = {
  id: string;
  type: "PACKAGE_RENEWAL" | "PACKAGE_CANCEL" | "TRAINER_CHANGE";
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at?: string;
  reason?: string | null;
};

export type AssignableBookingSlot = {
  starts_at: string;
  ends_at: string;
};

export type BookingCancellationPolicy = {
  min_hours_before_start: number;
  refund_policy?: string | null;
};

export type MemberScheduleChangeRequest = {
  id: string;
  booking_id: string;
  trainer_id?: string | null;
  trainer_name?: string | null;
  member_id?: string | null;
  session_title?: string | null;
  package_title?: string | null;
  current_starts_at: string;
  current_ends_at?: string | null;
  proposed_starts_at: string;
  proposed_ends_at?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at?: string | null;
  note?: string | null;
};

export type TrainerScheduleChangeRequest = {
  request_id: string;
  status: "PENDING";
  booking_id: string;
  current_starts_at: string;
  current_ends_at?: string | null;
  proposed_starts_at: string;
  proposed_ends_at?: string | null;
};

export type TrainerScheduleEntry = {
  id: string;
  starts_at: string;
  ends_at?: string | null;
  member_id?: string | null;
  member_full_name?: string | null;
  session_title?: string | null;
  lesson_category_label?: string | null;
  package_name?: string | null;
  package_title?: string | null;
  status?: string | null;
  pending_schedule_change?: MemberScheduleChangeRequest | null;
  assignable_slots?: AssignableBookingSlot[] | null;
  is_group_class?: boolean | null;
  is_duo?: boolean | null;
  duo_partner_name?: string | null;
  duo_partner_contact?: string | null;
  duo_status?: string | null;
  lesson_name?: string | null;
  group_class_id?: string | null;
  recurrence_label?: string | null;
  price?: string | number | null;
  requires_admin_approval?: boolean | null;
  notification_scope?: "SALON_MEMBERS" | "INVITED_MEMBERS" | null;
  invited_member_count?: number | null;
  joined_member_count?: number | null;
  approved_member_count?: number | null;
  related_package_id?: string | null;
  invited_member_ids?: string[] | null;
};

export type GroupClassSession = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  trainer_id?: string | null;
  related_package_id?: string | null;
  capacity?: number | null;
  lesson_category?: string | null;
  price?: string | number | null;
  notification_scope?: "SALON_MEMBERS" | "INVITED_MEMBERS" | null;
  requires_admin_approval?: boolean | null;
  invited_member_count?: number | null;
  invited_member_ids?: string[] | null;
  recurrence_label?: string | null;
  special_date?: string | null;
  status?: string | null;
  is_group_class?: boolean | null;
  lesson_name?: string | null;
  group_class_id?: string | null;
  joined_member_count?: number | null;
  approved_member_count?: number | null;
  planned_total_revenue?: number | null;
  trainer_commission_rate?: number | null;
  trainer_planned_earning?: number | null;
  trainer_full_name?: string | null;
  package_title?: string | null;
  member_join_state?: "OPEN" | "PENDING" | "JOINED" | null;
  member_can_leave?: boolean | null;
  member_join_request_id?: string | null;
  member_booking_id?: string | null;
};

export type AdminSession = GroupClassSession & {
  trainer_full_name?: string | null;
  package_title?: string | null;
};

export type TrainerGroupClassFormOptions = {
  business_hours?: {
    timezone?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    lunch_break_start?: string | null;
    lunch_break_end?: string | null;
    slot_minutes?: number | null;
    break_duration_minutes?: number | null;
    working_days?: number[] | null;
  } | null;
  allowed_categories?: string[];
  packages: TrainerAssignedPackage[];
  members: TrainerMemberListItem[];
};

export type TrainerAvailabilityEntry = {
  id: string;
  starts_at: string;
  ends_at?: string | null;
  member_id?: string | null;
  member_full_name?: string | null;
  package_id?: string | null;
  package_title?: string | null;
  note?: string | null;
  assignable_slots?: AssignableBookingSlot[] | null;
};

export type TrainerEarningsSummary = {
  day_total?: number;
  week_total?: number;
  month_total?: number;
  year_total?: number;
  month_gross_total?: number;
  month_trainer_income?: number;
  month_commission_rate?: number;
  month_credited_lessons?: number;
  comparison?: {
    day?: TrainerEarningsPeriodComparison;
    week?: TrainerEarningsPeriodComparison;
    month?: TrainerEarningsPeriodComparison;
    year?: TrainerEarningsPeriodComparison;
  };
  monthly_series?: TrainerEarningsSeriesPoint[];
  yearly_series?: TrainerEarningsSeriesPoint[];
};

export type AdminCampaign = {
  id: string;
  name?: string;
  audience?: "ALL" | "RISK" | "NEW";
  trigger_type?: "REFERRAL" | "ATTENDANCE";
  required_referrals?: number | null;
  min_lessons?: number | null;
  reward_type?: string | null;
  reward_value?: number | null;
  reward_label?: string | null;
  reward_target?: "REFERRER" | "REFERRED" | "BOTH" | "MEMBER" | null;
  is_active?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminCampaignListResponse = {
  campaigns: {
    referral_campaigns?: AdminCampaign[];
    loyalty_campaigns?: AdminCampaign[];
    cancellation_policy?: {
      min_hours_before_start?: number;
      refund_policy?: string | null;
    } | null;
  };
  audit?: Array<{
    id: string;
    action: string;
    summary: string;
    actor_id?: string | null;
    created_at: string;
  }>;
  items?: AdminCampaign[];
  summary?: {
    total: number;
    active: number;
    referral: number;
    loyalty: number;
  };
};

export type TrainerEarningsPeriodComparison = {
  key: "day" | "week" | "month" | "year";
  label: string;
  current: number;
  previous: number;
  delta: number;
  delta_percent: number;
};

export type TrainerEarningsSeriesPoint = {
  key: string;
  label: string;
  total: number;
};

export type MemberOwnedPackage = {
  id: string;
  package_id?: string | null;
  package_title?: string | null;
  lesson_category_label?: string | null;
  package_price?: string | number | null;
  latest_catalog_price?: string | number | null;
  renewal_price?: string | number | null;
  renewal_price_changed?: boolean;
  total_credits?: number | null;
  package_total_credits?: number | null;
  remaining_credits?: number | null;
  status?: "ACTIVE" | "EXPIRED" | "UPCOMING" | "AWAITING_PARTNER_PAYMENT";
  starts_at?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  source_request_id?: string | null;
  package_snapshot?: Record<string, unknown> | null;
  lesson_mode?: string | null;
  is_duo?: boolean | null;
  duo_status?: string | null;
  duo_partner_name?: string | null;
  duo_partner_contact?: string | null;
  duo_invite_url?: string | null;
  duo_invite_token?: string | null;
  duo_payment_status?: string | null;

  linked_group_classes?: Array<{
    id?: string;
    booking_id?: string | null;
    request_id?: string | null;
    session_id?: string | null;
    title?: string | null;
    starts_at?: string | null;
    ends_at?: string | null;
    status?: string | null;
    source?: "BOOKING" | "NOTIFICATION_EVENT" | string;
  }>;

  linked_group_class_ids?: string[];
  linked_group_class_titles?: string[];
};

export type MemberAttendanceHistoryItem = {
  id: string;
  created_at?: string | null;
  result?: string | null;
  session_title?: string | null;
};

export type TrainerMemberListItem = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  is_active?: boolean;
  qr_code?: string | null;
};

export type AdminApprovalItem = {
  id: string;
  type: "APPLICATION" | "PAYMENT" | "CHANGE_REQUEST";
  title: string;
  subtitle?: string | null;
  status: string;
  created_at?: string | null;
  amount?: number | null;
  member_name?: string | null;
  member_email?: string | null;
  note?: string | null;
  request_type?: string | null;
  request_scope?: "ACTIVE_MEMBERSHIP" | "NEW_APPLICATION" | null;
  active_membership_id?: string | null;
  submitted_at?: string | null;
  lesson_name?: string | null;
  is_group_class?: boolean | null;
  recurrence_label?: string | null;
  special_date?: string | null;
  requested_price?: number | null;
  notification_scope?: "SALON_MEMBERS" | "INVITED_MEMBERS" | null;
  invited_member_count?: number | null;
  joined_member_count?: number | null;
  is_duo?: boolean | null;
  duo_partner_name?: string | null;
  duo_partner_contact?: string | null;
  duo_payment_status?: string | null;
  duo_payment_note?: string | null;
};

export type AdminNotificationLogItem = {
  id: string;
  type: string;
  status: string;
  created_at?: string | null;
  processed_at?: string | null;
  error_message?: string | null;
  member_id?: string | null;
  member_full_name?: string | null;
  member_email?: string | null;
  title?: string | null;
  body?: string | null;
};

export type AdminRiskMemberItem = {
  member_id?: string | null;
  full_name?: string | null;
  member_full_name?: string | null;
  member_name?: string | null;
  email?: string | null;
  risk_score?: number | null;
  score?: number | null;
  level?: string | null;
  risk_label?: string | null;
  primary_reason?: string | null;
  reasom?: string | null;
  reasons?: string[] | null;
  attendance_gap_days?: number | null;
  days_since_attendance?: number | null;
  remaining_credits?: number | null;
  last_measurement_at?: string | null;
};

export type QrScanContext = "SALON_ENTRY" | "TRAINER_CHECKIN";

export type QrScanResult = {
  success: boolean;
  context: QrScanContext;
  message: string;
  booking_id?: string | null;
  membership_id?: string | null;
  member_id?: string | null;
  member_full_name?: string | null;
};

export type StructuredTrainerNote = {
  id: string;
  title?: string | null;
  body: string;
  note: string;
  category: "GENERAL" | "GOAL" | "RISK" | "FOLLOW_UP";
  created_at?: string | null;
  updated_at?: string | null;
};

export type BookingReschedulePayload = {
  starts_at: string;
  ends_at: string;
  trainer_id?: string;
  member_id?: string;
  session_id?: string;
  status?: string;
};

export type SessionEnvelope = {
  accessToken?: string;
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
  managed_clinic?: {
    id: string;
    slug: string;
    name: string;
    review_status: string;
    subscription_status: string;
    is_public: boolean;
    trial_starts_at?: string | null;
    trial_ends_at?: string | null;
    review_note?: string | null;
    is_boosted?: boolean;
    city?: string | null;
    district?: string | null;
  } | null;
  pending_application?: {
    id: string;
    tenant_id: string;
    status: string;
    payment_status: string;
    payment_reference?: string | null;
    payment_confirmed_at?: string | null;
  } | null;
  pending_payment_request?: PaymentRequest | null;
  active_change_requests?: MemberChangeRequest[] | null;
  available_mobile_actions?: string[] | null;
  scan_capabilities?: QrScanContext[] | null;
  available_surfaces?: { mobile: boolean; web: boolean };
};

export type AdminClinicSubscription = {
  tenant_id: string;
  review_status: string;
  subscription_status: string;
  is_public: boolean;
  trial_starts_at?: string | null;
  trial_ends_at?: string | null;
  trial_days_total: number;
  trial_days_remaining: number;
  has_trial_history: boolean;
  can_start_trial: boolean;
  can_purchase_in_app: boolean;
  purchase_provider: "REVENUECAT";
  purchase_mode: "IN_APP_PURCHASE";
  recommended_action: "WAIT_REVIEW" | "START_TRIAL" | "PURCHASE_IN_APP" | "MANAGE_PLAN";
};

// Auth endpointleri SessionEnvelope donduruyor.
// Bu sayede login/register/me akislari ayni shape'i paylasiyor.
export async function registerApi(input: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  account_type?: "MEMBER" | "CLINIC_ADMIN";
  onboarding_profile?: {
    role: "MEMBER" | "TRAINER" | "ADMIN";
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
  const useE2EEndpoint = e2e && typeof __DEV__ !== "undefined" && __DEV__;
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

export type DiscoveryProfileAnswer = {
  id: string;
  question: string;
  answer: string;
};

export type DiscoveryProfile = {
  goals: string[];
  attendance_preference: string;
  support_preference: string;
  age_band: string;
  mobility_or_health_flags: string[];
  environment_preference: string;
  time_preferences: string[];
  budget_band: string;
  answers?: DiscoveryProfileAnswer[];
};

export type DiscoveryProfileResult = {
  profile_summary: string;
  explanation_points: string[];
  recommended_package_type: string;
};

export type ClinicRecommendation = {
  slug: string;
  title: string;
  subtitle: string;
  tags: string[];
  match_score: number;
};

export type PlanRecommendation = {
  recommended_plan: {
    id: string;
    name: string;
    price_label: string;
    subtitle: string;
  };
  explanation_points: string[];
};

export type ClinicIntake = {
  clinic_size: string;
  staff_count: number;
  specialist_count: number;
  active_client_count: number;
  branch_count: number;
  tone: string;
  age_mix: string;
  events_or_group_classes: boolean;
  priority_jobs_to_solve: string[];
};

export type ClinicIntakeResult = {
  recommended_plan: {
    id: string;
    name: string;
    price_label: string;
    subtitle: string;
  };
  recommended_modules: string[];
  estimated_roi_copy: string;
  price_preview: string;
};

export type AdminCompactMember = {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  is_active?: boolean;
  created_at?: string;
  role?: "MEMBER" | "TRAINER";
};

export type AdminMemberDetail = {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  is_active?: boolean;
  created_at?: string;
  role?: "MEMBER" | "TRAINER";
  onboarding_profile?: {
    role?: "MEMBER" | "TRAINER" | "ADMIN";
    primary_goal?: string;
    rhythm?: string;
    support_style?: string;
  } | null;
};

export type AdminMemberPackage = {
  id: string;
  user_id: string;
  package_id: string;
  remaining_credits: number;
  starts_at?: string | null;
  expires_at?: string | null;
  is_active: boolean;
  purchase_price?: string | number | null;
  latest_package_price?: string | number | null;
  package_snapshot?: Record<string, unknown> | null;
  source_request_id?: string | null;
  is_expired?: boolean;
  package_title?: string | null;
  package_type?: string | null;
  package_total_credits?: number | null;
  package_duration_days?: number | null;
  package_price?: number | null;
  trainer_summary?: string | null;
};

export type AdminMemberPackagesResponse = {
  data: AdminMemberPackage[];
  totalRemainingCredits: number;
};

export type AdminTrainerEarnings = {
  daily_income?: number;
  weekly_income?: number;
  monthly_income?: number;
  yearly_income?: number;
};

export async function createDiscoveryProfileApi(payload: DiscoveryProfile) {
  return httpRequest<DiscoveryProfileResult>("/public/discovery-profile", {
    method: "POST",
    auth: false,
    body: payload,
  });
}

export async function getClinicRecommendationsApi(payload: DiscoveryProfile) {
  return httpRequest<{ recommendations: ClinicRecommendation[] }>("/public/clinic-recommendations", {
    method: "POST",
    auth: false,
    body: payload,
  });
}

export async function getPlanRecommendationApi(payload: DiscoveryProfile) {
  return httpRequest<PlanRecommendation>("/public/plan-recommendation", {
    method: "POST",
    auth: false,
    body: payload,
  });
}

export async function createClinicIntakeApi(payload: ClinicIntake) {
  return httpRequest<ClinicIntakeResult>("/public/clinic-intake", {
    method: "POST",
    auth: false,
    body: payload,
  });
}

export async function createSubscriptionIntentApi(payload: {
  plan_id: string;
  clinic_name?: string;
  branch_count?: number;
  active_client_count?: number;
}) {
  return httpRequest<{
    status: string;
    plan_id: string;
    message: string;
  }>("/billing/subscription-intent", {
    method: "POST",
    auth: false,
    body: payload,
  });
}

export async function logoutApi() {
  return httpRequest<boolean>("/auth/logout", { method: "POST" });
}

export async function deleteAccountApi() {
  return httpRequest<{ deleted: boolean }>("/auth/account", { method: "DELETE" });
}

export async function invitePreviewApi(token: string) {
  return httpRequest<any>(`/public/invites/${encodeURIComponent(token)}/preview`, { auth: false });
}

export async function inviteAcceptApi(payload: {
  token: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  password: string;
}) {
  return httpRequest<any>("/public/invites/accept", {
    method: "POST",
    auth: false,
    body: payload,
  });
}

export async function getPublicCitiesApi() {
  return httpRequest<Array<{ value: string; label: string }>>("/public/cities");
}

export async function getPublicSalonsApi(city?: string) {
  const query = city ? `?city=${encodeURIComponent(city)}` : "";
  return httpRequest<SalonDiscoverySummary[]>(`/public/salons${query}`, { auth: false });
}

export async function getPublicSalonApi(slug: string) {
  return httpRequest<SalonDiscoverySummary>(`/public/salons/${encodeURIComponent(slug)}`, { auth: false });
}

export async function getPublicSalonPackagesApi(slug: string) {
  return httpRequest<{ data?: PackageOption[] } | PackageOption[]>(`/public/salons/${encodeURIComponent(slug)}/packages`, { auth: false });
}

export const getPublıcSalonsApi = getPublicSalonsApi;
export const getPublıcSalonApi = getPublicSalonApi;
export const getPublıcSalonPackagesApi = getPublicSalonPackagesApi;
export const createSalonApplıcationApi = createSalonApplicationApi;
export const getAdminMemberMeaşurementsApi = getAdminMemberMeasurementsApi;
export const getMemberMeaşurementsApi = getMemberMeasurementsApi;
export const createMemberMeaşurementApi = createMemberMeasurementApi;
export const createClinıcRequestApi = createClinicRequestApi;

export async function createSalonApplicationApi(payload: { tenant_slug: string; note?: string }) {
  // Uye satin alma akisi ilerledikce secimler note/payload icinde tasinabiliyor.
  // Backend onay aninda bunlari MobilePurchaseSyncService ile kalici verilere ceviriyor.
  return httpRequest<any>("/member/salon-applications", {
    method: "POST",
    body: payload,
  });
}

export async function getSalonDayOptionsApi(slug: string, packageIds?: string[]) {
  const search = new URLSearchParams();
  if (Array.isArray(packageIds) && packageIds.length > 0) {
    search.set("package_ids", packageIds.join(","));
  }
  const query = search.toString() ? `?${search.toString()}` : "";
  return httpRequest<{ data?: PurchaseDaySelection[] } | PurchaseDaySelection[]>(`/public/salons/${encodeURIComponent(slug)}/day-options${query}`, {
    auth: false,
  });
}

export async function getSalonTrainerOptionsApi(slug: string, packageId?: string, selectedDays?: PurchaseDaySelection[]) {
  const search = new URLSearchParams();
  if (packageId) search.set("package_id", packageId);
  if (Array.isArray(selectedDays) && selectedDays.length > 0) {
    search.set("selected_days", JSON.stringify(selectedDays));
  }
  const query = search.toString() ? `?${search.toString()}` : "";
  return httpRequest<{ data?: TrainerOption[] } | TrainerOption[]>(`/public/salons/${encodeURIComponent(slug)}/trainers${query}`, {
    auth: false,
  });
}

export async function createMemberPaymentRequestApi(payload: MemberPurchaseDraft) {
  return httpRequest<PaymentRequest>("/member/purchase-requests", {
    method: "POST",
    body: payload,
  });
}

export async function getMemberPaymentRequestsApi() {
  return httpRequest<PaymentRequest[]>("/member/purchase-requests");
}

export async function createMemberChangeRequestApi(payload: {
  type: MemberChangeRequest["type"];
  package_id?: string;
  trainer_id?: string;
  note?: string;
}) {
  return httpRequest<MemberChangeRequest>("/member/change-requests", {
    method: "POST",
    body: payload,
  });
}

export async function getMemberChangeRequestsApi() {
  return httpRequest<MemberChangeRequest[]>("/member/change-requests");
}

export async function getMySalonApplicationsApi() {
  return httpRequest<any>("/member/salon-applications/me");
}

export async function leaveSalonMembershipApi() {
  return httpRequest<any>("/member/salon-applications/leave", {
    method: "POST",
  });
}

export async function getMyClinicRequestApi() {
  return httpRequest<SessionEnvelope["managed_clinic"] | null>("/account/clinic-request");
}

export async function createClinicRequestApi(payload: {
  clinic_name: string;
  city: string;
  district: string;
  phone: string;
  about_text?: string;
}) {
  return httpRequest<SessionEnvelope["managed_clinic"]>("/account/clinic-request", {
    method: "POST",
    body: payload,
  });
}

export async function getMemberHomeApi() {
  return httpRequest<any>("/member/home");
}

export async function getMemberPackagesApi() {
  return httpRequest<any>("/member/packages");
}

export async function getMemberMyPackagesApi() {
  return httpRequest<MemberOwnedPackage[]>("/member/packages/my-packages");
}

export async function getMemberAttendanceHistoryApi() {
  return httpRequest<MemberAttendanceHistoryItem[]>("/member/attendance/history");
}

export async function patchMemberWeeklyTarget(weekly_class_hours: number) {
  return httpRequest<any>("/member/home/weekly-class-hours", {
    method: "PATCH",
    body: { weekly_class_hours },
  });
}

export async function getMemberAttendanceApi() {
  return httpRequest<any>("/member/attendance/history");
}

export async function getMemberBookingsApi() {
  return httpRequest<any>("/member/bookings");
}

export async function getMemberScheduleChangeRequestsApi() {
  return httpRequest<any>("/member/schedule-change-requests");
}

export async function resolveMemberScheduleChangeRequestApi(id: string, decision: "APPROVE" | "REJECT") {
  return httpRequest<any>(`/member/schedule-change-requests/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { decision },
  });
}

export async function getMemberBookingByIdApi(id: string) {
  return httpRequest<any>(`/member/bookings/${id}`);
}

export async function getMemberAvailabilityApi() {
  return httpRequest<any>("/member/availability");
}

export async function saveMemberAvailabilityApi(payload: {
  mode?: "REPLACE_WEEK" | "APPEND";
  slots: Array<{ starts_at: string; ends_at: string; package_id?: string; note?: string }>;
}) {
  return httpRequest<any>("/member/availability", {
    method: "POST",
    body: payload,
    unwrapData: false,
  });
}

export async function cancelMemberBookingApi(id: string) {
  return httpRequest<any>(`/member/bookings/${id}/cancel`, { method: "PATCH" });
}

export async function getMemberReferralsApi() {
  return httpRequest<any>("/member/referrals");
}

export async function createMemberReferralApi(payload: { invitee_name: string; invitee_phone_or_email: string }) {
  return httpRequest<any>("/member/referrals", {
    method: "POST",
    body: payload,
  });
}

export async function getMemberMeasurementsApi() {
  return httpRequest<any>("/member/measurements");
}

export async function createMemberMeasurementApi(payload: {
  measured_at?: string;
  height_cm?: string | number;
  weight_kg?: string | number;
  fat_percent?: string | number;
  muscle_kg?: string | number;
  extras?: Record<string, unknown>;
}) {
  return httpRequest<any>("/member/measurements", {
    method: "POST",
    body: payload,
  });
}

export async function getMemberQrApi() {
  return httpRequest<any>("/member/qr");
}

export async function getMemberGroupClassesApi() {
  const response = await httpRequest<{ data?: GroupClassSession[] } | GroupClassSession[]>("/member/group-classes");
  if (Array.isArray(response)) return response;
  return Array.isArray((response as any)?.data) ? (response as any).data : [];
}

export async function joinMemberGroupClassApi(id: string) {
  return httpRequest<any>(`/member/group-classes/${encodeURIComponent(id)}/join`, {
    method: "POST",
  });
}

export async function leaveMemberGroupClassApi(id: string) {
  return httpRequest<any>(`/member/group-classes/${encodeURIComponent(id)}/leave`, {
    method: "DELETE",
  });
}

export async function getTrainerQrApi() {
  return httpRequest<any>("/trainer/qr");
}

export async function getTrainerTodayApi() {
  return httpRequest<any>("/trainer/today");
}

export async function getTrainerBookingsApi() {
  return httpRequest<TrainerScheduleEntry[]>("/trainer/bookings");
}

export async function getTrainerGroupClassesApi() {
  const response = await httpRequest<{ data?: GroupClassSession[] } | GroupClassSession[]>("/trainer/group-classes");
  if (Array.isArray(response)) return response;
  return Array.isArray((response as any)?.data) ? (response as any).data : [];
}

export async function getTrainerGroupClassFormOptionsApi() {
  const response = await httpRequest<{ data?: TrainerGroupClassFormOptions } | TrainerGroupClassFormOptions>(
    "/trainer/group-classes/form-options"
  );
  if ("data" in (response as any)) {
    return ((response as any).data || {
      business_hours: null,
      allowed_categories: [],
      packages: [],
      members: [],
    }) as TrainerGroupClassFormOptions;
  }

  return response as TrainerGroupClassFormOptions;
}

export async function createTrainerGroupClassApi(payload: {
  title: string;
  starts_at: string;
  ends_at: string;
  related_package_id?: string | null;
  capacity?: number;
  lesson_category?: string | null;
  price?: string | number | null;
  notification_scope?: "SALON_MEMBERS" | "INVITED_MEMBERS";
  requires_admin_approval?: boolean;
  invited_member_count?: number;
  invited_member_ids?: string[];
  recurrence_label?: string | null;
  special_date?: string | null;
}) {
  const response = await httpRequest<{ data?: GroupClassSession } | GroupClassSession>("/trainer/group-classes", {
    method: "POST",
    body: payload,
  });
  return "data" in (response as any) ? (response as any).data || null : response;
}

export async function updateTrainerGroupClassApi(
  id: string,
  payload: {
    title?: string;
    starts_at?: string;
    ends_at?: string;
    related_package_id?: string | null;
    capacity?: number;
    lesson_category?: string | null;
    price?: string | number | null;
    notification_scope?: "SALON_MEMBERS" | "INVITED_MEMBERS";
    requires_admin_approval?: boolean;
    invited_member_count?: number;
    invited_member_ids?: string[];
    recurrence_label?: string | null;
    special_date?: string | null;
    status?: string | null;
  }
) {
  const response = await httpRequest<{ data?: GroupClassSession } | GroupClassSession>(`/trainer/group-classes/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: payload,
  });
  return "data" in (response as any) ? (response as any).data || null : response;
}

export async function deleteTrainerGroupClassApi(id: string) {
  return httpRequest<any>(`/trainer/group-classes/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function getTrainerAvailabilitiesApi() {
  return httpRequest<TrainerAvailabilityEntry[]>("/trainer/bookings/availabilities");
}

export async function createTrainerScheduleChangeRequestApi(
  id: string,
  payload: { starts_at: string; ends_at: string; member_id: string; note?: string | null }
) {
  return httpRequest<TrainerScheduleChangeRequest>(`/trainer/bookings/${encodeURIComponent(id)}/schedule-change-request`, {
    method: "POST",
    body: payload,
  });
}

export async function getTrainerBookingFormOptionsApi() {
  return httpRequest<any>("/trainer/bookings/form-options");
}

export async function getTrainerAssignedPackagesApi() {
  const response = await getTrainerBookingFormOptionsApi();
  const data = "data" in (response as any) ? (response as any).data || {} : response;
  return Array.isArray((data as any)?.packages) ? ((data as any).packages as TrainerAssignedPackage[]) : [];
}

export async function createTrainerBookingApi(payload: {
  member_id: string;
  starts_at: string;
  ends_at: string;
  status?: string;
  session_id?: string;
  meta: {
    package_id: string;
    package_title?: string | null;
    note?: string | null;
  };
}) {
  return httpRequest<any>("/trainer/bookings", {
    method: "POST",
    body: payload,
  });
}

export async function patchTrainerBookingStatusApi(
  id: string,
  payload: { status: string; starts_at?: string; ends_at?: string; meta?: Record<string, unknown> }
) {
  return httpRequest<any>(`/trainer/bookings/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: payload,
  });
}

export async function getTrainerCheckinLogsApi(memberId?: string) {
  const query = memberId ? `?member_id=${encodeURIComponent(memberId)}` : "";
  return httpRequest<any>(`/trainer/checkin/logs${query}`);
}

export async function trainerManualCheckinApi(payload: { member_id?: string; manual_code?: string; session_id?: string }) {
  return httpRequest<QrScanResult>("/trainer/checkin/manual", {
    method: "POST",
    body: payload,
  });
}

export async function trainerQrCheckinApi(payload: { qr_code: string; session_id?: string; scan_context?: QrScanContext }) {
  return httpRequest<QrScanResult>("/trainer/checkin/qr", {
    method: "POST",
    body: payload,
  });
}

export async function getTrainerMembersApi() {
  return httpRequest<TrainerMemberListItem[]>("/trainer/members");
}

export async function getTrainerMemberDetailApi(id: string) {
  return httpRequest<any>(`/trainer/members/${id}`);
}

export async function getTrainerMemberAttendanceApi(id: string) {
  return httpRequest<any>(`/trainer/members/${id}/attendance`);
}

export async function getTrainerMemberMeasurementsApi(id: string) {
  return httpRequest<any>(`/trainer/members/${id}/measurements`);
}

export async function getTrainerMemberNotesApi(id: string) {
  return httpRequest<any>(`/trainer/members/${id}/notes`);
}

export async function updateTrainerMemberNotesApi(
  id: string,
  note: { title?: string | null; body: string; category: StructuredTrainerNote["category"] }
) {
  return httpRequest<any>(`/trainer/members/${id}/notes`, {
    method: "PUT",
    body: note,
  });
}

export async function createTrainerMemberNoteApi(
  id: string,
  note: { title?: string | null; body: string; category: StructuredTrainerNote["category"] }
) {
  return httpRequest<any>(`/trainer/members/${id}/notes`, {
    method: "POST",
    body: note,
  });
}

export async function patchTrainerMemberNoteApi(
  id: string,
  noteId: string,
  note: { title?: string | null; body: string; category: StructuredTrainerNote["category"] }
) {
  return httpRequest<any>(`/trainer/members/${id}/notes/${encodeURIComponent(noteId)}`, {
    method: "PATCH",
    body: note,
  });
}

export async function deleteTrainerMemberNoteApi(id: string, noteId: string) {
  return httpRequest<any>(`/trainer/members/${id}/notes/${encodeURIComponent(noteId)}`, {
    method: "DELETE",
  });
}

export async function trainerRescheduleBookingApi(id: string, payload: BookingReschedulePayload) {
  return httpRequest<any>(`/trainer/bookings/${encodeURIComponent(id)}/reschedule`, {
    method: "PATCH",
    body: payload,
  });
}

export async function getTrainerRiskApi() {
  return httpRequest<any>("/trainer/risk/members");
}

export async function getAdminDashboardApi() {
  return httpRequest<any>("/admin/dashboard");
}

export async function getAdminClinicQrApi() {
  return httpRequest<any>("/admin/clinic/qr");
}

export async function getAdminClinicSubscriptionApi() {
  return httpRequest<AdminClinicSubscription>("/admin/clinic/subscription");
}

export async function startAdminClinicTrialApi() {
  return httpRequest<AdminClinicSubscription>("/admin/clinic/subscription/start-trial", {
    method: "POST",
  });
}

export async function getAdminBookingsApi(query?: {
  from?: string;
  to?: string;
  trainer_id?: string;
  member_id?: string;
  status?: string;
}) {
  const search = new URLSearchParams();
  if (query?.from) search.set("from", query.from);
  if (query?.to) search.set("to", query.to);
  if (query?.trainer_id) search.set("trainer_id", query.trainer_id);
  if (query?.member_id) search.set("member_id", query.member_id);
  if (query?.status) search.set("status", query.status);
  const qs = search.toString();
  const response = await httpRequest<{ data?: any[] } | any[]>(`/admin/bookings${qs ? `?${qs}` : ""}`);
  if (Array.isArray(response)) return response;
  return Array.isArray((response as any)?.data) ? (response as any).data : [];
}

export async function getAdminSessionsApi(query?: { status?: string }) {
  const search = new URLSearchParams();
  if (query?.status) search.set("status", query.status);
  const qs = search.toString();
  const response = await httpRequest<{ data?: GroupClassSession[] } | GroupClassSession[]>(`/admin/sessions${qs ? `?${qs}` : ""}`);
  if (Array.isArray(response)) return response;
  return Array.isArray((response as any)?.data) ? (response as any).data : [];
}

export async function getAdminMobileApprovalsApi() {
  return httpRequest<AdminApprovalItem[]>("/admin/mobile-approvals");
}

export async function getAdminRiskMembersApi() {
  const response = await httpRequest<{ data?: AdminRiskMemberItem[] } | AdminRiskMemberItem[]>(
    "/admin/risk/members?riskSegment=AT_RISK&memberActivity=ACTIVE&limit=100"
  );
  if (Array.isArray(response)) return response;
  return Array.isArray(response?.data) ? response.data : [];
}

export async function getAdminMembersApi() {
  const response = await httpRequest<{ data?: AdminCompactMember[] } | AdminCompactMember[]>("/admin/members");
  if (Array.isArray(response)) return response;
  return Array.isArray(response?.data) ? response.data : [];
}

export async function getAdminTrainersApi() {
  const response = await httpRequest<{ data?: AdminCompactMember[] } | AdminCompactMember[]>("/admin/trainers");
  const data = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];
  return data.map((item) => ({ ...item, role: "TRAINER" as const }));
}

export async function getAdminPackagesApi() {
  const response = await httpRequest<{ data?: AdminPackage[] } | AdminPackage[]>("/admin/packages");
  if (Array.isArray(response)) return response;
  return Array.isArray(response?.data) ? response.data : [];
}

export async function getAdminPackageFormOptionsApi() {
  const response = await httpRequest<{ data?: AdminPackageFormOptions } | AdminPackageFormOptions>("/admin/packages/form-options");
  return "data" in (response as any) ? (response as any).data || {} : response || {};
}

export async function createAdminPackageApi(payload: {
  title: string;
  total_credits: number;
  duration_days: number;
  is_active?: boolean;
  is_visible?: boolean;
  is_public?: boolean;
  service_key: string;
  display_price?: number;
  trainer_commission_rate?: number;
  capacity?: number;
  summary?: string;
  lesson_mode?: string;
  sub_lessons?: string[];
  linked_group_class_ids?: string[];
  linked_group_class_titles?: string[];
  session_duration_minutes?: number;
  break_duration_minutes?: number;
}) {
  const response = await httpRequest<{ data?: AdminPackage } | AdminPackage>("/admin/packages", {
    method: "POST",
    body: payload,
  });
  return "data" in (response as any) ? (response as any).data || null : response;
}

export async function updateAdminPackageApi(
  id: string,
  payload: {
    title?: string;
    total_credits?: number;
    duration_days?: number;
    is_active?: boolean;
    is_visible?: boolean;
    is_public?: boolean;
    service_key?: string;
    display_price?: number;
    trainer_commission_rate?: number;
    capacity?: number;
    summary?: string;
    lesson_mode?: string;
    sub_lessons?: string[];
    linked_group_class_ids?: string[];
    linked_group_class_titles?: string[];
    session_duration_minutes?: number;
    break_duration_minutes?: number;
  }
) {
  const response = await httpRequest<{ data?: AdminPackage } | AdminPackage>(`/admin/packages/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: payload,
  });
  return "data" in (response as any) ? (response as any).data || null : response;
}

export async function deleteAdminPackageApi(id: string) {
  return httpRequest<{ message?: string }>(`/admin/packages/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function getAdminPackageAssignmentsApi(query?: {
  trainer_id?: string;
  package_id?: string;
  is_active?: boolean;
} | any) {
  const search = new URLSearchParams();
  if (query?.trainer_id) search.set("trainer_id", query.trainer_id);
  if (query?.package_id) search.set("package_id", query.package_id);
  if (query?.is_active !== undefined) search.set("is_active", String(query.is_active));
  const qs = search.toString();
  const response = await httpRequest<{ data?: AdminPackageAssignment[] } | AdminPackageAssignment[]>(
    `/admin/package-trainers${qs ? `?${qs}` : ""}`
  );
  if (Array.isArray(response)) return response;
  return Array.isArray(response?.data) ? response.data : [];
}

export async function createAdminPackageAssignmentApi(payload: { package_id: string; trainer_id: string }) {
  const response = await httpRequest<{ data?: AdminPackageAssignment } | AdminPackageAssignment>("/admin/package-trainers", {
    method: "POST",
    body: payload,
  });
  return "data" in (response as any) ? (response as any).data || null : response;
}

export async function deleteAdminPackageAssignmentApi(id: string) {
  return httpRequest<{ message?: string }>(`/admin/package-trainers/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function getAdminMemberDetailApi(id: string) {
  const response = await httpRequest<{ data?: AdminMemberDetail } | AdminMemberDetail>(`/admin/members/${encodeURIComponent(id)}`);
  const data = "data" in (response as any) ? (response as any).data || null : response;
  return data ? { ...data, role: "MEMBER" as const } : null;
}

export async function getAdminMemberPackagesApi(id: string) {
  const response = await httpRequest<AdminMemberPackagesResponse>(
    `/admin/members/${encodeURIComponent(id)}/packages`
  );

  return {
    data: Array.isArray(response.data) ? response.data : [],
    totalRemainingCredits: Number(response.totalRemainingCredits || 0),
  };
}

export async function assignAdminMemberPackageApi(
  id: string,
  payload: {
    package_id: string;
    starts_at?: string;
    expires_at?: string | null;
  }
) {
  const response = await httpRequest<{ data?: AdminMemberPackage } | AdminMemberPackage>(
    `/admin/members/${encodeURIComponent(id)}/packages`,
    {
      method: "POST",
      body: payload,
    }
  );

  return "data" in (response as any) ? (response as any).data || null : response;
}

export async function adjustAdminMemberPackageCreditsApi(
  userPackageId: string,
  remaining_credits: number
) {
  const response = await httpRequest<{ data?: AdminMemberPackage } | AdminMemberPackage>(
    `/admin/members/user-packages/${encodeURIComponent(userPackageId)}/credits`,
    {
      method: "PATCH",
      body: { remaining_credits },
    }
  );

  return "data" in (response as any) ? (response as any).data || null : response;
}

export async function removeAdminMemberPackageApi(userPackageId: string) {
  const response = await httpRequest<{ message?: string; data?: AdminMemberPackage }>(
    `/admin/members/user-packages/${encodeURIComponent(userPackageId)}`,
    {
      method: "DELETE",
    }
  );

  return response;
}

export async function getAdminTrainerDetailApi(id: string) {
  const response = await httpRequest<{ data?: AdminMemberDetail } | AdminMemberDetail>(`/admin/trainers/${encodeURIComponent(id)}`);
  const data = "data" in (response as any) ? (response as any).data || null : response;
  return data ? { ...data, role: "TRAINER" as const } : null;
}

export async function getAdminMemberAttendanceApi(id: string) {
  const response = await httpRequest<{ data?: any[] } | any[]>(`/admin/members/${encodeURIComponent(id)}/attendance`);
  if (Array.isArray(response)) return response;
  return Array.isArray((response as any)?.data) ? (response as any).data : [];
}

export async function getAdminMemberMeasurementsApi(id: string) {
  const response = await httpRequest<{ data?: any[] } | any[]>(`/admin/members/${encodeURIComponent(id)}/measurements`);
  if (Array.isArray(response)) return response;
  return Array.isArray((response as any)?.data) ? (response as any).data : [];
}

export async function getAdminMemberRetentionApi(id: string) {
  const response = await httpRequest<{ data?: any } | any>(`/admin/members/${encodeURIComponent(id)}/retention-score`);
  return "data" in (response as any) ? (response as any).data || null : response;
}

export async function getAdminTrainerSkillsApi(id: string) {
  const response = await httpRequest<{ data?: string[] } | string[]>(`/admin/trainers/${encodeURIComponent(id)}/skills`);
  if (Array.isArray(response)) return response;
  return Array.isArray((response as any)?.data) ? (response as any).data : [];
}

export async function getAdminTrainerEarningsApi(id: string) {
  const response = await httpRequest<{ data?: AdminTrainerEarnings } | AdminTrainerEarnings>(`/admin/trainers/${encodeURIComponent(id)}/earnings`);
  return "data" in (response as any) ? (response as any).data || null : response;
}

export async function approveAdminMobileItemApi(id: string, decision: "APPROVE" | "REJECT") {
  return httpRequest<AdminApprovalItem>(`/admin/mobile-approvals/${id}`, {
    method: "PATCH",
    body: { decision },
  });
}

export async function adminSalonEntryScanApi(payload: { qr_code?: string; manual_code?: string }) {
  return httpRequest<QrScanResult>("/admin/qr/scan-entry", {
    method: "POST",
    body: payload,
  });
}

export async function adminRescheduleBookingApi(id: string, payload: BookingReschedulePayload) {
  return httpRequest<any>(`/admin/bookings/${encodeURIComponent(id)}/reschedule`, {
    method: "PATCH",
    body: payload,
  });
}

export async function triggerAdminNotificationTemplate(payload: {
  type: string;
  send_now?: boolean;
  audience?: string;
}) {
  return httpRequest<any>("/admin/settings/notifications/trigger", {
    method: "POST",
    body: payload,
  });
}

export async function getAdminNotificationLogsApi(limit = 40) {
  const response = await httpRequest<{ data?: AdminNotificationLogItem[] } | AdminNotificationLogItem[]>(
    `/admin/settings/notifications/logs?limit=${encodeURIComponent(String(limit))}`
  );
  if (Array.isArray(response)) return response;
  return Array.isArray((response as any)?.data) ? (response as any).data : [];
}

export async function getAdminSettingsApi() {
  return httpRequest<any>("/admin/settings");
}

export async function updateAdminSettingsApi(payload: Record<string, unknown>) {
  return httpRequest<any>("/admin/settings", {
    method: "PUT",
    body: payload,
  });
}

export async function getAdminCampaignsApi() {
  return httpRequest<AdminCampaignListResponse>("/admin/campaigns");
}

export async function getAdminCampaignApi(id: string) {
  return httpRequest<{ campaign: AdminCampaign; campaign_type: "REFERRAL" | "ATTENDANCE" }>(
    `/admin/campaigns/${encodeURIComponent(id)}`
  );
}

export async function createAdminCampaignApi(payload: {
  name: string;
  audience: "ALL" | "RISK" | "NEW";
  trigger_type: "REFERRAL" | "ATTENDANCE";
  trigger_count: number;
  reward_type: "DISCOUNT" | "FREE_CLASS";
  reward_value: number;
  reward_target?: "REFERRER" | "REFERRED" | "BOTH";
  is_active?: boolean;
}) {
  return httpRequest<any>("/admin/campaigns", {
    method: "POST",
    body: payload,
  });
}

export async function updateAdminCampaignApi(
  id: string,
  payload: {
    name?: string;
    audience?: "ALL" | "RISK" | "NEW";
    trigger_count?: number;
    reward_type?: "DISCOUNT" | "FREE_CLASS";
    reward_value?: number;
    reward_target?: "REFERRER" | "REFERRED" | "BOTH";
    is_active?: boolean;
  }
) {
  return httpRequest<any>(`/admin/campaigns/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: payload,
  });
}
