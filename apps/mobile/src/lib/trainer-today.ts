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
  if (!Array.isArray(bookings) || bookings.length === 0) return null;
  return bookings[0] || null;
}

export function selectTrainerRiskPreview(data?: { risk?: { preview?: TrainerRiskPreviewRow[] | null } } | null) {
  return Array.isArray(data?.risk?.preview) ? data.risk.preview : [];
}

export function selectTrainerRecentCheckins(data?: { checkins?: TrainerCheckinRow[] | null } | null, limit = 5) {
  return Array.isArray(data?.checkins) ? data.checkins.slice(0, limit) : [];
}
