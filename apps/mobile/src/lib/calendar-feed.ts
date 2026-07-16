import type { CalendarFeedEvent } from "@fitnes-saas/contracts";

export type CalendarFeedRange = {
  from: string;
  to: string;
  timezone?: string;
};

export function createCalendarFeedRange(now = new Date()): CalendarFeedRange {
  const from = new Date(now);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 26 * 7 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function calendarFeedEventToDetailRow(event: CalendarFeedEvent): Record<string, any> {
  return {
    ...event.details,
    id: event.details.booking_id || event.details.session_id || event.entity_id,
    calendar_event_id: event.id,
    source: event.source,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    status: event.status,
    approval_status: event.approval_status,
    is_cancelled: event.is_cancelled,
    conflict: event.conflict,
    pending_schedule_change: event.details.pending_schedule_change || null,
    is_group_class: Boolean(event.details.is_group_class),
    is_duo: Boolean(event.details.is_duo),
    lesson_name: event.details.session_title || null,
    package_name: event.details.package_title || null,
    presentation: event.presentation,
  };
}
