// Bu helper modulu mobil tarafta purchase funnel ile ilgili veri donusumu, is kurali veya API erisimini toplar.
// Ekranlar ham ayrintilar yerine bu dosyadaki yardimcilari kullanarak daha yalniz kalir.
import type { PackageOption, PurchaseDaySelection, SalonDiscoverySummary, TrainerOption } from "./mobile-api";

const WEEKDAY_LABELS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

function deriveWeeklyClassHours(pkg?: Pick<PackageOption, "weekly_class_hours" | "total_credits"> | null) {
  const explicit = Number(pkg?.weekly_class_hours || 0);
  if (Number.isFinite(explicit) && explicit >= 1) {
    return Math.min(7, Math.max(1, Math.floor(explicit)));
  }
  const credits = Number(pkg?.total_credits || 0);
  if (Number.isFinite(credits) && credits > 0) {
    return Math.min(7, Math.max(1, Math.round(credits / 4)));
  }
  return 1;
}

function startOfIsoWeek(date: Date) {
  const dt = new Date(date);
  const day = dt.getDay() || 7;
  dt.setDate(dt.getDate() - day + 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function timeToMinutes(value?: string | null) {
  const [hour, minute] = String(value || "09:00")
    .split(":")
    .map((piece) => Number(piece || 0));
  return hour * 60 + minute;
}

export function buildSalonDayOptions(salon?: SalonDiscoverySummary | null): PurchaseDaySelection[] {
  const businessHours = salon?.business_hours;
  const start = startOfIsoWeek(new Date());
  const workingDays = Array.isArray(businessHours?.working_days) && businessHours?.working_days?.length ? businessHours.working_days : [1, 2, 3, 4, 5, 6];
  const startMinutes = timeToMinutes(businessHours?.start_time || "09:00");
  const endMinutes = timeToMinutes(businessHours?.end_time || "20:00");
  const result: PurchaseDaySelection[] = [];
  const timeRangeLabel = `${String(businessHours?.start_time || "09:00")} - ${String(businessHours?.end_time || "20:00")}`;
  const slotMinutes = Math.max(15, Number(businessHours?.slot_minutes || 60));
  const flowLabel = `${slotMinutes} dk ders`;

  for (let day = 0; day < 7; day += 1) {
    const isoDay = day + 1;
    if (!workingDays.includes(isoDay)) continue;
    const dayStart = new Date(start);
    dayStart.setDate(start.getDate() + day);
    dayStart.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
    const dayEnd = new Date(start);
    dayEnd.setDate(start.getDate() + day);
    dayEnd.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
    const weekdayLabel = WEEKDAY_LABELS[day] || `Gün ${isoDay}`;
    result.push({
      starts_at: dayStart.toISOString(),
      ends_at: dayEnd.toISOString(),
      label: `${weekdayLabel} • ${timeRangeLabel}`,
      weekday: isoDay,
      weekday_label: weekdayLabel,
      time_range_label: `${timeRangeLabel} • ${flowLabel}`,
    });
  }

  return result;
}

export function normalizePackageOptions(input: { data?: PackageOption[] } | PackageOption[] | undefined): PackageOption[] {
  const rows = Array.isArray(input) ? input : Array.isArray(input?.data) ? input.data : [];
  return rows.map((row, index) => ({
    ...(row || {}),
    id: row.id || `package-${index + 1}`,
    title: row.title || `Paket ${index + 1}`,
    display_price: row.display_price ?? null,
    total_credits: row.total_credits ?? null,
    weekly_class_hours: deriveWeeklyClassHours(row),
    required_preference_slots: row.required_preference_slots ?? deriveWeeklyClassHours(row) * 3,
    required_trainer_free_slots: row.required_trainer_free_slots ?? deriveWeeklyClassHours(row) * 2,
    summary: row.summary || "Seçili günlerle uyumlu paket.",
    is_available: row.is_available !== false,
    unavailable_reason: row.unavailable_reason || null,
  }));
}

export function fallbackPackageOptions(dayCount: number): PackageOption[] {
  return [
    {
      id: "starter",
      title: "Baslangic Paketi",
      display_price: 2400,
      total_credits: Math.max(dayCount, 4),
      weekly_class_hours: 1,
      required_preference_slots: 3,
      required_trainer_free_slots: 2,
      summary: "Haftada 1 ders icin temel paket.",
    },
    {
      id: "balance",
      title: "Denge Paketi",
      display_price: 4300,
      total_credits: Math.max(dayCount * 2, 8),
      weekly_class_hours: 2,
      required_preference_slots: 6,
      required_trainer_free_slots: 4,
      summary: "Haftada 2 ders duzeni icin.",
    },
    {
      id: "focus",
      title: "Odak Paketi",
      display_price: 6200,
      total_credits: Math.max(dayCount * 3, 12),
      weekly_class_hours: 3,
      required_preference_slots: 9,
      required_trainer_free_slots: 6,
      summary: "Yogun hedef takibi icin.",
    },
  ];
}

export function normalizeTrainerOptions(input: { data?: TrainerOption[] } | TrainerOption[] | undefined, salon?: SalonDiscoverySummary | null): TrainerOption[] {
  const rows = Array.isArray(input) ? input : Array.isArray(input?.data) ? input.data : [];
  const salonRows = Array.isArray(salon?.trainers) ? salon?.trainers : [];
  const source = rows.length > 0 ? rows : salonRows;
  return source
    .filter((row): row is TrainerOption => Boolean(row && typeof row.id === "string" && row.id.trim()))
    .map((row, index) => ({
    ...(row || {}),
    id: row.id,
    full_name: row.full_name || `Eğitmen ${index + 1}`,
    specialties: Array.isArray(row.specialties) ? row.specialties : ["Mobilite", "Fonksiyonel"],
    bio: row.bio || "Planlanan günlerle uyumlu, salon tarafından önerilen eğitmen.",
    rating_label: row.rating_label || "Uygun",
    compatibility_note: row.compatibility_note || "Seçili gün ve paket için uygun.",
    avatar_label: row.avatar_label || String((row.full_name || `Eğitmen ${index + 1}`).split(" ").map((part) => part[0]).slice(0, 2).join("")),
    matching_slots: typeof row.matching_slots === "number" ? row.matching_slots : null,
    required_matching_slots: typeof row.required_matching_slots === "number" ? row.required_matching_slots : null,
    is_available: row.is_available !== false,
    unavailable_reason: row.unavailable_reason || null,
  }));
}
