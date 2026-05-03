// Bu controller trainer tarafindaki booking helpers endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { AppError } from "../../errors/AppError";

export function parseBookingDate(value: unknown, field: string) {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new AppError("VALIDATION_ERROR", 400, `${field} geçersiz tarih`);
  }
  return date;
}

export function parseClockTimeToMinutes(input: unknown, fallback: number) {
  if (typeof input !== "string") return fallback;
  const raw = input.trim();
  if (!/^\d{2}:\d{2}$/.test(raw)) return fallback;
  const [hourRaw, minuteRaw] = raw.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return fallback;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;
  return hour * 60 + minute;
}

export function normalizeWorkingDaysToIso(raw: unknown) {
  const fallback = [1, 2, 3, 4, 5, 6, 7];
  if (!Array.isArray(raw)) return fallback;
  const days = Array.from(
    new Set(
      raw
        .map((item) => Number(item))
        .map((day) => {
          if (!Number.isInteger(day)) return null;
          if (day === 0) return 7;
          if (day >= 1 && day <= 7) return day;
          return null;
        })
        .filter((day): day is number => day !== null)
    )
  ).sort((a, b) => a - b);
  return days.length > 0 ? days : fallback;
}

export function validateBookingDuration(startsAt: Date, endsAt: Date) {
  const minutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60000);
  if (minutes < 15) {
    throw new AppError("VALIDATION_ERROR", 400, "Randevu süresi en az 15 dakika olmalıdır");
  }
  if (minutes > 240) {
    throw new AppError("VALIDATION_ERROR", 400, "Randevu süresi en fazla 4 saat olabilir");
  }
}

export function resolveMinimumAdvanceHours(value: unknown, fallback = 3) {
  return Math.max(1, Math.floor(Number(value) || fallback));
}

export function ensureMinimumAdvanceHours(
  startsAt: Date,
  minHours: number,
  messagePrefix: string,
  code = "MINIMUM_ADVANCE_WINDOW_CLOSED",
  now: Date = new Date()
) {
  const diffMs = startsAt.getTime() - now.getTime();
  const minAllowedMs = minHours * 60 * 60 * 1000;
  if (diffMs < minAllowedMs) {
    throw new AppError(code, 400, `${messagePrefix} en az ${minHours} saat önceden planlanabilir`);
  }
}
