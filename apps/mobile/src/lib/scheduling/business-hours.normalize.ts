// src/lib/scheduling/business-hours.normalize.ts

import type {
  BusinessHoursSourceContext,
  MobileBusinessHours,
  NormalizedBusinessHours,
} from "./business-hours.types";

export const BUSINESS_HOUR_SLOT_OPTIONS = [30, 45, 50, 60, 75, 90, 120] as const;
export const BUSINESS_HOUR_BREAK_OPTIONS = [0, 5, 10, 15, 20, 25, 30] as const;

export const FALLBACK_SLOT_MINUTES = 60;
export const FALLBACK_BREAK_DURATION_MINUTES = 0;

export function getDeviceTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export function normalizeTimezone(
  businessHoursTimezone?: unknown,
  context?: BusinessHoursSourceContext
) {
  if (typeof businessHoursTimezone === "string" && businessHoursTimezone.trim()) {
    return businessHoursTimezone.trim();
  }

  if (typeof context?.locationTimezone === "string" && context.locationTimezone.trim()) {
    return context.locationTimezone.trim();
  }

  if (typeof context?.deviceTimezone === "string" && context.deviceTimezone.trim()) {
    return context.deviceTimezone.trim();
  }

  return null;
}

export function normalizeTime(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function timeToMinutes(value: string): number {
  const [hour, minute] = value.split(":").map((item) => Number(item || 0));
  return hour * 60 + minute;
}

export function minutesToTime(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function normalizeWorkingDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  const days = value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 7);

  return Array.from(new Set(days)).sort((a, b) => a - b);
}

function normalizeSlotMinutes(value: unknown): number {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return FALLBACK_SLOT_MINUTES;
  }

  const resolved = Math.round(numeric);

  return BUSINESS_HOUR_SLOT_OPTIONS.includes(
    resolved as (typeof BUSINESS_HOUR_SLOT_OPTIONS)[number]
  )
    ? resolved
    : FALLBACK_SLOT_MINUTES;
}

function normalizeBreakDuration(value: unknown): number {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return FALLBACK_BREAK_DURATION_MINUTES;
  }

  const resolved = Math.round(numeric);

  return BUSINESS_HOUR_BREAK_OPTIONS.includes(
    resolved as (typeof BUSINESS_HOUR_BREAK_OPTIONS)[number]
  )
    ? resolved
    : FALLBACK_BREAK_DURATION_MINUTES;
}

function hasConfiguredFields(value?: MobileBusinessHours | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  return Boolean(
    normalizeTime(value.start_time) ||
      normalizeTime(value.end_time) ||
      normalizeTime(value.lunch_break_start) ||
      normalizeTime(value.lunch_break_end) ||
      Array.isArray(value.working_days) && value.working_days.length > 0 ||
      Number.isFinite(Number(value.slot_minutes)) ||
      Number.isFinite(Number(value.break_duration_minutes))
  );
}

export function normalizeBusinessHours(
  input?: MobileBusinessHours | null,
  context?: BusinessHoursSourceContext
): NormalizedBusinessHours {
  const startTime = normalizeTime(input?.start_time);
  const endTime = normalizeTime(input?.end_time);

  const lunchStart = normalizeTime(input?.lunch_break_start);
  const lunchEnd = normalizeTime(input?.lunch_break_end);

  const hasLunchBreak =
    Boolean(lunchStart && lunchEnd) &&
    timeToMinutes(lunchStart!) < timeToMinutes(lunchEnd!);

  const workingDays = normalizeWorkingDays(input?.working_days);

  const isConfigured = Boolean(
    startTime &&
      endTime &&
      workingDays.length > 0 &&
      timeToMinutes(startTime) < timeToMinutes(endTime)
  );

  return {
    timezone: normalizeTimezone(input?.timezone, context),

    start_time: startTime,
    end_time: endTime,

    lunch_break_start: hasLunchBreak ? lunchStart : null,
    lunch_break_end: hasLunchBreak ? lunchEnd : null,
    has_lunch_break: hasLunchBreak,

    slot_minutes: normalizeSlotMinutes(input?.slot_minutes),
    break_duration_minutes: normalizeBreakDuration(input?.break_duration_minutes),

    working_days: workingDays,
    is_configured: isConfigured,
  };
}

export function resolveBusinessHours(
  sources: Array<MobileBusinessHours | null | undefined>,
  context?: BusinessHoursSourceContext
): NormalizedBusinessHours {
  const source =
    sources.find((item) => hasConfiguredFields(item)) ||
    sources.find((item) => item && typeof item === "object" && !Array.isArray(item)) ||
    null;

  return normalizeBusinessHours(source, {
    deviceTimezone: getDeviceTimezone(),
    ...context,
  });
}

export function buildSlotStartMinutes(
  startMinutes: number,
  endMinutes: number,
  slotMinutes: number,
  breakMinutes = 0
): number[] {
  const safeSlotMinutes = Math.max(1, Math.round(slotMinutes));
  const safeBreakMinutes = Math.max(0, Math.round(breakMinutes));

  if (endMinutes <= startMinutes) return [];

  const cycleMinutes = safeSlotMinutes + safeBreakMinutes;
  const starts: number[] = [];

  for (let minute = startMinutes; minute + safeSlotMinutes <= endMinutes; minute += cycleMinutes) {
    starts.push(minute);
  }

  return starts;
}