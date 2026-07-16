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
