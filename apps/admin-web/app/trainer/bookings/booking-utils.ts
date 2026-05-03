import type {
  AvailabilityItem,
  BookingItem,
  BookingOptionPayload,
  CalendarBusinessHours,
  ManualSlotOption,
} from "./booking-types";

export function floorToSlot(date: Date, minutesStep: number) {
  const snapped = new Date(date);
  snapped.setSeconds(0, 0);
  const minute = snapped.getMinutes();
  const floored = Math.floor(minute / minutesStep) * minutesStep;
  snapped.setMinutes(floored, 0, 0);
  return snapped;
}

export function ceilToSlot(date: Date, minutesStep: number) {
  const rounded = floorToSlot(date, minutesStep);
  if (rounded.getTime() < date.getTime()) {
    rounded.setMinutes(rounded.getMinutes() + minutesStep);
  }
  return rounded;
}

export function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function reasonCodeLabel(code?: string) {
  if (code === "NO_MEMBER_ACTIVE_PACKAGE") return "Üyenin aktif paketi veya kalan hakkı bulunmuyor.";
  if (code === "NO_TRAINER_ASSIGNMENT") return "Üyenin aktif paketlerinden hiçbiri size atanmış değil.";
  if (code === "NO_SKILL_MATCH") return "Paket kategorisi eğitmen yetkinlikleriyle uyumsuz.";
  return "Bu danışan için uygun paket doğrulaması sağlanamadı.";
}

export function buildRangeQuery(from?: string | null, to?: string | null) {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const raw = qs.toString();
  return raw ? `?${raw}` : "";
}

export function normalizeWorkingDays(calendarConfig: CalendarBusinessHours) {
  return Array.from(
    new Set(
      (calendarConfig.working_days || [1, 2, 3, 4, 5, 6, 7])
        .map((day) => Number(day))
        .map((day) => {
          if (!Number.isInteger(day)) return null;
          if (day === 7) return 0;
          if (day === 0) return 0;
          if (day >= 1 && day <= 6) return day;
          return null;
        })
        .filter((day): day is number => day !== null)
    )
  ).sort((a, b) => a - b);
}

export function slotDurationText(slotMinutes: number) {
  const hours = Math.floor(slotMinutes / 60);
  const minutes = slotMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
}

export function isWithinBusinessHoursRange(
  startsAt: Date,
  endsAt: Date,
  options: {
    effectiveWorkingDays: number[];
    startMinutes: number;
    endMinutes: number;
    lunchStartMinutes: number;
    lunchEndMinutes: number;
  }
) {
  const weekday = startsAt.getDay();
  if (!options.effectiveWorkingDays.includes(weekday)) return false;
  if (startsAt.getDay() !== endsAt.getDay()) return false;

  const startTotal = startsAt.getHours() * 60 + startsAt.getMinutes();
  const endTotal = endsAt.getHours() * 60 + endsAt.getMinutes();
  if (startTotal < options.startMinutes || endTotal > options.endMinutes) return false;

  if (options.lunchStartMinutes < options.lunchEndMinutes) {
    const intersectsLunch = startTotal < options.lunchEndMinutes && endTotal > options.lunchStartMinutes;
    if (intersectsLunch) return false;
  }

  return true;
}

export function buildBusinessHours(
  startTime: string,
  endTime: string,
  lunchStart: string,
  lunchEnd: string,
  effectiveWorkingDays: number[]
) {
  if (lunchStart < lunchEnd && lunchStart > startTime && lunchEnd < endTime) {
    return [
      { daysOfWeek: effectiveWorkingDays, startTime: `${startTime}:00`, endTime: `${lunchStart}:00` },
      { daysOfWeek: effectiveWorkingDays, startTime: `${lunchEnd}:00`, endTime: `${endTime}:00` },
    ];
  }

  return [{ daysOfWeek: effectiveWorkingDays, startTime: `${startTime}:00`, endTime: `${endTime}:00` }];
}

export function buildMemberAvailabilityIndex(availabilities: AvailabilityItem[]) {
  const index = new Map<string, Array<{ start: number; end: number }>>();
  for (const row of availabilities) {
    const ranges = index.get(row.member_id) || [];
    ranges.push({
      start: new Date(row.starts_at).getTime(),
      end: new Date(row.ends_at).getTime(),
    });
    index.set(row.member_id, ranges);
  }
  return index;
}

export function buildMemberWeeklyLimitIndex(availabilities: AvailabilityItem[]) {
  const index = new Map<string, number>();
  for (const row of availabilities) {
    if (!index.has(row.member_id)) {
      index.set(row.member_id, Math.max(1, Number(row.member_weekly_class_hours || 1)));
    }
  }
  return index;
}

export function buildWeeklyBookingCountIndex(bookings: BookingItem[]) {
  const index = new Map<string, number>();
  for (const row of bookings) {
    if (row.status === "CANCELED") continue;
    index.set(row.member_id, (index.get(row.member_id) || 0) + 1);
  }
  return index;
}

export function buildMemberAvailabilityDateOptions(availabilities: AvailabilityItem[], memberId: string) {
  if (!memberId) return [] as Array<{ key: string; label: string }>;
  const rows = availabilities.filter((row) => row.member_id === memberId);
  const unique = new Set<string>();

  for (const row of rows) {
    const start = new Date(row.starts_at);
    const end = new Date(row.ends_at);
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);

    while (cursor.getTime() <= endDay.getTime()) {
      const dayStart = new Date(cursor);
      const dayEnd = new Date(cursor);
      dayEnd.setDate(dayEnd.getDate() + 1);
      if (start < dayEnd && end > dayStart) {
        unique.add(toLocalDateKey(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return Array.from(unique)
    .sort()
    .map((key) => {
      const date = new Date(`${key}T00:00:00`);
      return {
        key,
        label: date.toLocaleDateString("tr-TR", {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
        }),
      };
    });
}

export function buildMemberAvailabilitySlotOptions(
  availabilities: AvailabilityItem[],
  form: {
    member_id: string;
    package_id: string;
    booking_date: string;
  },
  slotMinutes: number,
  isWithinSlotRange: (startsAt: Date, endsAt: Date) => boolean
) {
  if (!form.member_id || !form.booking_date) return [] as ManualSlotOption[];
  const selectedDayStart = new Date(`${form.booking_date}T00:00:00`);
  const selectedDayEnd = new Date(selectedDayStart);
  selectedDayEnd.setDate(selectedDayEnd.getDate() + 1);

  const rows = availabilities.filter((row) => row.member_id === form.member_id);
  const options: ManualSlotOption[] = [];

  for (const row of rows) {
    const rangeStart = new Date(row.starts_at);
    const rangeEnd = new Date(row.ends_at);

    const windowStart = rangeStart > selectedDayStart ? rangeStart : selectedDayStart;
    const windowEnd = rangeEnd < selectedDayEnd ? rangeEnd : selectedDayEnd;
    if (windowEnd <= windowStart) continue;

    let cursor = ceilToSlot(windowStart, slotMinutes);
    while (cursor.getTime() + slotMinutes * 60_000 <= windowEnd.getTime()) {
      const slotEnd = new Date(cursor.getTime() + slotMinutes * 60_000);
      if (!isWithinSlotRange(cursor, slotEnd)) {
        cursor = new Date(cursor.getTime() + slotMinutes * 60_000);
        continue;
      }
      const startsAtIso = cursor.toISOString();
      const endsAtIso = slotEnd.toISOString();
      options.push({
        value: `${startsAtIso}|${endsAtIso}|${row.id}`,
        starts_at: startsAtIso,
        ends_at: endsAtIso,
        package_id: row.package_id || null,
        package_title: row.package_title || null,
        lesson_category: row.package_lesson_category || null,
        availability_note: row.note || null,
      });
      cursor = new Date(cursor.getTime() + slotMinutes * 60_000);
    }
  }

  const unique = new Map<string, ManualSlotOption>();
  for (const option of options) {
    if (!unique.has(option.value)) unique.set(option.value, option);
  }

  return Array.from(unique.values()).sort((a, b) => {
    const left = new Date(a.starts_at).getTime();
    const right = new Date(b.starts_at).getTime();
    return left - right;
  });
}

export function getMemberDiagnostic(
  formOptions: BookingOptionPayload["data"],
  memberId: string
) {
  return formOptions.member_package_diagnostics?.[memberId] || null;
}

export function getMemberBookablePackageIds(
  formOptions: BookingOptionPayload["data"],
  memberId: string
) {
  const ids = formOptions.member_bookable_package_ids?.[memberId] || [];
  return Array.from(new Set(ids.filter(Boolean)));
}

export function isWithinMemberAvailability(
  memberAvailabilityIndex: Map<string, Array<{ start: number; end: number }>>,
  memberId: string,
  startsAt: Date,
  endsAt: Date
) {
  const ranges = memberAvailabilityIndex.get(memberId);
  if (!ranges || ranges.length === 0) return false;
  const startMs = startsAt.getTime();
  const endMs = endsAt.getTime();
  return ranges.some((range) => range.start <= startMs && range.end >= endMs);
}

export function canMemberTakeAnotherLesson(
  weeklyBookingCountIndex: Map<string, number>,
  memberWeeklyLimitIndex: Map<string, number>,
  bookings: BookingItem[],
  memberId: string,
  draggedBookingId?: string | null
) {
  const weeklyLimit = memberWeeklyLimitIndex.get(memberId) || 1;
  const currentCount = weeklyBookingCountIndex.get(memberId) || 0;
  const isExistingBooking = !!draggedBookingId && bookings.some((row) => row.id === draggedBookingId);
  if (isExistingBooking) {
    return currentCount <= weeklyLimit;
  }
  return currentCount < weeklyLimit;
}

export function getAvailabilityHint(availabilities: AvailabilityItem[], memberId: string) {
  return availabilities
    .filter((row) => row.member_id === memberId)
    .slice(0, 2)
    .map(
      (row) =>
        `${new Date(row.starts_at).toLocaleString("tr-TR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })} - ${new Date(row.ends_at).toLocaleString("tr-TR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}`
    )
    .join(" | ");
}
