"use client";

import { useMemo } from "react";
import type {
  AvailabilityItem,
  BookingItem,
  BookingOptionPayload,
  CalendarBusinessHours,
} from "./booking-types";
import {
  buildBusinessHours,
  buildMemberAvailabilityDateOptions,
  buildMemberAvailabilityIndex,
  buildMemberAvailabilitySlotOptions,
  buildMemberWeeklyLimitIndex,
  buildWeeklyBookingCountIndex,
  canMemberTakeAnotherLesson,
  getAvailabilityHint,
  getMemberBookablePackageIds,
  getMemberDiagnostic,
  isWithinBusinessHoursRange,
  isWithinMemberAvailability,
  normalizeWorkingDays,
  reasonCodeLabel,
  slotDurationText,
} from "./booking-utils";

export function useBookingDerivations({
  calendarConfig,
  availabilities,
  bookings,
  selectedBookingId,
  form,
  formOptions,
}: {
  calendarConfig: CalendarBusinessHours;
  availabilities: AvailabilityItem[];
  bookings: BookingItem[];
  selectedBookingId: string;
  form: {
    member_id: string;
    package_id: string;
    booking_date: string;
    booking_slot: string;
  };
  formOptions: BookingOptionPayload["data"];
}) {
  const startTime = calendarConfig.start_time || "09:00";
  const endTime = calendarConfig.end_time || "18:00";
  const lunchStart = calendarConfig.lunch_break_start || "12:00";
  const lunchEnd = calendarConfig.lunch_break_end || "13:00";
  const slotMinutes = Math.min(Math.max(Number(calendarConfig.slot_minutes || 60), 15), 180);
  const durationText = useMemo(() => slotDurationText(slotMinutes), [slotMinutes]);

  const configuredWorkingDays = useMemo(() => normalizeWorkingDays(calendarConfig), [calendarConfig]);
  const effectiveWorkingDays = useMemo(
    () => (configuredWorkingDays.length > 0 ? configuredWorkingDays : [0, 1, 2, 3, 4, 5, 6]),
    [configuredWorkingDays]
  );

  const startMinutes = Number(startTime.split(":")[0] || "9") * 60 + Number(startTime.split(":")[1] || "0");
  const endMinutes = Number(endTime.split(":")[0] || "18") * 60 + Number(endTime.split(":")[1] || "0");
  const lunchStartMinutes =
    Number(lunchStart.split(":")[0] || "12") * 60 + Number(lunchStart.split(":")[1] || "0");
  const lunchEndMinutes =
    Number(lunchEnd.split(":")[0] || "13") * 60 + Number(lunchEnd.split(":")[1] || "0");

  const selectedBooking = useMemo(
    () => bookings.find((row) => row.id === selectedBookingId) || null,
    [bookings, selectedBookingId]
  );

  const memberAvailabilityIndex = useMemo(
    () => buildMemberAvailabilityIndex(availabilities),
    [availabilities]
  );
  const memberWeeklyLimitIndex = useMemo(
    () => buildMemberWeeklyLimitIndex(availabilities),
    [availabilities]
  );
  const weeklyBookingCountIndex = useMemo(
    () => buildWeeklyBookingCountIndex(bookings),
    [bookings]
  );

  const slotRangeMatcher = useMemo(
    () => (startsAt: Date, endsAt: Date) =>
      isWithinBusinessHoursRange(startsAt, endsAt, {
        effectiveWorkingDays,
        startMinutes,
        endMinutes,
        lunchStartMinutes,
        lunchEndMinutes,
      }),
    [effectiveWorkingDays, endMinutes, lunchEndMinutes, lunchStartMinutes, startMinutes]
  );

  const memberAvailabilityDateOptions = useMemo(
    () => buildMemberAvailabilityDateOptions(availabilities, form.member_id),
    [availabilities, form.member_id]
  );

  const memberAvailabilitySlotOptions = useMemo(
    () => buildMemberAvailabilitySlotOptions(availabilities, form, slotMinutes, slotRangeMatcher),
    [availabilities, form, slotMinutes, slotRangeMatcher]
  );

  const memberBookablePackageIds = useMemo(
    () => (form.member_id ? getMemberBookablePackageIds(formOptions, form.member_id) : []),
    [form.member_id, formOptions]
  );

  const memberBookablePackages = useMemo(() => {
    if (!form.member_id) return [] as BookingOptionPayload["data"]["packages"];
    const allowed = new Set(memberBookablePackageIds);
    return formOptions.packages.filter((pkg) => allowed.has(pkg.id));
  }, [form.member_id, formOptions.packages, memberBookablePackageIds]);

  const selectedMember = useMemo(
    () => formOptions.members.find((member) => member.id === form.member_id) || null,
    [form.member_id, formOptions.members]
  );

  const selectedMemberDiagnostic = useMemo(
    () => (form.member_id ? getMemberDiagnostic(formOptions, form.member_id) : null),
    [form.member_id, formOptions]
  );

  const manualFormErrors = useMemo(
    () => ({
      member_id: form.member_id ? "" : "Danışan seçimi zorunludur.",
      package_id: !form.member_id
        ? ""
        : !form.package_id
          ? "Paket seçimi zorunludur."
          : !memberBookablePackageIds.includes(form.package_id)
            ? reasonCodeLabel(selectedMemberDiagnostic?.reason_codes?.[0])
            : "",
      booking_date: form.booking_date ? "" : "Önce tarih seçin.",
      booking_slot: form.booking_slot ? "" : "Önce saat aralığı seçin.",
    }),
    [form.booking_date, form.booking_slot, form.member_id, form.package_id, memberBookablePackageIds, selectedMemberDiagnostic]
  );

  const manualFormHasError = useMemo(
    () => Object.values(manualFormErrors).some(Boolean),
    [manualFormErrors]
  );

  const businessHours = useMemo(
    () => buildBusinessHours(startTime, endTime, lunchStart, lunchEnd, effectiveWorkingDays),
    [effectiveWorkingDays, endTime, lunchEnd, lunchStart, startTime]
  );

  return {
    startTime,
    endTime,
    lunchStart,
    lunchEnd,
    slotMinutes,
    slotDurationText: durationText,
    effectiveWorkingDays,
    selectedBooking,
    memberAvailabilityIndex,
    memberWeeklyLimitIndex,
    weeklyBookingCountIndex,
    memberAvailabilityDateOptions,
    memberAvailabilitySlotOptions,
    memberBookablePackageIds,
    memberBookablePackages,
    selectedMember,
    selectedMemberDiagnostic,
    manualFormErrors,
    manualFormHasError,
    businessHours,
    reasonCodeLabel,
    getMemberDiagnostic: (memberId: string) => getMemberDiagnostic(formOptions, memberId),
    getMemberBookablePackageIds: (memberId: string) => getMemberBookablePackageIds(formOptions, memberId),
    getAvailabilityHint: (memberId: string) => getAvailabilityHint(availabilities, memberId),
    isWithinMemberAvailability: (memberId: string, startsAt: Date, endsAt: Date) =>
      isWithinMemberAvailability(memberAvailabilityIndex, memberId, startsAt, endsAt),
    isWithinBusinessHoursRange: slotRangeMatcher,
    canMemberTakeAnotherLesson: (memberId: string, draggedBookingId?: string | null) =>
      canMemberTakeAnotherLesson(
        weeklyBookingCountIndex,
        memberWeeklyLimitIndex,
        bookings,
        memberId,
        draggedBookingId
      ),
  };
}
