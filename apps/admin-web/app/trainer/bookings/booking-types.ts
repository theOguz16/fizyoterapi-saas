export type AvailabilityItem = {
  id: string;
  member_id: string;
  member_full_name?: string | null;
  member_email?: string | null;
  member_weekly_class_hours?: number | null;
  starts_at: string;
  ends_at: string;
  package_id?: string | null;
  package_title?: string | null;
  package_display_price?: string | null;
  package_lesson_category?: string | null;
  note?: string;
};

export type BookingItem = {
  id: string;
  member_id: string;
  member_full_name?: string | null;
  trainer_id: string;
  session_id?: string;
  starts_at: string;
  ends_at: string;
  status: "PENDING" | "APPROVED" | "CANCELED" | "RESCHEDULED";
  session_title?: string | null;
  lesson_category?: string | null;
  payment_status?: "REQUESTED" | "APPROVED" | "REJECTED";
  package_title?: string | null;
  package_display_price?: string | null;
  meta?: Record<string, unknown>;
};

export type CalendarBusinessHours = {
  timezone?: string;
  working_days?: number[];
  start_time?: string;
  end_time?: string;
  lunch_break_start?: string;
  lunch_break_end?: string;
  slot_minutes?: number;
};

export type BookingOptionPayload = {
  data: {
    members: Array<{ id: string; full_name: string; email: string }>;
    packages: Array<{
      id: string;
      title: string;
      service_name?: string | null;
      display_price?: string | null;
      lesson_category?: string | null;
      package_type?: string | null;
    }>;
    trainer_assigned_packages?: string[];
    member_active_package_ids?: Record<string, string[]>;
    member_bookable_package_ids?: Record<string, string[]>;
    member_package_diagnostics?: Record<
      string,
      {
        active_member_packages: string[];
        trainer_assigned_packages: string[];
        intersection_packages: string[];
        reason_codes: string[];
      }
    >;
    allowed_categories: string[];
    slot_contract?: CalendarBusinessHours;
  };
};

export type ManualSlotOption = {
  value: string;
  starts_at: string;
  ends_at: string;
  package_id?: string | null;
  package_title?: string | null;
  lesson_category?: string | null;
  availability_note?: string | null;
};

export type PendingDropBooking = {
  member_id: string;
  starts_at: string;
  ends_at: string;
  availability_note?: string;
  package_ids: string[];
};

export type BookingMode = "manual" | "drag";
