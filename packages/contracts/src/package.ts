export type PackageOption = {
  id: string;
  title: string;
  type?: string | null;
  display_price?: string | number | null;
  total_credits?: number | null;
  duration_days?: number | null;
  capacity?: number | null;
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
  weekly_class_hours?: number | null;
  required_preference_slots?: number | null;
  required_trainer_free_slots?: number | null;
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
  lesson_mode_options?: Array<{
    value: "PRIVATE" | "DUO" | "GROUP" | string;
    label: string;
    suggested_capacity: number;
  }>;
  linkable_group_classes?: Array<{
    id: string;
    lesson_name?: string | null;
    title?: string | null;
    starts_at?: string | null;
    ends_at?: string | null;
    special_date?: string | null;
    recurrence_label?: string | null;
    is_group_class?: boolean | null;
  }>;
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
