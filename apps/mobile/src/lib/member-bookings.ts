// Bu helper modulu mobil tarafta member bookings ile ilgili veri donusumu, is kurali veya API erisimini toplar.
// Ekranlar ham ayrintilar yerine bu dosyadaki yardimcilari kullanarak daha yalniz kalir.
type MemberBookingLike = {
  status?: string | null;
  starts_at?: string | null;
};

const cancelableStatuses = new Set(["PENDING", "APPROVED", "RESCHEDULED"]);

export function getBookingCancelState(row: MemberBookingLike, nowMs = Date.now()) {
  if (!cancelableStatuses.has(String(row.status))) return "İptal kapalı";
  const startsAt = row.starts_at ? new Date(row.starts_at).getTime() : Number.NaN;
  if (!Number.isFinite(startsAt)) return "İptal kapalı";
  return startsAt - nowMs >= 3 * 60 * 60 * 1000 ? "İptal edilebilir" : "İptal süresi doldu";
}

export function filterMemberBookingsBySegment<T extends MemberBookingLike>(
  rows: T[],
  segment: "upcoming" | "history",
  nowMs = Date.now()
) {
  return rows.filter((row) => {
    const startsAt = row.starts_at ? new Date(row.starts_at).getTime() : Number.NaN;
    if (!Number.isFinite(startsAt)) {
      return segment === "history";
    }
    if (segment === "upcoming") {
      return startsAt >= nowMs && row.status !== "CANCELED";
    }
    return startsAt < nowMs || row.status === "CANCELED";
  });
}
