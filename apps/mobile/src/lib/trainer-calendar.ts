import type { NormalizedBusinessHours } from "./scheduling/business-hours.types";
import type { TrainerAvailabilityEntry } from "./mobile-api";
import type { CalendarDetailRow } from "./calendar-feed";
import type { TrainerScheduleRequest } from "./trainer-scheduler";

export type CalendarRequest = TrainerScheduleRequest & {
  request_date_key: string;
  request_date_label: string;
};

export type AvailableSlot = {
  key: string;
  startsAt: string;
  endsAt: string;
  label: string;
  dayKey: string;
  dayLabel: string;
};

export type SelectedGroupMember = { id: string; name: string; status: string };

export function formatTrainerDateTimeRange(startsAt?: string | null, endsAt?: string | null, timezone = "Europe/Istanbul") {
  if (!startsAt) return "-";
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : null;
  const day = start.toLocaleDateString("tr-TR", { weekday: "long", day: "2-digit", month: "long", timeZone: timezone });
  const startTime = start.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: timezone });
  const endTime = end ? end.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: timezone }) : "--:--";
  return `${day} • ${startTime} - ${endTime}`;
}

export function formatTrainerDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("tr-TR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
}

export function isOutsideMinimumLeadTime(startsAt: string, minHours: number, now = new Date()) {
  return new Date(startsAt).getTime() - now.getTime() < minHours * 60 * 60 * 1000;
}

export function trainerCalendarDateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}

export function addCalendarMinutes(dateInput: Date, minutes: number) {
  return new Date(dateInput.getTime() + minutes * 60 * 1000);
}

export function buildTrainerRequests(rows: TrainerAvailabilityEntry[]): CalendarRequest[] {
  const groups = new Map<string, CalendarRequest>();
  for (const row of rows) {
    if (!row.starts_at) continue;
    const dayKey = String(row.starts_at).slice(0, 10);
    const groupKey = `${row.member_id || row.member_full_name}-${dayKey}-${row.package_id || row.package_title || "paket"}`;
    const current = groups.get(groupKey);
    const endsAt = row.ends_at || addCalendarMinutes(new Date(row.starts_at), 60).toISOString();
    if (current) {
      if (!current.note && row.note) current.note = row.note;
      if (!current.assignable_slots.some((slot) => slot.starts_at === row.starts_at)) current.assignable_slots.push({ starts_at: row.starts_at, ends_at: endsAt });
      continue;
    }
    groups.set(groupKey, {
      id: groupKey,
      member_id: String(row.member_id || ""),
      member_full_name: row.member_full_name || "Danışan",
      package_id: row.package_id || null,
      package_title: row.package_title || "Paket",
      note: row.note || null,
      request_date_key: dayKey,
      request_date_label: new Date(`${dayKey}T00:00:00`).toLocaleDateString("tr-TR", { weekday: "long", day: "2-digit", month: "long" }),
      assignable_slots: [{ starts_at: row.starts_at, ends_at: endsAt }],
    });
  }
  return [...groups.values()].sort((a, b) => new Date(`${a.request_date_key}T00:00:00`).getTime() - new Date(`${b.request_date_key}T00:00:00`).getTime());
}

export function trainerCalendarRangesOverlap(startA: Date, endA: Date, startB?: string | null, endB?: string | null) {
  if (!startB) return false;
  const rangeStartB = new Date(startB);
  const rangeEndB = endB ? new Date(endB) : addCalendarMinutes(rangeStartB, 60);
  return startA < rangeEndB && endA > rangeStartB;
}

function timeToMinutes(value?: string | null, fallback = 0) {
  if (!value) return fallback;
  const [hour, minute] = String(value).split(":").map((piece) => Number(piece || 0));
  return hour * 60 + minute;
}

function isoDayNumber(date: Date) {
  return date.getDay() === 0 ? 7 : date.getDay();
}

export function slotFitsBusinessHours(slot: { starts_at: string; ends_at?: string | null }, businessHours: NormalizedBusinessHours | null) {
  if (!businessHours?.start_time || !businessHours?.end_time) return false;
  const start = new Date(slot.starts_at);
  const end = new Date(slot.ends_at || addCalendarMinutes(start, Number(businessHours.slot_minutes || 60)).toISOString());
  if (!businessHours.working_days.includes(isoDayNumber(start))) return false;
  const slotStart = start.getHours() * 60 + start.getMinutes();
  const slotEnd = end.getHours() * 60 + end.getMinutes();
  if (slotStart < timeToMinutes(businessHours.start_time) || slotEnd > timeToMinutes(businessHours.end_time)) return false;
  const lunchStart = timeToMinutes(businessHours.lunch_break_start, -1);
  const lunchEnd = timeToMinutes(businessHours.lunch_break_end, -1);
  return !(lunchStart >= 0 && lunchEnd >= 0 && slotStart < lunchEnd && slotEnd > lunchStart);
}

export function buildRequestPlacementSlots(
  request: CalendarRequest,
  businessHours: NormalizedBusinessHours | null,
  bookings: CalendarDetailRow[],
  minHoursBeforeStart: number,
): AvailableSlot[] {
  const dayBookings = bookings.filter((booking) => trainerCalendarDateKey(booking.starts_at) === request.request_date_key);
  return request.assignable_slots
    .filter((slot) => String(slot.starts_at).slice(0, 10) === request.request_date_key)
    .filter((slot) => slotFitsBusinessHours(slot, businessHours))
    .filter((slot) => !isOutsideMinimumLeadTime(slot.starts_at, minHoursBeforeStart))
    .filter((slot) => {
      const start = new Date(slot.starts_at);
      const end = new Date(slot.ends_at || addCalendarMinutes(start, Number(businessHours?.slot_minutes || 60)).toISOString());
      return !dayBookings.some((booking) => trainerCalendarRangesOverlap(start, end, booking.starts_at, booking.ends_at));
    })
    .map((slot) => {
      const start = new Date(slot.starts_at);
      const end = new Date(slot.ends_at || addCalendarMinutes(start, Number(businessHours?.slot_minutes || 60)).toISOString());
      return {
        key: `${request.request_date_key}-${start.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`,
        startsAt: slot.starts_at,
        endsAt: end.toISOString(),
        label: `${start.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`,
        dayKey: request.request_date_key,
        dayLabel: request.request_date_label,
      };
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

export function groupTrainerSlotsByDay(slots: Array<{ starts_at: string; ends_at?: string | null }>) {
  const groups = new Map<string, AvailableSlot[]>();
  for (const slot of slots) {
    if (!slot.starts_at) continue;
    const dayKey = String(slot.starts_at).slice(0, 10);
    const start = new Date(slot.starts_at);
    const end = new Date(slot.ends_at || addCalendarMinutes(start, 60).toISOString());
    const entry: AvailableSlot = {
      key: `${dayKey}-${start.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`,
      startsAt: slot.starts_at,
      endsAt: slot.ends_at || addCalendarMinutes(start, 60).toISOString(),
      label: `${start.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`,
      dayKey,
      dayLabel: new Date(`${dayKey}T00:00:00`).toLocaleDateString("tr-TR", { weekday: "long", day: "2-digit", month: "long" }),
    };
    groups.set(dayKey, [...(groups.get(dayKey) || []), entry]);
  }
  return [...groups.entries()].map(([dayKey, entries]) => ({
    dayKey,
    dayLabel: entries[0]?.dayLabel || dayKey,
    slots: entries.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
  })).sort((a, b) => new Date(`${a.dayKey}T00:00:00`).getTime() - new Date(`${b.dayKey}T00:00:00`).getTime());
}

export function buildSelectedGroupMembers(selectedBooking: CalendarDetailRow | null, memberNameMap: Map<string, string>): SelectedGroupMember[] {
  if (!selectedBooking?.is_group_class) return [];
  const participants = selectedBooking.participants || [];
  if (participants.length > 0) {
    return participants.map((participant) => ({
      id: String(participant.member_id || participant.id || ""),
      name: String(participant.member_full_name || participant.full_name || participant.email || participant.phone || "Salon üyesi"),
      status: String(participant.status || "").toUpperCase(),
    }));
  }
  const invitedIds = selectedBooking.invited_member_ids || [];
  return invitedIds.map((id) => {
    const memberId = String(id);
    const name = memberNameMap.get(memberId);
    return name ? { id: memberId, name, status: "INVITED" } : null;
  }).filter((item): item is SelectedGroupMember => Boolean(item));
}
