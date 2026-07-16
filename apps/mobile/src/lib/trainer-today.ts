// Bu helper modulu mobil tarafta trainer today ile ilgili veri donusumu, is kurali veya API erisimini toplar.
// Ekranlar ham ayrintilar yerine bu dosyadaki yardimcilari kullanarak daha yalniz kalir.
export type TrainerTodayBooking = {
  id?: string | number | null;
  member_id?: string | null;
  member_full_name?: string | null;
  starts_at?: string | null;
  session_title?: string | null;
  lesson_category_label?: string | null;
  lesson_category?: string | null;
  status?: string | null;
  session_id?: string | null;
  [key: string]: unknown;
};

const CLOSED_BOOKING_STATUSES = new Set(["CANCELED", "CANCELLED", "REJECTED", "COMPLETED"]);

export function sortTrainerTodayBookings(bookings?: TrainerTodayBooking[] | null) {
  if (!Array.isArray(bookings)) return [];

  return [...bookings].sort((left, right) => {
    const leftTime = new Date(String(left.starts_at || "")).getTime();
    const rightTime = new Date(String(right.starts_at || "")).getTime();
    const safeLeft = Number.isFinite(leftTime) ? leftTime : Number.MAX_SAFE_INTEGER;
    const safeRight = Number.isFinite(rightTime) ? rightTime : Number.MAX_SAFE_INTEGER;
    return safeLeft - safeRight;
  });
}

export function canTrainerBookingCheckIn(booking: TrainerTodayBooking) {
  return Boolean(booking.session_id) && !CLOSED_BOOKING_STATUSES.has(String(booking.status || "").toUpperCase());
}

export function canTrainerBookingManageSchedule(booking: TrainerTodayBooking) {
  return Boolean(booking.id) && !CLOSED_BOOKING_STATUSES.has(String(booking.status || "").toUpperCase());
}

export function formatTrainerTodayTime(value?: string | null) {
  if (!value) return "Saat yok";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saat yok";
  return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export function resolveTrainerFocusedBookingEventId(
  rows: Array<{ id?: unknown; entity_id?: unknown; calendar_event_id?: unknown }>,
  bookingId?: string | null
) {
  if (!bookingId) return null;
  const focused = rows.find((item) => {
    const calendarEventId = String(item.calendar_event_id || "");
    return (
      String(item.id || "") === bookingId ||
      String(item.entity_id || "") === bookingId ||
      calendarEventId === bookingId ||
      calendarEventId === `booking:${bookingId}`
    );
  });

  return focused?.calendar_event_id ? String(focused.calendar_event_id) : null;
}

export type TrainerRiskPreviewRow = {
  id?: string | number | null;
  member_id?: string | null;
  member_full_name?: string | null;
  full_name?: string | null;
  risk_score?: number | string | null;
  score?: number | string | null;
  risk_label?: string | null;
  level?: string | null;
  [key: string]: unknown;
};

export type TrainerCheckinRow = {
  id?: string | number | null;
  member_full_name?: string | null;
  created_at?: string | null;
  session_title?: string | null;
  lesson_category_label?: string | null;
  credits_deducted?: number | string | null;
  [key: string]: unknown;
};

export function formatTrainerTodayDate(value?: string | null) {
  if (!value) return "Belirtilmedi";
  return new Date(value).toLocaleString("tr-TR");
}

export function selectTrainerNextBooking(bookings?: TrainerTodayBooking[] | null) {
  return sortTrainerTodayBookings(bookings)[0] || null;
}

export function selectTrainerRiskPreview(data?: { risk?: { preview?: TrainerRiskPreviewRow[] | null } } | null) {
  return Array.isArray(data?.risk?.preview) ? data.risk.preview : [];
}

export function selectTrainerRecentCheckins(data?: { checkins?: TrainerCheckinRow[] | null } | null, limit = 5) {
  return Array.isArray(data?.checkins) ? data.checkins.slice(0, limit) : [];
}
