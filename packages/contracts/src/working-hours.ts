export type WorkingHours = {
  timezone?: string | null;
  working_days?: number[];
  start_time?: string | null;
  end_time?: string | null;
  lunch_break_start?: string | null;
  lunch_break_end?: string | null;
  slot_minutes?: number | null;
  break_duration_minutes?: number | null;
};

export type WorkingHoursInput = {
  timezone: string | null;
  working_days: number[];
  start_time: string;
  end_time: string;
  lunch_break_start: string;
  lunch_break_end: string;
  slot_minutes: number;
  break_duration_minutes: number;
};
