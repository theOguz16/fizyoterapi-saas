import { formatStatusLabel, getStatusTone } from "@/theme/components/calendar-agenda";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type CalendarBookingLike = {
  id?: string | number | null;
  status?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  session_title?: string | null;
  lesson_category_label?: string | null;
  trainer_full_name?: string | null;
  package_title?: string | null;
  package_name?: string | null;
  pending_schedule_change?: boolean | null;
};

export type CalendarAvailabilityLike = {
  starts_at?: string | null;
  ends_at?: string | null;
  package_title?: string | null;
};

export type CalendarPendingSlotLike = {
  starts_at?: string | null;
  ends_at?: string | null;
  label?: string | null;
};

export type MemberCalendarEvent = {
  id: string;
  title: string;
  subtitle: string;
  startsAt: string;
  endsAt: string;
  badgeLabel: string;
  badgeTone: "warning" | "info" | "success" | "danger" | "neutral" | "primary";
  bookingId?: string;
};

export function startOfIsoWeek(date: Date) {
  const dt = new Date(date);
  const day = dt.getDay() || 7;
  dt.setDate(dt.getDate() - day + 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

export function projectRecurringAvailabilityRows(rows: CalendarAvailabilityLike[], from: Date, weeksAhead: number) {
  const to = new Date(from.getTime() + weeksAhead * WEEK_MS);
  const projected: CalendarAvailabilityLike[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const templateStart = new Date(row?.starts_at || "");
    const templateEnd = new Date(row?.ends_at || "");
    if (Number.isNaN(templateStart.getTime()) || Number.isNaN(templateEnd.getTime()) || templateEnd <= templateStart) {
      continue;
    }

    let offset = 0;
    if (templateEnd <= from) {
      offset = Math.floor((from.getTime() - templateStart.getTime()) / WEEK_MS);
    }

    let occurrenceStart = new Date(templateStart.getTime() + offset * WEEK_MS);
    let occurrenceEnd = new Date(templateEnd.getTime() + offset * WEEK_MS);

    while (occurrenceEnd <= from) {
      occurrenceStart = new Date(occurrenceStart.getTime() + WEEK_MS);
      occurrenceEnd = new Date(occurrenceEnd.getTime() + WEEK_MS);
    }

    while (occurrenceStart < to) {
      const startsAt = occurrenceStart.toISOString();
      const endsAt = occurrenceEnd.toISOString();
      const key = `${String(row?.package_title || "")}|${startsAt}|${endsAt}`;
      if (!seen.has(key)) {
        seen.add(key);
        projected.push({
          ...row,
          starts_at: startsAt,
          ends_at: endsAt,
        });
      }
      occurrenceStart = new Date(occurrenceStart.getTime() + WEEK_MS);
      occurrenceEnd = new Date(occurrenceEnd.getTime() + WEEK_MS);
    }
  }

  return projected.sort((a, b) => new Date(String(a.starts_at || "")).getTime() - new Date(String(b.starts_at || "")).getTime());
}

export function buildMemberCalendarEvents(params: {
  bookings: CalendarBookingLike[];
  approvedAvailabilityRows: CalendarAvailabilityLike[];
  pendingSelectedDays: CalendarPendingSlotLike[];
  from: Date;
  weeksAhead?: number;
}) {
  const { bookings, approvedAvailabilityRows, pendingSelectedDays, from, weeksAhead = 26 } = params;
  const bookingKeys = new Set(
    bookings.map((booking) => `${String(booking.starts_at || "")}|${String(booking.ends_at || "")}`)
  );

  const bookingEvents: MemberCalendarEvent[] = bookings
    .filter((booking) => booking?.starts_at && booking?.ends_at)
    .map((booking) => ({
      id: String(booking.id),
      bookingId: String(booking.id),
      title: booking.session_title || booking.lesson_category_label || "Ders",
      subtitle: `${booking.trainer_full_name || "Eğitmen"} • ${booking.package_title || booking.package_name || "Planlı seans"}`,
      startsAt: String(booking.starts_at),
      endsAt: String(booking.ends_at),
      badgeLabel: booking.pending_schedule_change ? "Saat Onayı Bekliyor" : formatStatusLabel(booking.status) || "Planlandı",
      badgeTone: booking.pending_schedule_change ? "warning" : (getStatusTone(booking.status) as MemberCalendarEvent["badgeTone"]),
    }));

  const approvedAvailabilityEvents: MemberCalendarEvent[] = projectRecurringAvailabilityRows(approvedAvailabilityRows, from, weeksAhead)
    .filter((row) => row?.starts_at && row?.ends_at)
    .filter((row) => !bookingKeys.has(`${String(row.starts_at || "")}|${String(row.ends_at || "")}`))
    .map((row, index) => ({
      id: `approved-availability-${index}-${String(row.starts_at)}`,
      title: row.package_title || "Onaylı saat tercihin",
      subtitle: "Admin onayı sonrası kaydedilen uygunluk",
      startsAt: String(row.starts_at),
      endsAt: String(row.ends_at),
      badgeLabel: "Onaylandı",
      badgeTone: "info",
    }));

  const pendingAvailabilityEvents: MemberCalendarEvent[] = pendingSelectedDays
    .filter((row) => row?.starts_at && row?.ends_at)
    .filter((row) => !bookingKeys.has(`${String(row.starts_at || "")}|${String(row.ends_at || "")}`))
    .map((row, index) => ({
      id: `pending-availability-${index}-${String(row.starts_at)}`,
      title: row.label || "Saat tercihin",
      subtitle: "Salon onayı bekleniyor",
      startsAt: String(row.starts_at),
      endsAt: String(row.ends_at),
      badgeLabel: "Onay bekliyor",
      badgeTone: "warning",
    }));

  return [...pendingAvailabilityEvents, ...approvedAvailabilityEvents, ...bookingEvents].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  );
}
