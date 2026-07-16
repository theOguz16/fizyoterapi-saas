export type RetentionSignal = {
  score?: number | null;
  reason?: string | null;
  reasom?: string | null;
};

export type AdminDirectoryPerson = {
  id: string;
  user_id?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  is_active?: boolean;
  created_at?: string | null;
  role?: "MEMBER" | "TRAINER";
  status?: string | null;
  membership_status?: string | null;
  retention?: RetentionSignal | null;
  retention_score?: number | null;
  risk_reason?: string | null;
  risk_reasom?: string | null;
  risk_level_label?: string | null;
};

export type TrainerClientSummary = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  is_active?: boolean;
  qr_code?: string | null;
  retention_score?: number | null;
  risk_reason?: string | null;
  risk_reasom?: string | null;
  risk_level_label?: string | null;
};

export type TrainerMemberPackageSummary = {
  user_package_id: string;
  package_id: string;
  package_title?: string | null;
  package_type?: string | null;
  package_total_credits?: number | null;
  package_duration_days?: number | null;
  package_price?: number | null;
  package_rules?: Record<string, unknown> | null;
  remaining_credits: number;
  is_active: boolean;
  starts_at?: string | null;
  expires_at?: string | null;
  is_expired?: boolean;
  trainer_summary?: string | null;
};

export type TrainerMemberDetail = TrainerClientSummary & {
  full_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  onboarding_profile?: {
    role?: "MEMBER" | "TRAINER" | "ADMIN";
    primary_goal?: string;
    rhythm?: string;
    support_style?: string;
  } | null;
  stats?: {
    booking_count?: number | null;
    checkin_count?: number | null;
    latest_measured_at?: string | null;
  };
  package_summary?: TrainerMemberPackageSummary[];
  campaign_rewards?: Array<{
    id: string;
    credits_granted: number;
    rule_name: string;
    granted_at: string;
  }>;
  attendance_trend?: Array<{ week_start: string; count: number }>;
};

export type TrainerMemberMeasurement = {
  id: string;
  measured_at: string;
  height_cm?: string | number | null;
  weight_kg?: string | number | null;
  fat_percent?: string | number | null;
  muscle_kg?: string | number | null;
  muscle_percent?: string | number | null;
};

export type TrainerMemberAttendance = {
  id: string;
  created_at: string;
  result?: string | null;
  credits_deducted?: number | null;
  session_title?: string | null;
  session_type?: string | null;
  lesson_category?: string | null;
};

export type TrainerMemberNote = {
  id: string;
  title?: string | null;
  body: string;
  note: string;
  category: "GENERAL" | "GOAL" | "RISK" | "FOLLOW_UP";
  created_at?: string | null;
  updated_at?: string | null;
};

export type TrainerMemberNoteState = {
  member_id: string;
  note: string;
  title?: string | null;
  body: string;
  category: TrainerMemberNote["category"];
  updated_at?: string | null;
};

export type TrainerMemberNotes = TrainerMemberNoteState & {
  items: TrainerMemberNote[];
  count: number;
};
