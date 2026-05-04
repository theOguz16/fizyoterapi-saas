// src/lib/scheduling/business-hours.types.ts

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

export type BusinessHoursSourceContext = {
  locationTimezone?: string | null;
  deviceTimezone?: string | null;
};

export type NormalizedBusinessHours = {
  timezone: string | null;

  start_time: string | null;
  end_time: string | null;

  lunch_break_start: string | null;
  lunch_break_end: string | null;
  has_lunch_break: boolean;

  slot_minutes: number;
  break_duration_minutes: number;

  working_days: number[];
  is_configured: boolean;
};