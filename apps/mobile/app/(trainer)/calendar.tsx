// Bu sayfa mobil uygulamada trainer akisindaki calendar ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { buildSlotStartMinutes, resolveBusinessHours } from "@/lib/business-hours";
import { formatGroupClassPrice, getGroupClassAudienceLabel } from "@/lib/group-classes";
import { showErrorAlert, showInfoAlert } from "@/lib/user-feedback";
import {
  createTrainerBookingApi,
  createTrainerScheduleChangeRequestApi,
  getTrainerAvailabilitiesApi,
  getTrainerBookingsApi,
  getTrainerGroupClassesApi,
  getTrainerMembersApi,
  getTrainerTodayApi,
  getTrainerMemberAttendanceApi,
  getTrainerMemberDetailApi,
  getTrainerMemberMeasurementsApi,
  getTrainerMemberNotesApi,
  patchTrainerBookingStatusApi,
  type TrainerAvailabilityEntry,
  type TrainerScheduleEntry,
} from "@/lib/mobile-api";
import { type TrainerScheduleRequest } from "@/lib/trainer-scheduler";
import { formatStatusLabel, getStatusTone } from "@/theme/components/calendar-agenda";
import { ActionButton } from "@/theme/components/action-button";
import { AppShell } from "@/theme/components/app-shell";
import { DetailSheet } from "@/theme/components/detail-sheet";
import { EmptyState } from "@/theme/components/empty-state";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { StatusBadge } from "@/theme/components/status-badge";
import { SurfaceCard } from "@/theme/components/surface-card";
import { WeeklyScheduler } from "@/theme/components/weekly-scheduler";
import { tokens } from "@/theme/tokens";

type CalendarRequest = TrainerScheduleRequest & {
  request_date_key: string;
  request_date_label: string;
};

type BusinessHours = {
  start_time?: string | null;
  end_time?: string | null;
  lunch_break_start?: string | null;
  lunch_break_end?: string | null;
  slot_minutes?: number | null;
  working_days?: number[] | null;
};

type AvailableSlot = {
  key: string;
  startsAt: string;
  endsAt: string;
  label: string;
  dayKey: string;
  dayLabel: string;
};

function formatDateTimeRange(startsAt?: string | null, endsAt?: string | null) {
  if (!startsAt) return "-";
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : null;
  const day = start.toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const startTime = start.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTime = end
    ? end.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--:--";
  return `${day} • ${startTime} - ${endTime}`;
}

function isOutsideMinimumLeadTime(startsAt: string, minHours: number, now = new Date()) {
  return new Date(startsAt).getTime() - now.getTime() < minHours * 60 * 60 * 1000;
}

function toDateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function timeToMinutes(value?: string | null, fallback = 0) {
  if (!value) return fallback;
  const [hour, minute] = String(value).split(":").map((piece) => Number(piece || 0));
  return hour * 60 + minute;
}

function isoDayNumber(date: Date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function addMinutes(dateInput: Date, minutes: number) {
  return new Date(dateInput.getTime() + minutes * 60 * 1000);
}

function buildTrainerRequests(rows: TrainerAvailabilityEntry[]) {
  const groups = new Map<string, CalendarRequest>();

  for (const row of rows) {
    if (!row.starts_at) continue;
    const dayKey = String(row.starts_at).slice(0, 10);
    const groupKey = `${row.member_id || row.member_full_name}-${dayKey}-${row.package_id || row.package_title || "paket"}`;
    const current = groups.get(groupKey);

    if (current) {
      if (!current.note && row.note) current.note = row.note;
      if (row.starts_at) {
        const exists = current.assignable_slots.some((slot) => slot.starts_at === row.starts_at);
        if (!exists) {
          current.assignable_slots.push({
            starts_at: row.starts_at,
            ends_at: row.ends_at || addMinutes(new Date(row.starts_at), 60).toISOString(),
          });
        }
      }
      continue;
    }

    groups.set(groupKey, {
      id: groupKey,
      member_id: String(row.member_id || ""),
      member_full_name: row.member_full_name || "Danışan",
      package_id: row.package_id || null,
      package_title: row.package_title || "Paket",
      note: row.note || null,
      request_date_key: dayKey,
      request_date_label: new Date(`${dayKey}T00:00:00`).toLocaleDateString("tr-TR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      }),
      assignable_slots: [
        {
          starts_at: row.starts_at,
          ends_at: row.ends_at || addMinutes(new Date(row.starts_at), 60).toISOString(),
        },
      ],
    });
  }

  return Array.from(groups.values()).sort(
    (first, second) => new Date(`${first.request_date_key}T00:00:00`).getTime() - new Date(`${second.request_date_key}T00:00:00`).getTime()
  );
}

function rangesOverlap(startA: Date, endA: Date, startB?: string | null, endB?: string | null) {
  if (!startB) return false;
  const rangeStartB = new Date(startB);
  const rangeEndB = endB ? new Date(endB) : addMinutes(rangeStartB, 60);
  return startA < rangeEndB && endA > rangeStartB;
}

function buildAvailableSlots(
  dateKey: string,
  businessHours: BusinessHours | null,
  bookings: TrainerScheduleEntry[],
  minHoursBeforeStart: number
) {
  if (!businessHours) return [] as AvailableSlot[];

  const workingDays =
    Array.isArray(businessHours.working_days) && businessHours.working_days.length
      ? businessHours.working_days
      : [1, 2, 3, 4, 5, 6, 7];
  const dayDate = new Date(`${dateKey}T00:00:00`);
  if (!workingDays.includes(isoDayNumber(dayDate))) return [] as AvailableSlot[];

  const startMinutes = timeToMinutes(businessHours.start_time, 9 * 60);
  const endMinutes = timeToMinutes(businessHours.end_time, 21 * 60);
  const slotMinutes = Math.max(30, Number(businessHours.slot_minutes || 60));
  const breakMinutes = Math.max(0, Number((businessHours as any).break_duration_minutes || 0));
  const lunchStartMinutes = timeToMinutes(businessHours.lunch_break_start, -1);
  const lunchEndMinutes = timeToMinutes(businessHours.lunch_break_end, -1);
  const dayBookings = bookings.filter((booking) => toDateKey(booking.starts_at) === dateKey);
  const slots: AvailableSlot[] = [];

  for (const minute of buildSlotStartMinutes(startMinutes, endMinutes, slotMinutes, breakMinutes)) {
    const slotStartMinutes = minute;
    const slotEndMinutes = minute + slotMinutes;
    const isLunchBreak =
      lunchStartMinutes >= 0 &&
      lunchEndMinutes >= 0 &&
      slotStartMinutes < lunchEndMinutes &&
      slotEndMinutes > lunchStartMinutes;

    if (isLunchBreak) continue;

    const slotStart = new Date(`${dateKey}T00:00:00`);
    slotStart.setHours(Math.floor(slotStartMinutes / 60), slotStartMinutes % 60, 0, 0);
    const slotEnd = addMinutes(slotStart, slotMinutes);
    const overlapsBooking = dayBookings.some((booking) =>
      rangesOverlap(slotStart, slotEnd, booking.starts_at, booking.ends_at)
    );

    if (overlapsBooking || isOutsideMinimumLeadTime(slotStart.toISOString(), minHoursBeforeStart)) continue;

    slots.push({
      key: `${dateKey}-${slotStart.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`,
      startsAt: slotStart.toISOString(),
      endsAt: slotEnd.toISOString(),
      label: `${slotStart.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} - ${slotEnd.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      dayKey: dateKey,
      dayLabel: dayDate.toLocaleDateString("tr-TR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      }),
    });
  }

  return slots;
}

function slotFitsBusinessHours(slot: { starts_at: string; ends_at?: string | null }, businessHours: BusinessHours | null) {
  if (!businessHours) return true;

  const start = new Date(slot.starts_at);
  const end = new Date(slot.ends_at || addMinutes(start, Number(businessHours.slot_minutes || 60)).toISOString());
  const workingDays =
    Array.isArray(businessHours.working_days) && businessHours.working_days.length
      ? businessHours.working_days
      : [1, 2, 3, 4, 5, 6, 7];
  if (!workingDays.includes(isoDayNumber(start))) return false;

  const businessStart = timeToMinutes(businessHours.start_time, 9 * 60);
  const businessEnd = timeToMinutes(businessHours.end_time, 21 * 60);
  const slotStart = start.getHours() * 60 + start.getMinutes();
  const slotEnd = end.getHours() * 60 + end.getMinutes();
  if (slotStart < businessStart || slotEnd > businessEnd) return false;

  const lunchStart = timeToMinutes(businessHours.lunch_break_start, -1);
  const lunchEnd = timeToMinutes(businessHours.lunch_break_end, -1);
  if (lunchStart >= 0 && lunchEnd >= 0 && slotStart < lunchEnd && slotEnd > lunchStart) {
    return false;
  }

  return true;
}

function buildRequestPlacementSlots(
  request: CalendarRequest,
  businessHours: BusinessHours | null,
  bookings: TrainerScheduleEntry[],
  minHoursBeforeStart: number
) {
  const dayBookings = bookings.filter((booking) => toDateKey(booking.starts_at) === request.request_date_key);
  const requestedSlots = Array.isArray(request.assignable_slots) ? request.assignable_slots : [];

  return requestedSlots
    .filter((slot) => String(slot.starts_at).slice(0, 10) === request.request_date_key)
    .filter((slot) => slotFitsBusinessHours(slot, businessHours))
    .filter((slot) => !isOutsideMinimumLeadTime(slot.starts_at, minHoursBeforeStart))
    .filter((slot) => {
      const start = new Date(slot.starts_at);
      const end = new Date(slot.ends_at || addMinutes(start, Number(businessHours?.slot_minutes || 60)).toISOString());
      return !dayBookings.some((booking) => rangesOverlap(start, end, booking.starts_at, booking.ends_at));
    })
    .map((slot) => {
      const start = new Date(slot.starts_at);
      const end = new Date(slot.ends_at || addMinutes(start, Number(businessHours?.slot_minutes || 60)).toISOString());
      return {
        key: `${request.request_date_key}-${start.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`,
        startsAt: slot.starts_at,
        endsAt: end.toISOString(),
        label: `${start.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        })}`,
        dayKey: request.request_date_key,
        dayLabel: request.request_date_label,
      } satisfies AvailableSlot;
    })
    .sort((first, second) => new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime());
}

function groupSlotsByDay(slots: Array<{ starts_at: string; ends_at?: string | null }>) {
  const groups = new Map<string, AvailableSlot[]>();

  for (const slot of slots) {
    if (!slot.starts_at) continue;
    const dateKey = String(slot.starts_at).slice(0, 10);
    const dayDate = new Date(`${dateKey}T00:00:00`);
    const entry: AvailableSlot = {
      key: `${dateKey}-${new Date(slot.starts_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`,
      startsAt: slot.starts_at,
      endsAt: slot.ends_at || addMinutes(new Date(slot.starts_at), 60).toISOString(),
      label: `${new Date(slot.starts_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} - ${new Date(
        slot.ends_at || addMinutes(new Date(slot.starts_at), 60).toISOString()
      ).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`,
      dayKey: dateKey,
      dayLabel: dayDate.toLocaleDateString("tr-TR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      }),
    };
    groups.set(dateKey, [...(groups.get(dateKey) || []), entry]);
  }

  return Array.from(groups.entries())
    .map(([dayKey, entries]) => ({
      dayKey,
      dayLabel: entries[0]?.dayLabel || dayKey,
      slots: entries.sort((first, second) => new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime()),
    }))
    .sort((first, second) => new Date(`${first.dayKey}T00:00:00`).getTime() - new Date(`${second.dayKey}T00:00:00`).getTime());
}

function RequestCard({
  request,
  onOpen,
  onAdd,
  adding,
}: {
  request: CalendarRequest;
  onOpen: () => void;
  onAdd: () => void;
  adding: boolean;
}) {
  return (
    <Pressable onPress={onOpen} style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <Text style={styles.requestTitle}>{request.member_full_name}</Text>
        <StatusBadge label="Talep" tone="warning" />
      </View>
      <Text style={styles.requestText}>{request.package_title}</Text>
      {request.note ? <Text style={styles.requestText}>{request.note}</Text> : null}
      <Text style={styles.requestMeta}>Talep günü: {request.request_date_label}</Text>
      <ActionButton label="Takvime ekle" icon="calendar" onPress={onAdd} loading={adding} />
    </Pressable>
  );
}

export default function TrainerCalendarScreen() {
  const router = useRouter();
  const todayAnchor = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return today.toISOString();
  }, []);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [placementRequestId, setPlacementRequestId] = useState<string | null>(null);
  const [selectedRescheduleDayKey, setSelectedRescheduleDayKey] = useState<string | null>(null);

  const bookingQuery = useQuery({
    queryKey: ["trainer-bookings-calendar"],
    queryFn: getTrainerBookingsApi,
  });
  const availabilityQuery = useQuery({
    queryKey: ["trainer-availabilities-calendar"],
    queryFn: getTrainerAvailabilitiesApi,
  });
  const todayQuery = useQuery({
    queryKey: ["trainer-today-calendar"],
    queryFn: getTrainerTodayApi,
  });
  const groupClassesQuery = useQuery({
    queryKey: ["trainer-group-classes"],
    queryFn: getTrainerGroupClassesApi,
  });
  const membersQuery = useQuery({
    queryKey: ["trainer-members-calendar"],
    queryFn: getTrainerMembersApi,
  });

  const liveBookings = Array.isArray(bookingQuery.data) ? bookingQuery.data : [];
  const liveAvailabilities = Array.isArray(availabilityQuery.data) ? availabilityQuery.data : [];

  const bookings: any[] = useMemo(
    () =>
      [
        ...(Array.isArray(groupClassesQuery.data) ? (groupClassesQuery.data as any[]) : []),
        ...liveBookings,
      ]
        .filter((row, index, all) => all.findIndex((item) => String(item.id) === String(row.id)) === index)
        .filter(
          (row) => !["CANCELED", "CANCELLED"].includes(String(row?.status || "").toUpperCase())
        ),
    [groupClassesQuery.data, liveBookings]
  );

  const rawRequests = useMemo(() => {
    const liveRequests = buildTrainerRequests(liveAvailabilities);
    return liveRequests;
  }, [liveAvailabilities]);

  const plannedRequestKeys = useMemo(() => {
    return new Set(
      bookings
        .filter((booking) => booking.member_id && booking.starts_at)
        .map((booking) => `${booking.member_id}-${String(booking.starts_at).slice(0, 10)}`)
    );
  }, [bookings]);

  const requests = useMemo(
    () => rawRequests.filter((request) => !plannedRequestKeys.has(`${request.member_id}-${request.request_date_key}`)),
    [plannedRequestKeys, rawRequests]
  );

  const businessHours = useMemo(
    () => resolveBusinessHours(todayQuery.data?.calendar?.business_hours),
    [todayQuery.data?.calendar?.business_hours]
  );
  const minimumAdvanceHours = useMemo(
    () => Math.max(1, Number(todayQuery.data?.calendar?.booking_policy?.min_hours_before_start || 3)),
    [todayQuery.data?.calendar?.booking_policy?.min_hours_before_start]
  );

  const selectedDayRequests = useMemo(
    () => requests.filter((request) => !selectedDateKey || request.request_date_key === selectedDateKey),
    [requests, selectedDateKey]
  );

  const selectedRequest = useMemo(
    () => requests.find((item) => item.id === selectedRequestId) || null,
    [requests, selectedRequestId]
  );

  const placementRequest = useMemo(
    () => requests.find((item) => item.id === placementRequestId) || null,
    [placementRequestId, requests]
  );

  const placementSlots = useMemo(
    () => (placementRequest ? buildRequestPlacementSlots(placementRequest, businessHours, bookings, minimumAdvanceHours) : []),
    [bookings, businessHours, minimumAdvanceHours, placementRequest]
  );

  const events = useMemo(
    () =>
      bookings.map((row) => ({
        id: String(row.id),
        title: row.is_group_class ? row.lesson_name || row.session_title || "Grup dersi" : row.member_full_name || "Danışan",
        subtitle: row.is_group_class
          ? `${row.recurrence_label || "Özel tarih"} • ${Number(row.joined_member_count || 0)} katılım`
          : `${row.lesson_category_label || row.package_name || row.package_title || "Seans"} • ${row.package_title || row.package_name || "Paket"}`,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        badgeLabel: row.pending_schedule_change ? "Üye Onayı Bekliyor" : formatStatusLabel(row.status) || undefined,
        badgeTone: row.pending_schedule_change ? "warning" : getStatusTone(row.status),
        draggable: false,
        onPress: () => setSelectedBookingId(String(row.id)),
      })),
    [bookings]
  );

  const selectedBooking = useMemo(
    () => bookings.find((item) => String(item.id) === selectedBookingId) || null,
    [bookings, selectedBookingId]
  );

  const memberDetailQuery = useQuery({
    queryKey: ["trainer-calendar-member-detail", selectedBooking?.member_id],
    queryFn: () => getTrainerMemberDetailApi(String(selectedBooking?.member_id)),
    enabled: Boolean(selectedBooking?.member_id),
  });
  const memberMeasurementsQuery = useQuery({
    queryKey: ["trainer-calendar-member-measurements", selectedBooking?.member_id],
    queryFn: () => getTrainerMemberMeasurementsApi(String(selectedBooking?.member_id)),
    enabled: Boolean(selectedBooking?.member_id),
  });
  const memberNotesQuery = useQuery({
    queryKey: ["trainer-calendar-member-notes", selectedBooking?.member_id],
    queryFn: () => getTrainerMemberNotesApi(String(selectedBooking?.member_id)),
    enabled: Boolean(selectedBooking?.member_id),
  });
  const memberAttendanceQuery = useQuery({
    queryKey: ["trainer-calendar-member-attendance", selectedBooking?.member_id],
    queryFn: () => getTrainerMemberAttendanceApi(String(selectedBooking?.member_id)),
    enabled: Boolean(selectedBooking?.member_id),
  });
  const groupMemberNameMap = useMemo(() => {
    const rows = Array.isArray(membersQuery.data) ? membersQuery.data : [];
    return new Map(
      rows.map((row: any) => [
        String(row.id || ""),
        String(row.full_name || row.email || row.phone || "Salon üyesi"),
      ])
    );
  }, [membersQuery.data]);

 const createBookingMutation = useMutation({
  mutationFn: (payload: { request: CalendarRequest; slot: AvailableSlot }) =>
    createTrainerBookingApi({
      member_id: payload.request.member_id,
      starts_at: payload.slot.startsAt,
      ends_at: payload.slot.endsAt,
      status: "APPROVED",
      meta: {
        package_id: payload.request.package_id || payload.request.id,
        package_title: payload.request.package_title,
        note: payload.request.note || undefined,
      },
    }),

  meta: {
    invalidates: [
      ["trainer-bookings"],
      ["trainer-today"],
      ["trainer-today-calendar"],
      ["trainer-availabilities"],

      ["member-bookings"],
      ["member-bookings-calendar"],
      ["member-home"],
      ["member-home-v2"],

      ["admin-bookings"],
      ["admin-bookings-calendar"],
      ["admin-dashboard"],
      ["admin-dashboard-v2"],
      ["admin-settings-calendar"],
    ],
  },

  onSuccess: () => {
    setPlacementRequestId(null);
    setSelectedRequestId(null);
  },

  onError: (error: any) => {
    showErrorAlert(
      "Ders planlanamadı",
      error,
      "Seçilen saat için ders planı oluşturulamadı."
    );
  },
});

const cancelBookingMutation = useMutation({
  mutationFn: (bookingId: string) =>
    patchTrainerBookingStatusApi(bookingId, { status: "CANCELED" }),

  meta: {
    invalidates: [
      ["trainer-bookings"],
      ["trainer-today"],
      ["trainer-today-calendar"],
      ["trainer-availabilities"],

      ["member-bookings"],
      ["member-bookings-calendar"],
      ["member-home"],
      ["member-home-v2"],

      ["admin-bookings"],
      ["admin-bookings-calendar"],
      ["admin-dashboard"],
      ["admin-dashboard-v2"],
      ["admin-settings-calendar"],
    ],
  },

  onSuccess: () => {
    setSelectedBookingId(null);
  },

  onError: (error: any) => {
    showErrorAlert(
      "Ders kaldırılamadı",
      error,
      "Ders takvimden çıkarılamadı. Lütfen tekrar deneyin."
    );
  },
});

 const scheduleChangeMutation = useMutation({
  mutationFn: (payload: {
    bookingId: string;
    starts_at: string;
    ends_at: string;
    member_id: string;
  }) => createTrainerScheduleChangeRequestApi(payload.bookingId, payload),

  meta: {
    invalidates: [
      ["trainer-bookings"],
      ["trainer-today"],
      ["trainer-today-calendar"],

      ["member-schedule-change-requests"],
      ["member-bookings"],
      ["member-bookings-calendar"],
      ["member-home"],
      ["member-home-v2"],

      ["admin-bookings"],
      ["admin-bookings-calendar"],
      ["admin-dashboard"],
      ["admin-dashboard-v2"],
    ],
  },

  onSuccess: () => {
    showInfoAlert(
      "Saat değişikliği gönderildi",
      "Yeni saat önerisi üyeye iletildi. Onay sonrası takvim güncellenecek."
    );
  },

  onError: (error: any) => {
    showErrorAlert(
      "Saat değişikliği gönderilemedi",
      error,
      "Yeni saat önerisi oluşturulamadı. Lütfen tekrar deneyin."
    );
  },
});

  const latestMeasurement = Array.isArray(memberMeasurementsQuery.data) ? memberMeasurementsQuery.data[0] : null;
  const latestAttendance = Array.isArray(memberAttendanceQuery.data) ? memberAttendanceQuery.data[0] : null;
  const recentNotes = Array.isArray(memberNotesQuery.data?.data)
    ? memberNotesQuery.data.data.slice(0, 2)
    : Array.isArray(memberNotesQuery.data)
      ? memberNotesQuery.data.slice(0, 2)
      : [];
  const memberStats = memberDetailQuery.data?.stats || {};
  const packageSummary = Array.isArray(memberDetailQuery.data?.package_summary) ? memberDetailQuery.data.package_summary[0] : null;
  const selectedGroupMembers = useMemo(() => {
    if (!selectedBooking?.is_group_class) return [];
    const invitedIds = Array.isArray(selectedBooking.invited_member_ids) ? selectedBooking.invited_member_ids : [];
    return invitedIds
      .map((id: string) => groupMemberNameMap.get(String(id)) || null)
      .filter((item: string | null): item is string => Boolean(item));
  }, [groupMemberNameMap, selectedBooking]);
  const rescheduleDayGroups = useMemo(
    () => groupSlotsByDay(Array.isArray(selectedBooking?.assignable_slots) ? selectedBooking.assignable_slots : []),
    [selectedBooking?.assignable_slots]
  );
  const selectedRescheduleDay = useMemo(
    () => rescheduleDayGroups.find((item) => item.dayKey === selectedRescheduleDayKey) || rescheduleDayGroups[0] || null,
    [rescheduleDayGroups, selectedRescheduleDayKey]
  );

  useEffect(() => {
    setSelectedRescheduleDayKey(rescheduleDayGroups[0]?.dayKey || null);
  }, [selectedBooking?.id, rescheduleDayGroups]);

  function handleAddRequest(request: CalendarRequest) {
    const availableSlots = buildRequestPlacementSlots(request, businessHours, bookings, minimumAdvanceHours);

    if (availableSlots.length === 0) {
      showInfoAlert(
        "Uygun saat bulunamadı",
        `Seçilen saatler dolu, çalışma saatleri dışında ya da en az ${minimumAdvanceHours} saat öncesi kuralını karşılamıyor.`
      );
      return;
    }

    if (availableSlots.length === 1) {
      setSelectedRequestId(null);
      createBookingMutation.mutate({ request, slot: availableSlots[0] });
      return;
    }

    setSelectedRequestId(null);
    setPlacementRequestId(request.id);
  }

  return (
    <AppShell
      title="Takvimim"
      subtitle="Ders programını yönet, talepleri planla ve değişiklik yap."
      icon="calendar"
      refreshing={bookingQuery.isRefetching || availabilityQuery.isRefetching || todayQuery.isRefetching || groupClassesQuery.isRefetching}
      onRefresh={() => {
        void Promise.all([bookingQuery.refetch(), availabilityQuery.refetch(), todayQuery.refetch(), groupClassesQuery.refetch()]);
      }}
    >
      <WeeklyScheduler
        mode="trainer"
        events={events}
        initialDate={todayAnchor}
        emptyTitle="Planlı ders bulunmuyor"
        emptyDescription="Onaylanan dersler burada görüntülenir."
        businessHours={businessHours}
        showRequestPanel={false}
        hideEmptyState
        onSelectedDateChange={({ key }) => {
          setSelectedDateKey(key);
        }}
      />

      <SurfaceCard>
        <Text style={styles.boardTitle}>Ders Talepleri</Text>
        <Text style={styles.detailText}>Seçili güne ait talepler listelenir. Takvime ekleme sırasında yalnızca uygun saatler sunulur.</Text>
        <View style={styles.requestGrid}>
          {selectedDayRequests.length === 0 ? (
            <EmptyState title="Talep bulunmuyor" description="Seçili gün için bekleyen ders talebi yok." icon="request" />
          ) : (
            selectedDayRequests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                onOpen={() => setSelectedRequestId(request.id)}
                onAdd={() => handleAddRequest(request)}
                adding={createBookingMutation.isPending && placementRequestId === request.id}
              />
            ))
          )}
        </View>
      </SurfaceCard>

      <DetailSheet
        visible={Boolean(selectedRequest)}
        onClose={() => setSelectedRequestId(null)}
        title={selectedRequest?.member_full_name || "Talep detayı"}
        subtitle={selectedRequest?.package_title || "Ders talebi"}
      >
        <SurfaceCard tone="warning">
          <Text style={styles.detailTitle}>Talep bilgisi</Text>
          <Text style={styles.detailText}>{selectedRequest?.request_date_label || "-"}</Text>
          {selectedRequest?.note ? <Text style={styles.detailText}>Not: {selectedRequest.note}</Text> : null}
          {selectedRequest?.assignable_slots?.length ? (
            <Text style={styles.detailText}>
              Seçilen saatler:{" "}
              {selectedRequest.assignable_slots
                .map((slot) => formatDateTimeRange(slot.starts_at, slot.ends_at))
                .join(" • ")}
            </Text>
          ) : null}
        </SurfaceCard>

        <ActionButton
          label="Takvime ekle"
          icon="calendar"
          onPress={() => {
            if (!selectedRequest) return;
            handleAddRequest(selectedRequest);
          }}
          loading={createBookingMutation.isPending && selectedRequestId === selectedRequest?.id}
        />
      </DetailSheet>

      <DetailSheet
        visible={Boolean(placementRequest)}
        onClose={() => setPlacementRequestId(null)}
        title={placementRequest?.member_full_name || "Saat seç"}
        subtitle="Uygun saat seç"
      >
        <SurfaceCard tone="warning">
          <Text style={styles.detailTitle}>{placementRequest?.request_date_label || "-"}</Text>
          <Text style={styles.detailText}>Üyenin paylaştığı uygun saatlerden birini seç.</Text>
        </SurfaceCard>

        <ScrollPanel maxHeight={220} contentContainerStyle={styles.slotList}>
          {placementSlots.map((slot) => (
            <Pressable
              key={slot.key}
              style={styles.slotOption}
              onPress={() => {
                if (!placementRequest) return;
                createBookingMutation.mutate({ request: placementRequest, slot });
              }}
            >
              <Text style={styles.slotOptionText}>{slot.label}</Text>
            </Pressable>
          ))}
        </ScrollPanel>
      </DetailSheet>

      <DetailSheet
        visible={Boolean(selectedBooking)}
        onClose={() => setSelectedBookingId(null)}
        title={selectedBooking?.member_full_name || "Ders detayı"}
        subtitle={selectedBooking?.lesson_category_label || selectedBooking?.package_title || "Ders detayı"}
      >
        <SurfaceCard tone="primary">
          <Text style={styles.detailTitle}>{formatDateTimeRange(selectedBooking?.starts_at, selectedBooking?.ends_at)}</Text>
          {selectedBooking?.is_group_class ? <Text style={styles.detailText}>Grup dersi: {selectedBooking?.lesson_name || selectedBooking?.session_title || "-"}</Text> : null}
          <Text style={styles.detailText}>Paket: {selectedBooking?.package_title || selectedBooking?.package_name || "-"}</Text>
          {selectedBooking?.is_group_class ? <Text style={styles.detailText}>Bildirim: {getGroupClassAudienceLabel(selectedBooking?.notification_scope)}</Text> : null}
          {selectedBooking?.is_group_class ? <Text style={styles.detailText}>Ücret: {formatGroupClassPrice(selectedBooking?.price)}</Text> : null}
          {selectedBooking?.is_group_class ? <Text style={styles.detailText}>Katılım: {Number(selectedBooking?.joined_member_count || 0)} • Davet: {Number(selectedBooking?.invited_member_count || 0)}</Text> : null}
          {selectedBooking?.is_group_class && selectedGroupMembers.length > 0 ? (
            <Text style={styles.detailText}>Katılacak üyeler: {selectedGroupMembers.join(", ")}</Text>
          ) : null}
          <Text style={styles.detailText}>Kalan hak: {packageSummary?.remaining_credits ?? "-"}</Text>
          <Text style={styles.detailText}>Toplam ders: {memberStats.booking_count ?? "-"}</Text>
          <Text style={styles.detailText}>Katılım sayısı: {memberStats.checkin_count ?? "-"}</Text>
          <Text style={styles.detailText}>Son katılım: {latestAttendance?.created_at ? new Date(latestAttendance.created_at).toLocaleString("tr-TR") : "-"}</Text>
          <Text style={styles.detailText}>
            Son ölçüm: {latestMeasurement ? `${latestMeasurement.weight_kg ?? "-"} kg • Yağ ${latestMeasurement.fat_percent ?? "-"} • Kas ${latestMeasurement.muscle_kg ?? latestMeasurement.muscle_percent ?? "-"}` : "Kayıt yok"}
          </Text>
          {selectedBooking?.pending_schedule_change ? (
            <Text style={styles.detailText}>
              Bekleyen yeni saat: {formatDateTimeRange(selectedBooking.pending_schedule_change.proposed_starts_at, selectedBooking.pending_schedule_change.proposed_ends_at)}
            </Text>
          ) : null}
        </SurfaceCard>

        <SurfaceCard>
          <Text style={styles.detailTitle}>Eğitmen notları</Text>
          {recentNotes.length === 0 ? (
            <Text style={styles.detailText}>Kayıtlı not yok.</Text>
          ) : (
            <ScrollPanel maxHeight={160}>
              {recentNotes.map((note: any) => (
                <Text key={note.id || note.created_at} style={styles.detailText}>
                  • {note.title || note.category || "Not"}: {note.body || note.note}
                </Text>
              ))}
            </ScrollPanel>
          )}
        </SurfaceCard>

        <SurfaceCard>
          <Text style={styles.detailTitle}>Ders saatini değiştir</Text>
          <Text style={styles.detailText}>Önce gün, ardından saat seç. Talep üyeye iletilir ve onay süreci başlar.</Text>

          {selectedBooking?.is_group_class ? (
            <Text style={styles.detailText}>Grup derslerinin saati grup dersi düzenleme akışından güncellenir.</Text>
          ) : rescheduleDayGroups.length === 0 ? (
            <Text style={styles.detailText}>Bu ders için uygun alternatif saat bulunmuyor.</Text>
          ) : (
            <>
              <View style={styles.rescheduleCalendar}>
                {rescheduleDayGroups.map((group) => {
                  const active = group.dayKey === selectedRescheduleDay?.dayKey;
                  const dayDate = new Date(`${group.dayKey}T00:00:00`);
                  return (
                    <Pressable
                      key={group.dayKey}
                      onPress={() => setSelectedRescheduleDayKey(group.dayKey)}
                      style={[styles.dayCard, active ? styles.dayCardActive : null]}
                    >
                      <Text style={[styles.dayCardWeekday, active ? styles.dayCardWeekdayActive : null]}>
                        {dayDate.toLocaleDateString("tr-TR", { weekday: "short" }).toUpperCase()}
                      </Text>
                      <Text style={[styles.dayCardNumber, active ? styles.dayCardNumberActive : null]}>
                        {dayDate.toLocaleDateString("tr-TR", { day: "2-digit" })}
                      </Text>
                      <Text style={[styles.dayCardMonth, active ? styles.dayCardMonthActive : null]}>
                        {dayDate.toLocaleDateString("tr-TR", { month: "short" })}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <ScrollPanel maxHeight={220} contentContainerStyle={styles.slotList}>
                {selectedRescheduleDay?.slots.map((slot) => (
                  <Pressable
                    key={slot.key}
                    style={styles.slotOption}
                    onPress={() => {
                      if (!selectedBooking?.id || !selectedBooking?.member_id) return;
                      scheduleChangeMutation.mutate({
                        bookingId: String(selectedBooking.id),
                        starts_at: slot.startsAt,
                        ends_at: slot.endsAt,
                        member_id: String(selectedBooking.member_id),
                      });
                    }}
                  >
                    <Text style={styles.slotOptionText}>{slot.label}</Text>
                  </Pressable>
                ))}
              </ScrollPanel>
            </>
          )}
        </SurfaceCard>

        <ActionButton
          label="Takvimden kaldır"
          variant="danger"
          onPress={() => {
            if (!selectedBooking?.id) return;
            Alert.alert("Dersi kaldır", "Bu dersi takvimden kaldırıp planlama listesine geri almak istiyor musun?", [
              { text: "Vazgeç", style: "cancel" },
              {
                text: "Kaldır",
                style: "destructive",
                onPress: () => {
                  cancelBookingMutation.mutate(String(selectedBooking.id));
                },
              },
            ]);
          }}
          loading={cancelBookingMutation.isPending}
        />

        <ActionButton
          label="Danışan detayına git"
          icon="clients"
          variant="ghost"
          onPress={() => {
            if (!selectedBooking?.member_id) return;
            setSelectedBookingId(null);
            router.push(`/(trainer)/members/${selectedBooking.member_id}` as never);
          }}
        />
      </DetailSheet>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  boardTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
  },
  requestGrid: {
    gap: tokens.spacing.sm,
  },
  requestCard: {
    gap: tokens.spacing.sm,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.24)",
    backgroundColor: tokens.colors.warningSoft,
    padding: tokens.spacing.sm,
    ...tokens.shadow.soft,
  },
  requestHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  requestTitle: {
    flex: 1,
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  requestText: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.regular,
  },
  requestMeta: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.medium,
  },
  detailTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.bold,
  },
  detailText: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: 20,
    fontFamily: tokens.fontFamily.regular,
  },
  slotList: {
    gap: tokens.spacing.sm,
  },
  slotOption: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSoft,
    padding: tokens.spacing.sm,
  },
  slotOptionText: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: 20,
    fontFamily: tokens.fontFamily.medium,
  },
  rescheduleCalendar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.sm,
  },
  dayCard: {
    width: 74,
    minHeight: 88,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSoft,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dayCardActive: {
    borderColor: tokens.colors.primaryStrong,
    backgroundColor: tokens.colors.infoSoft,
    ...tokens.shadow.soft,
  },
  dayCardWeekday: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  dayCardWeekdayActive: {
    color: tokens.colors.primaryStrong,
  },
  dayCardNumber: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
  },
  dayCardNumberActive: {
    color: tokens.colors.primaryStrong,
  },
  dayCardMonth: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
    textTransform: "capitalize",
  },
  dayCardMonthActive: {
    color: tokens.colors.primaryStrong,
  },
});
