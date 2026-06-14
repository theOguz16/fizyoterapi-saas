// Bu helper modulu mobil tarafta member progress ile ilgili veri donusumu, is kurali veya API erisimini toplar.
// Ekranlar ham ayrintilar yerine bu dosyadaki yardimcilari kullanarak daha yalniz kalir.
type AttendanceSummaryLike = {
  total_attendance_count?: number | null;
  group_attendance_count?: number | null;
  remaining_total_credits?: number | null;
};

type MeasurementLike = {
  measured_at?: string | null;
  weight_kg?: number | null;
  fat_percent?: number | null;
  muscle_kg?: number | null;
};

export function buildMemberProgressMetrics(summary?: AttendanceSummaryLike | null) {
  return {
    totalAttendance: summary?.total_attendance_count ?? 0,
    groupAttendance: summary?.group_attendance_count ?? 0,
    remainingCredits: summary?.remaining_total_credits ?? 0,
  };
}

export function getLatestMeasurement<T extends MeasurementLike>(rows: T[]) {
  return rows[0] ?? null;
}

export function formatMeasurementValue(value?: number | null, suffix = "") {
  if (value === null || value === undefined) return "-";
  return `${value}${suffix}`;
}

export function formatAttendanceResult(result?: string | null) {
  if (result === "CREDIT_DEDUCTED") return "Derse katıldı";
  return result || "Belirtilmedi";
}

export function buildPackageUsageForecast(input: {
  remainingCredits?: number | null;
  upcomingBookingCount?: number | null;
  weeklyUsage?: number | null;
  now?: Date;
}) {
  const remaining = Math.max(0, Number(input.remainingCredits || 0));
  const reserved = Math.max(0, Number(input.upcomingBookingCount || 0));
  const weeklyUsage = Math.max(1, Number(input.weeklyUsage || 1));
  const availableAfterReservations = Math.max(0, remaining - reserved);
  const weeksRemaining = remaining > 0 ? remaining / weeklyUsage : 0;
  const estimatedEnd = new Date((input.now || new Date()).getTime() + weeksRemaining * 7 * 24 * 60 * 60 * 1000);
  return {
    reservedCredits: Math.min(remaining, reserved),
    availableAfterReservations,
    weeksRemaining,
    estimatedEnd,
    shouldRenewSoon: remaining <= Math.max(2, weeklyUsage * 2),
  };
}

export function buildMeasurementTrend<T extends MeasurementLike>(rows: T[], key: "weight_kg" | "fat_percent" | "muscle_kg") {
  const valid = rows.filter((row) => typeof row[key] === "number");
  if (valid.length < 2) return null;
  const latest = Number(valid[0][key]);
  const previous = Number(valid[valid.length - 1][key]);
  const delta = latest - previous;
  return { latest, previous, delta, direction: delta > 0 ? "UP" : delta < 0 ? "DOWN" : "STABLE" } as const;
}

export const getLatestMeaşurement = getLatestMeasurement;
export const formatMeaşurementValue = formatMeasurementValue;
export const formatAttendanceResült = formatAttendanceResult;
