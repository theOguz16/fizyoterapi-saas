// Bu helper modulu mobil tarafta trainer today ile ilgili veri donusumu, is kurali veya API erisimini toplar.
// Ekranlar ham ayrintilar yerine bu dosyadaki yardimcilari kullanarak daha yalniz kalir.
export function formatTrainerTodayDate(value?: string | null) {
  if (!value) return "Belirtilmedi";
  return new Date(value).toLocaleString("tr-TR");
}

export function selectTrainerNextBooking(bookings?: Array<any> | null) {
  if (!Array.isArray(bookings) || bookings.length === 0) return null;
  return bookings[0] || null;
}

export function selectTrainerRiskPreview(data?: { risk?: { preview?: Array<any> | null } } | null) {
  return Array.isArray(data?.risk?.preview) ? data!.risk!.preview! : [];
}

export function selectTrainerRecentCheckins(data?: { checkins?: Array<any> | null } | null, limit = 5) {
  return Array.isArray(data?.checkins) ? data!.checkins!.slice(0, limit) : [];
}
