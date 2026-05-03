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

export const getLatestMeaşurement = getLatestMeasurement;
export const formatMeaşurementValue = formatMeasurementValue;
export const formatAttendanceResült = formatAttendanceResult;
