// Mobile API tarafinda paylasilan veri sozlesmeleri.
// Endpoint implementasyonlari domain dosyalarinda tutulur.

// Mobil uygulamanin backend ile sozlesme katmani.
// Type tanimlari ve endpoint fonksiyonlari burada tutuluyor ki ekranlar
// ham fetch ayrintilarini degil is alanlarini tuksun.
export type SessionRole = "ADMIN" | "TRAINER" | "MEMBER";

export type ProductEventName =
  | "app_opened"
  | "clinic_signup_started"
  | "clinic_qr_viewed"
  | "member_invite_started"
  | "subscription_viewed"
  | "purchase_started";

export type ProductEventPayload = {
  event_name: ProductEventName;
  event_id: string;
  occurred_at: string;
  install_id: string;
  session_id: string;
  metadata: Record<string, string | null>;
};

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
    subscription_started_at?: string | null;
    subscription_current_period_ends_at?: string | null;
    subscription_last_event_at?: string | null;
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
  subscription_started_at?: string | null;
  subscription_current_period_ends_at?: string | null;
  subscription_last_event_at?: string | null;
  trial_days_total: number;
  trial_days_remaining: number;
  has_trial_history: boolean;
  can_start_trial: boolean;
  can_purchase_in_app: boolean;
  purchase_provider: "REVENUECAT";
  purchase_mode: "IN_APP_PURCHASE";
  recommended_action: "WAIT_REVIEW" | "WAIT_SETUP" | "START_TRIAL" | "PURCHASE_IN_APP" | "MANAGE_PLAN";
  sync_state?: "IDLE" | "PENDING_SYNC" | "SYNCED" | "FAILED";
  subscription_history_summary?: {
    last_event_type?: string | null;
    last_event_at?: string | null;
    product_id?: string | null;
    store?: string | null;
  } | null;
  store_products?: {
    provider?: "REVENUECAT" | string;
    monthly_product_id?: string | null;
    yearly_product_id?: string | null;
  } | null;
};

export type MobileNotificationPreferences = {
  class_reminders: {
    three_hours: boolean;
    one_hour: boolean;
  };
  subscription_trial_reminders: {
    forty_eight_hours: boolean;
    twenty_four_hours: boolean;
    twelve_hours: boolean;
    four_hours: boolean;
  };
  package_expiry_reminders: boolean;
  campaign_alerts: boolean;
  weekly_summary: boolean;
  measurement_reminders: boolean;
  quiet_hours: {
    enabled: boolean;
    start: string;
    end: string;
  };
};

export type AdminSubscriptionHistoryItem = {
  type: string;
  occurred_at: string;
  title: string;
  description: string;
};

export type AdminRevenueReport = {
  from: string;
  to: string;
  total_revenue: number;
  sale_count: number;
  average_sale: number;
  by_package: Array<{
    package_id: string;
    package_title: string;
    amount: number;
    count: number;
  }>;
  rows: Array<Record<string, unknown>>;
};

export type MemberGroupClassWaitlist = {
  session_id: string;
  count?: number;
  joined: boolean;
  position?: number | null;
  removed?: boolean;
};

export type TrainerRequestCenterItem = {
  id: string;
  booking_id: string;
  member_id: string;
  current_starts_at: string;
  current_ends_at?: string | null;
  proposed_starts_at: string;
  proposed_ends_at?: string | null;
  note?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
};

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
  updated_at?: string;
  last_attended_at?: string | null;
  active_package_count?: number;
  active_packages?: unknown[];
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
  items: AdminMemberPackage[];
  totalRemainingCredits: number;
};

export type AdminTrainerEarnings = {
  daily_income?: number;
  weekly_income?: number;
  monthly_income?: number;
  yearly_income?: number;
};
