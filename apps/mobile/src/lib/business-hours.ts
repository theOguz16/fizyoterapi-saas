export type MobileBusinessHours = {
  timezone?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  lunch_break_start?: string | null;
  lunch_break_end?: string | null;
  slot_minutes?: number | null;
  break_duration_minutes?: number | null;
  working_days?: number[] | null;
};

export type NormalizedBusinessHours = {
  timezone: string;
  start_time: string;
  end_time: string;
  lunch_break_start: string;
  lunch_break_end: string;
  slot_minutes: number;
  break_duration_minutes: number;
  working_days: number[];
};

export const DEFAULT_BUSINESS_HOURS: NormalizedBusinessHours = {
  timezone: "Europe/Istanbul",
  working_days: [1, 2, 3, 4, 5],
  start_time: "09:00",
  end_time: "18:00",
  lunch_break_start: "12:00",
  lunch_break_end: "13:00",
  slot_minutes: 60,
  break_duration_minutes: 0,
};

export const BUSINESS_HOUR_SLOT_OPTIONS = [30, 45, 50, 60, 75, 90, 120] as const;
export const BUSINESS_HOUR_BREAK_OPTIONS = [0, 5, 10, 15, 20, 25, 30] as const;

export function buildSlotStartMinutes(startMinutes: number, endMinutes: number, slotMinutes: number, breakMinutes = 0) {
  const safeSlotMinutes = Math.max(1, Math.round(slotMinutes));
  const safeBreakMinutes = Math.max(0, Math.round(breakMinutes));
  const safeEndMinutes = Math.max(startMinutes + safeSlotMinutes, endMinutes);
  const cycleMinutes = safeSlotMinutes + safeBreakMinutes;
  const starts: number[] = [];

  for (let minute = startMinutes; minute + safeSlotMinutes <= safeEndMinutes; minute += cycleMinutes) {
    starts.push(minute);
  }

  return starts;
}

function normalizeTime(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return fallback;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeWorkingDays(value: unknown) {
  if (!Array.isArray(value)) return DEFAULT_BUSINESS_HOURS.working_days;
  const days = value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 7);
  return days.length ? Array.from(new Set(days)).sort((a, b) => a - b) : DEFAULT_BUSINESS_HOURS.working_days;
}

function normalizeSlotMinutes(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_BUSINESS_HOURS.slot_minutes;
  const resolved = Math.round(numeric);
  return BUSINESS_HOUR_SLOT_OPTIONS.includes(resolved as (typeof BUSINESS_HOUR_SLOT_OPTIONS)[number]) ? resolved : DEFAULT_BUSINESS_HOURS.slot_minutes;
}

function normalizeBreakDuration(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_BUSINESS_HOURS.break_duration_minutes;
  const resolved = Math.round(numeric);
  return BUSINESS_HOUR_BREAK_OPTIONS.includes(resolved as (typeof BUSINESS_HOUR_BREAK_OPTIONS)[number])
    ? resolved
    : DEFAULT_BUSINESS_HOURS.break_duration_minutes;
}

export function normalizeBusinessHours(input?: MobileBusinessHours | null): NormalizedBusinessHours {
  return {
    timezone: typeof input?.timezone === "string" && input.timezone.trim() ? input.timezone : DEFAULT_BUSINESS_HOURS.timezone,
    working_days: normalizeWorkingDays(input?.working_days),
    start_time: normalizeTime(input?.start_time, DEFAULT_BUSINESS_HOURS.start_time),
    end_time: normalizeTime(input?.end_time, DEFAULT_BUSINESS_HOURS.end_time),
    lunch_break_start: normalizeTime(input?.lunch_break_start, DEFAULT_BUSINESS_HOURS.lunch_break_start),
    lunch_break_end: normalizeTime(input?.lunch_break_end, DEFAULT_BUSINESS_HOURS.lunch_break_end),
    slot_minutes: normalizeSlotMinutes(input?.slot_minutes),
    break_duration_minutes: normalizeBreakDuration(input?.break_duration_minutes),
  };
}

export function resolveBusinessHours(...sources: Array<MobileBusinessHours | null | undefined>) {
  const hasConfiguredFields = (item?: MobileBusinessHours | null) =>
    Boolean(
      item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        (
          (typeof item.start_time === "string" && item.start_time.trim()) ||
          (typeof item.end_time === "string" && item.end_time.trim()) ||
          (typeof item.lunch_break_start === "string" && item.lunch_break_start.trim()) ||
          (typeof item.lunch_break_end === "string" && item.lunch_break_end.trim()) ||
          Number.isFinite(Number(item.slot_minutes)) ||
          Number.isFinite(Number(item.break_duration_minutes)) ||
          (Array.isArray(item.working_days) && item.working_days.length > 0)
        )
    );

  const source =
    sources.find((item) => hasConfiguredFields(item)) ||
    sources.find((item) => item && typeof item === "object" && !Array.isArray(item)) ||
    null;
  return normalizeBusinessHours(source);
}
