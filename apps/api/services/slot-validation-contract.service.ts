// Bu servis modulu backend tarafinda slot validation contract.service ile ilgili tekrar kullanilan is kurallarini toplar.
// Controller'larin zayif kalmasi ve ayni mantigin farkli endpointlerde paylasilmasi icin ayrilmistir.
export type SlotValidationContract = {
  timezone: string;
  working_days: number[]; // ISO: 1=Pzt ... 7=Paz
  start_time: string;
  end_time: string;
  lunch_break_start: string;
  lunch_break_end: string;
  slot_minutes: number;
  break_duration_minutes?: number;
};

const DEFAULT_CONTRACT: SlotValidationContract = {
  timezone: "Europe/Istanbul",
  working_days: [1, 2, 3, 4, 5, 6, 7],
  start_time: "09:00",
  end_time: "18:00",
  lunch_break_start: "12:00",
  lunch_break_end: "13:00",
  slot_minutes: 60,
  break_duration_minutes: 0,
};

export class SlotValidationContractService {
  static zonedDateTimeToUtc(
    input: { year: number; month: number; day: number; hour: number; minute: number },
    timezone: string
  ) {
    const desiredAsUtc = Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute, 0, 0);
    let result = new Date(desiredAsUtc);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(result);
      const read = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
      const representedAsUtc = Date.UTC(
        read("year"),
        read("month") - 1,
        read("day"),
        read("hour"),
        read("minute"),
        0,
        0
      );
      result = new Date(result.getTime() + desiredAsUtc - representedAsUtc);
    }
    return result;
  }

  static parseTimeToMinutes(input: unknown, fallback: number) {
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

  static normalizeWorkingDays(raw: unknown) {
    const fallback = DEFAULT_CONTRACT.working_days;
    if (!Array.isArray(raw)) return fallback;

    const normalized = Array.from(
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

    return normalized.length > 0 ? normalized : fallback;
  }

  static normalizeBusinessHours(raw: unknown): SlotValidationContract {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { ...DEFAULT_CONTRACT };
    }

    const input = raw as Record<string, unknown>;
    const slotMinutesRaw = Number(input.slot_minutes);
    const breakDurationRaw = Number(input.break_duration_minutes);

    return {
      timezone: typeof input.timezone === "string" ? input.timezone : DEFAULT_CONTRACT.timezone,
      working_days: SlotValidationContractService.normalizeWorkingDays(input.working_days),
      start_time: typeof input.start_time === "string" ? input.start_time : DEFAULT_CONTRACT.start_time,
      end_time: typeof input.end_time === "string" ? input.end_time : DEFAULT_CONTRACT.end_time,
      lunch_break_start:
        typeof input.lunch_break_start === "string" ? input.lunch_break_start : DEFAULT_CONTRACT.lunch_break_start,
      lunch_break_end:
        typeof input.lunch_break_end === "string" ? input.lunch_break_end : DEFAULT_CONTRACT.lunch_break_end,
      slot_minutes: Number.isFinite(slotMinutesRaw)
        ? Math.min(Math.max(Math.floor(slotMinutesRaw), 15), 180)
        : DEFAULT_CONTRACT.slot_minutes,
      break_duration_minutes: Number.isFinite(breakDurationRaw)
        ? Math.min(Math.max(Math.floor(breakDurationRaw), 0), 60)
        : DEFAULT_CONTRACT.break_duration_minutes,
    };
  }

  static floorToSlot(date: Date, stepMinutes: number) {
    const snapped = new Date(date);
    snapped.setSeconds(0, 0);
    const minute = snapped.getMinutes();
    const floored = Math.floor(minute / stepMinutes) * stepMinutes;
    snapped.setMinutes(floored, 0, 0);
    return snapped;
  }

  static ceilToSlot(date: Date, stepMinutes: number) {
    const rounded = SlotValidationContractService.floorToSlot(date, stepMinutes);
    if (rounded.getTime() < date.getTime()) {
      rounded.setMinutes(rounded.getMinutes() + stepMinutes);
    }
    return rounded;
  }

  static extractZoneWeekdayAndMinutes(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const weekdayRaw = parts.find((part) => part.type === "weekday")?.value ?? "Mon";
    const hourRaw = parts.find((part) => part.type === "hour")?.value ?? "00";
    const minuteRaw = parts.find((part) => part.type === "minute")?.value ?? "00";

    const weekdayMap: Record<string, number> = {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 7,
    };

    return {
      isoWeekday: weekdayMap[weekdayRaw] ?? 1,
      minutes: Number(hourRaw) * 60 + Number(minuteRaw),
    };
  }

  static intersectsLunchBreak(startMinutes: number, endMinutes: number, contract: SlotValidationContract) {
    const lunchStart = SlotValidationContractService.parseTimeToMinutes(contract.lunch_break_start, 12 * 60);
    const lunchEnd = SlotValidationContractService.parseTimeToMinutes(contract.lunch_break_end, 13 * 60);
    if (lunchStart >= lunchEnd) return false;
    return startMinutes < lunchEnd && endMinutes > lunchStart;
  }

  static isWithinBusinessHours(startsAt: Date, endsAt: Date, contract: SlotValidationContract) {
    const timezone = contract.timezone || DEFAULT_CONTRACT.timezone;
    const startInfo = SlotValidationContractService.extractZoneWeekdayAndMinutes(startsAt, timezone);
    const endInfo = SlotValidationContractService.extractZoneWeekdayAndMinutes(endsAt, timezone);

    if (startInfo.isoWeekday !== endInfo.isoWeekday) {
      return { ok: false, reason: "Randevu tek bir gün içinde planlanmalıdır" };
    }

    const workingDays = SlotValidationContractService.normalizeWorkingDays(contract.working_days);
    if (!workingDays.includes(startInfo.isoWeekday)) {
      return { ok: false, reason: "Seçilen gün çalışma takvimine kapalı" };
    }

    const dayStart = SlotValidationContractService.parseTimeToMinutes(contract.start_time, 9 * 60);
    const dayEnd = SlotValidationContractService.parseTimeToMinutes(contract.end_time, 18 * 60);

    if (startInfo.minutes < dayStart || endInfo.minutes > dayEnd) {
      return { ok: false, reason: "Randevu, klinik çalışma saatleri dışında" };
    }

    if (SlotValidationContractService.intersectsLunchBreak(startInfo.minutes, endInfo.minutes, contract)) {
      return { ok: false, reason: "Seçilen saat öğle arası ile çakışıyor" };
    }

    const slotMinutes = Math.min(Math.max(Number(contract.slot_minutes || 60), 15), 180);
    const breakMinutes = Math.max(0, Number(contract.break_duration_minutes || 0));
    const cycleMinutes = slotMinutes + breakMinutes;
    if ((startInfo.minutes - dayStart) % cycleMinutes !== 0) {
      return { ok: false, reason: `Başlangıç saati ${slotMinutes} dakikalık ders düzeniyle uyumlu olmalıdır` };
    }

    if ((endInfo.minutes - startInfo.minutes) % slotMinutes !== 0) {
      return { ok: false, reason: `Randevu süresi ${slotMinutes} dakikanın katları olmalıdır` };
    }

    return { ok: true as const };
  }

  static buildDaySlots(dayStart: Date, contract: SlotValidationContract) {
    const startMinutes = SlotValidationContractService.parseTimeToMinutes(contract.start_time, 9 * 60);
    const endMinutes = SlotValidationContractService.parseTimeToMinutes(contract.end_time, 18 * 60);
    const slotMinutes = Math.min(Math.max(Number(contract.slot_minutes || 60), 15), 180);
    const breakMinutes = Math.max(0, Number(contract.break_duration_minutes || 0));
    const slots: Array<{ starts_at: Date; ends_at: Date }> = [];

    for (let minute = startMinutes; minute + slotMinutes <= endMinutes; minute += slotMinutes + breakMinutes) {
      const slotStart = new Date(dayStart);
      slotStart.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + slotMinutes * 60_000);

      if (SlotValidationContractService.intersectsLunchBreak(minute, minute + slotMinutes, contract)) {
        continue;
      }

      slots.push({ starts_at: slotStart, ends_at: slotEnd });
    }

    return slots;
  }

  static availabilityContainsRange(
    availabilities: Array<{ starts_at: Date | string; ends_at: Date | string }>,
    startsAt: Date,
    endsAt: Date
  ) {
    const startMs = startsAt.getTime();
    const endMs = endsAt.getTime();

    return availabilities.some((row) => {
      const aStart = new Date(row.starts_at).getTime();
      const aEnd = new Date(row.ends_at).getTime();
      return aStart <= startMs && aEnd >= endMs;
    });
  }
}
