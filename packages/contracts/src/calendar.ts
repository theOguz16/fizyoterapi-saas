export type CalendarFeedRole = "ADMIN" | "TRAINER" | "MEMBER";
export type CalendarFeedSource = "BOOKING" | "GROUP_SESSION" | "AVAILABILITY" | "PENDING_AVAILABILITY";
export type CalendarFeedApprovalStatus = "NONE" | "PENDING" | "APPROVED" | "REJECTED";
export type CalendarFeedBadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

export type CalendarFeedEvent = {
  id: string;
  source: CalendarFeedSource;
  entity_id: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: string;
  approval_status: CalendarFeedApprovalStatus;
  is_cancelled: boolean;
  recurrence: {
    kind: "NONE" | "WEEKLY";
    template_id: string | null;
    occurrence_starts_at: string | null;
  };
  conflict: {
    has_conflict: boolean;
    event_ids: string[];
  };
  presentation: {
    title: string;
    subtitle: string;
    badge_label: string;
    badge_tone: CalendarFeedBadgeTone;
  };
  details: {
    booking_id?: string | null;
    session_id?: string | null;
    member_id?: string | null;
    member_full_name?: string | null;
    trainer_id?: string | null;
    trainer_full_name?: string | null;
    package_id?: string | null;
    package_title?: string | null;
    session_title?: string | null;
    lesson_category?: string | null;
    lesson_category_label?: string | null;
    is_group_class?: boolean;
    is_duo?: boolean;
    duo_partner_name?: string | null;
    duo_status?: string | null;
    recurrence_label?: string | null;
    pending_schedule_change?: {
      request_id: string;
      proposed_starts_at: string;
      proposed_ends_at: string;
    } | null;
    [key: string]: unknown;
  };
};

export type CalendarFeed = {
  role: CalendarFeedRole;
  timezone: string;
  range: {
    from: string;
    to: string;
  };
  business_hours: {
    timezone?: string | null;
    working_days?: number[] | null;
    start_time?: string | null;
    end_time?: string | null;
    lunch_break_start?: string | null;
    lunch_break_end?: string | null;
    slot_minutes?: number | null;
    break_duration_minutes?: number | null;
  } | null;
  events: CalendarFeedEvent[];
};
