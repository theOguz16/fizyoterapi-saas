import { describe, expect, it } from "vitest";
import {
  buildRequestPlacementSlots,
  buildSelectedGroupMembers,
  buildTrainerRequests,
  trainerCalendarRangesOverlap,
} from "@/lib/trainer-calendar";

describe("trainer calendar helpers", () => {
  it("groups availability rows into one member request per package and day", () => {
    const requests = buildTrainerRequests([
      { id: "1", member_id: "member-1", member_full_name: "Ada", package_id: "pkg-1", package_title: "Paket", starts_at: "2026-07-20T09:00:00.000Z" },
      { id: "2", member_id: "member-1", member_full_name: "Ada", package_id: "pkg-1", package_title: "Paket", starts_at: "2026-07-20T10:00:00.000Z" },
    ]);
    expect(requests).toHaveLength(1);
    expect(requests[0].assignable_slots).toHaveLength(2);
  });

  it("keeps automatic scheduling preferences available as data without treating them as action requests", () => {
    const rows = [
      {
        id: "automatic",
        member_id: "member-1",
        starts_at: "2026-07-20T09:00:00.000Z",
        action_required: false,
        availability_kind: "AUTOMATIC_SCHEDULING_PREFERENCE" as const,
      },
      {
        id: "manual",
        member_id: "member-2",
        starts_at: "2026-07-21T09:00:00.000Z",
        action_required: true,
        availability_kind: "MANUAL_PLACEMENT_REQUEST" as const,
      },
    ];

    expect(buildTrainerRequests(rows)).toHaveLength(2);
    expect(buildTrainerRequests(rows.filter((row) => row.action_required !== false))).toMatchObject([
      { member_id: "member-2" },
    ]);
  });

  it("excludes placement slots that conflict with an existing booking", () => {
    const request = buildTrainerRequests([
      { id: "1", member_id: "member-1", starts_at: "2026-07-20T09:00:00.000Z", ends_at: "2026-07-20T10:00:00.000Z" },
    ])[0];
    const slots = buildRequestPlacementSlots(request, {
      timezone: "Europe/Istanbul",
      working_days: [1],
      start_time: "08:00",
      end_time: "18:00",
      lunch_break_start: null,
      lunch_break_end: null,
      slot_minutes: 60,
      break_duration_minutes: 0,
      is_configured: true,
    }, [{
      id: "booking-1",
      calendar_event_id: "booking:1",
      source: "BOOKING",
      starts_at: "2026-07-20T09:30:00.000Z",
      ends_at: "2026-07-20T10:30:00.000Z",
      status: "APPROVED",
      approval_status: "APPROVED",
      is_cancelled: false,
      conflict: { has_conflict: false, event_ids: [] },
      pending_schedule_change: null,
      is_group_class: false,
      is_duo: false,
      lesson_name: null,
      package_name: null,
      presentation: { title: "Ders", subtitle: "", badge_label: "Onaylı", badge_tone: "success" },
    }], 0);
    expect(slots).toEqual([]);
    expect(trainerCalendarRangesOverlap(new Date("2026-07-20T09:00:00.000Z"), new Date("2026-07-20T10:00:00.000Z"), "2026-07-20T09:30:00.000Z", "2026-07-20T10:30:00.000Z")).toBe(true);
  });

  it("resolves group participants through typed event details", () => {
    const members = buildSelectedGroupMembers({
      id: "session-1",
      calendar_event_id: "session:1",
      source: "GROUP_SESSION",
      starts_at: "2026-07-20T09:00:00.000Z",
      ends_at: "2026-07-20T10:00:00.000Z",
      status: "APPROVED",
      approval_status: "APPROVED",
      is_cancelled: false,
      conflict: { has_conflict: false, event_ids: [] },
      pending_schedule_change: null,
      is_group_class: true,
      is_duo: false,
      lesson_name: "Pilates",
      package_name: null,
      invited_member_ids: ["member-1"],
      presentation: { title: "Pilates", subtitle: "", badge_label: "Onaylı", badge_tone: "success" },
    }, new Map([["member-1", "Ada Yılmaz"]]));
    expect(members).toEqual([{ id: "member-1", name: "Ada Yılmaz", status: "INVITED" }]);
  });

  it("uses the member name supplied by the calendar feed participant contract", () => {
    const members = buildSelectedGroupMembers({
      id: "session-1",
      calendar_event_id: "session:1",
      source: "GROUP_SESSION",
      starts_at: "2026-07-20T09:00:00.000Z",
      ends_at: "2026-07-20T10:00:00.000Z",
      status: "APPROVED",
      approval_status: "APPROVED",
      is_cancelled: false,
      conflict: { has_conflict: false, event_ids: [] },
      pending_schedule_change: null,
      is_group_class: true,
      is_duo: false,
      lesson_name: "Pilates",
      package_name: null,
      participants: [{ member_id: "member-1", member_full_name: "Ada Yılmaz", status: "APPROVED" }],
      presentation: { title: "Pilates", subtitle: "", badge_label: "Onaylı", badge_tone: "success" },
    }, new Map());
    expect(members).toEqual([{ id: "member-1", name: "Ada Yılmaz", status: "APPROVED" }]);
  });
});
