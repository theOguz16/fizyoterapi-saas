"use client";
/* eslint-disable react-hooks/exhaustive-deps */

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { EventInput, type EventClickArg } from "@fullcalendar/core";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ActionButton } from "@/components/ui/action-button";
import { MetricCard } from "@/components/ui/metric-card";
import { httpRequest } from "@/lib/http-client";
import { useRequireRole } from "@/lib/require-role";
import {
  BookingDetailDialog,
  BookingOverviewCard,
  BookingRescheduleDialog,
  BookingSuggestionsBoard,
  BookingSupportPanel,
  type RescheduleOption,
  type SuggestionGroup,
} from "./BookingPanels";
import type {
  AvailabilityItem,
  BookingItem,
  BookingOptionPayload,
  CalendarBusinessHours,
} from "./booking-types";
import { buildRangeQuery } from "./booking-utils";
import { useBookingDerivations } from "./use-booking-derivations";

const TrainerBookingCalendar = dynamic(() => import("./TrainerBookingCalendar"), { ssr: false });

function compactMemberLabel(label?: string | null) {
  if (!label) return "Danışan";
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[1].slice(0, 1)}.`;
  return label;
}

function bookingStatusTone(status?: string) {
  if (status === "APPROVED") return "success";
  if (status === "RESCHEDULED") return "info";
  if (status === "CANCELED") return "muted";
  return "pending";
}

function availabilityKey(row: AvailabilityItem) {
  return [row.member_id, row.starts_at, row.ends_at, row.package_id || "", row.note || ""].join("|");
}

function uniqueAvailabilities(rows: AvailabilityItem[]) {
  return rows
    .slice()
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .filter((row, index, list) => list.findIndex((candidate) => availabilityKey(candidate) === availabilityKey(row)) === index);
}

function overlaps(startA: string, endA: string, startB: string, endB: string) {
  return new Date(startA).getTime() < new Date(endB).getTime() && new Date(endA).getTime() > new Date(startB).getTime();
}

const RESCHEDULE_WINDOW_MS = 3 * 60 * 60 * 1000;

export default function TrainerBookingsPage() {
  const { loading: authLoading, user } = useRequireRole("TRAINER");

  const [busy, setBusy] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [weekLabel, setWeekLabel] = useState("");
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [calendarConfig, setCalendarConfig] = useState<CalendarBusinessHours>({
    timezone: "Europe/Istanbul",
    start_time: "09:00",
    end_time: "18:00",
    lunch_break_start: "12:00",
    lunch_break_end: "13:00",
    slot_minutes: 60,
  });
  const [availabilities, setAvailabilities] = useState<AvailabilityItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [planningMemberQuery, setPlanningMemberQuery] = useState("");
  const [selectedSlotsByGroup, setSelectedSlotsByGroup] = useState<Record<string, string[]>>({});
  const [selectedPackageByGroup, setSelectedPackageByGroup] = useState<Record<string, string>>({});
  const [selectedRescheduleOptionId, setSelectedRescheduleOptionId] = useState("");
  const [formOptions, setFormOptions] = useState<BookingOptionPayload["data"]>({
    members: [],
    packages: [],
    trainer_assigned_packages: [],
    member_active_package_ids: {},
    member_bookable_package_ids: {},
    member_package_diagnostics: {},
    allowed_categories: [],
  });

  const visibleRangeRef = useRef<{ from: string | null; to: string | null }>({ from: null, to: null });
  const lastDatesSetKeyRef = useRef("");
  const status: "loading" | "ready" | "unauthorized" = authLoading ? "loading" : user ? "ready" : "unauthorized";

  const {
    startTime,
    endTime,
    lunchStart,
    lunchEnd,
    slotMinutes,
    slotDurationText,
    effectiveWorkingDays,
    selectedBooking,
    memberWeeklyLimitIndex,
    weeklyBookingCountIndex,
    businessHours,
    reasonCodeLabel,
    getMemberDiagnostic,
    getMemberBookablePackageIds,
  } = useBookingDerivations({
    calendarConfig,
    availabilities,
    bookings,
    selectedBookingId,
    form: {
      member_id: "",
      package_id: "",
      booking_date: "",
      booking_slot: "",
    },
    formOptions,
  });

  useEffect(() => {
    if (status !== "ready") return;
    Promise.all([loadCalendarConfig(), loadFormOptions()]).catch(() => toast.error("Takvim verileri yüklenemedi"));
  }, [status]);

  async function loadAvailabilities(from?: string | null, to?: string | null) {
    setAvailabilityLoading(true);
    try {
      const payload = await httpRequest<{ data: AvailabilityItem[] }>(
        `/trainer/bookings/availabilities${buildRangeQuery(from, to)}`
      );
      setAvailabilities(payload.data || []);
    } finally {
      setAvailabilityLoading(false);
    }
  }

  async function loadBookings(from?: string | null, to?: string | null) {
    setCalendarLoading(true);
    try {
      const payload = await httpRequest<{ data: BookingItem[] }>(`/trainer/bookings${buildRangeQuery(from, to)}`);
      const rows = payload.data || [];
      setBookings(rows);
      setSelectedBookingId((prev) => (prev && rows.some((row) => row.id === prev) ? prev : ""));
    } finally {
      setCalendarLoading(false);
    }
  }

  async function loadCalendarConfig() {
    const payload = await httpRequest<{ data?: { calendar?: { business_hours?: CalendarBusinessHours } } }>(
      "/trainer/today"
    );
    if (payload.data?.calendar?.business_hours) {
      setCalendarConfig(payload.data.calendar.business_hours);
    }
  }

  async function loadFormOptions() {
    try {
      const payload = await httpRequest<BookingOptionPayload>("/trainer/bookings/form-options");
      setFormOptions(payload.data);
      if (payload.data.slot_contract) {
        setCalendarConfig((prev) => ({ ...prev, ...payload.data.slot_contract }));
      }
    } catch {
      setFormOptions({
        members: [],
        packages: [],
        trainer_assigned_packages: [],
        member_active_package_ids: {},
        member_bookable_package_ids: {},
        member_package_diagnostics: {},
        allowed_categories: [],
      });
    }
  }

  async function refreshCalendarConfiguration() {
    try {
      await loadCalendarConfig();
      await Promise.all([
        loadBookings(visibleRangeRef.current.from, visibleRangeRef.current.to),
        loadAvailabilities(visibleRangeRef.current.from, visibleRangeRef.current.to),
      ]);
      toast.success("Takvim ayarları güncellendi");
    } catch {
      toast.error("Takvim ayarları yenilenemedi");
    }
  }

  const filteredAvailabilities = useMemo(() => {
    const normalizedQuery = planningMemberQuery.trim().toLocaleLowerCase("tr");
    if (!normalizedQuery) return availabilities;

    return availabilities.filter((row) =>
      [row.member_full_name, row.member_email, row.member_id, row.note]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(normalizedQuery)
    );
  }, [availabilities, planningMemberQuery]);

  const suggestionGroups = useMemo<SuggestionGroup[]>(() => {
    const packageMap = new Map(
      formOptions.packages.map((pkg) => [
        pkg.id,
        {
          id: pkg.id,
          label: pkg.service_name || pkg.title,
          lesson_category: pkg.lesson_category ?? null,
          display_price: pkg.display_price ?? null,
        },
      ])
    );
    const groups = new Map<string, SuggestionGroup>();

    for (const row of uniqueAvailabilities(filteredAvailabilities)) {
      const memberId = row.member_id;
      const allowedPackageIds = getMemberBookablePackageIds(memberId);
      const packageOptions = allowedPackageIds
        .map((packageId) => packageMap.get(packageId))
        .filter((value): value is NonNullable<typeof value> => !!value);
      const defaultPackageId =
        selectedPackageByGroup[memberId] ||
        (row.package_id && allowedPackageIds.includes(row.package_id) ? row.package_id : packageOptions.length === 1 ? packageOptions[0].id : "");
      const weeklyTarget = memberWeeklyLimitIndex.get(memberId) || Math.max(1, Number(row.member_weekly_class_hours || 1));
      const existingCount = weeklyBookingCountIndex.get(memberId) || 0;
      const selectedIds = selectedSlotsByGroup[memberId] || [];
      const resolvedPackage =
        (row.package_id && allowedPackageIds.includes(row.package_id) ? packageMap.get(row.package_id) : null) ||
        (defaultPackageId ? packageMap.get(defaultPackageId) : null);

      if (!groups.has(memberId)) {
        groups.set(memberId, {
          id: memberId,
          member_id: memberId,
          member_full_name: row.member_full_name || memberId,
          member_email: row.member_email || null,
          weekly_target: weeklyTarget,
          existing_count: existingCount,
          remaining_count: Math.max(0, weeklyTarget - existingCount),
          slot_count: 0,
          selected_count: selectedIds.length,
          selected_package_id: defaultPackageId,
          package_options: packageOptions,
          package_titles: [],
          lesson_labels: [],
          blocker_text: packageOptions.length === 0 ? reasonCodeLabel(getMemberDiagnostic(memberId)?.reason_codes?.[0]) : null,
          slots: [],
        });
      }

      const group = groups.get(memberId);
      if (!group) continue;
      const startDate = new Date(row.starts_at);
      const dayLabel = startDate
        .toLocaleDateString("tr-TR", { weekday: "short" })
        .replace(".", "")
        .toUpperCase();
      group.slot_count += 1;
      group.selected_count = selectedIds.length;
      group.selected_package_id = defaultPackageId;
      group.slots.push({
        id: row.id,
        member_id: memberId,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        note: row.note,
        package_id: row.package_id && allowedPackageIds.includes(row.package_id) ? row.package_id : undefined,
        package_title: row.package_title || resolvedPackage?.label || undefined,
        package_display_price: row.package_display_price || resolvedPackage?.display_price || null,
        lesson_category: row.package_lesson_category || resolvedPackage?.lesson_category || null,
        date_label: startDate.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }),
        day_label: dayLabel,
        time_label: `${startDate.toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        })} - ${new Date(row.ends_at).toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        })}`,
        is_today:
          startDate.toDateString() === new Date().toDateString(),
        is_selected: selectedIds.includes(row.id),
      });
      const packageTitle = row.package_title || resolvedPackage?.label;
      if (packageTitle && !group.package_titles.includes(packageTitle)) {
        group.package_titles.push(packageTitle);
      }
      const lessonLabel = row.package_lesson_category || resolvedPackage?.lesson_category || null;
      if (lessonLabel && !group.lesson_labels.includes(lessonLabel)) {
        group.lesson_labels.push(lessonLabel);
      }
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        slots: group.slots.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
      }))
      .sort((a, b) => {
        const left = a.slots[0]?.starts_at ? new Date(a.slots[0].starts_at).getTime() : Number.MAX_SAFE_INTEGER;
        const right = b.slots[0]?.starts_at ? new Date(b.slots[0].starts_at).getTime() : Number.MAX_SAFE_INTEGER;
        return left - right;
      });
  }, [
    filteredAvailabilities,
    formOptions.packages,
    getMemberBookablePackageIds,
    getMemberDiagnostic,
    memberWeeklyLimitIndex,
    reasonCodeLabel,
    selectedPackageByGroup,
    selectedSlotsByGroup,
    weeklyBookingCountIndex,
  ]);

  const suggestionGroupMap = useMemo(
    () => new Map(suggestionGroups.map((group) => [group.id, group])),
    [suggestionGroups]
  );

  useEffect(() => {
    setSelectedSlotsByGroup((prev) => {
      let changed = false;
      const next: Record<string, string[]> = {};

      for (const group of suggestionGroups) {
        const allowed = new Set(group.slots.map((slot) => slot.id));
        const current = (prev[group.id] || []).filter((slotId) => allowed.has(slotId)).slice(0, group.remaining_count);
        if (current.length > 0) {
          next[group.id] = current;
        }
        if ((prev[group.id] || []).length !== current.length) {
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [suggestionGroups]);

  const rescheduleBlockedReason = useMemo(() => {
    if (!selectedBooking) return "";
    if (selectedBooking.status === "CANCELED") {
      return "İptal edilen booking yeniden planlanamaz.";
    }
    const diffMs = new Date(selectedBooking.starts_at).getTime() - Date.now();
    if (diffMs < RESCHEDULE_WINDOW_MS) {
      return "Derse 3 saatten az kaldığı için yeniden planlama kapalı.";
    }
    return "";
  }, [selectedBooking]);

  const rescheduleOptions = useMemo<RescheduleOption[]>(() => {
    if (!selectedBooking || rescheduleBlockedReason) return [];

    return uniqueAvailabilities(availabilities)
      .filter((row) => row.member_id === selectedBooking.member_id)
      .filter((row) => row.id !== selectedBooking.id)
      .filter((row) => row.starts_at !== selectedBooking.starts_at || row.ends_at !== selectedBooking.ends_at)
      .filter((row) => new Date(row.starts_at).getTime() > Date.now())
      .filter(
        (row) =>
          !bookings.some(
            (booking) =>
              booking.id !== selectedBooking.id &&
              booking.status !== "CANCELED" &&
              overlaps(row.starts_at, row.ends_at, booking.starts_at, booking.ends_at)
          )
      )
      .map((row) => {
        const startDate = new Date(row.starts_at);
        return {
          id: row.id,
          starts_at: row.starts_at,
          ends_at: row.ends_at,
          date_label: startDate.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }),
          day_label: startDate
            .toLocaleDateString("tr-TR", { weekday: "short" })
            .replace(".", "")
            .toUpperCase(),
          time_label: `${startDate.toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          })} - ${new Date(row.ends_at).toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          })}`,
          note: row.note,
        };
      })
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [availabilities, bookings, rescheduleBlockedReason, selectedBooking]);

  const visibleMemberCount = suggestionGroups.length;
  const visibleSlotCount = suggestionGroups.reduce((total, group) => total + group.slot_count, 0);
  const activeBookingCount = bookings.filter((item) => item.status !== "CANCELED").length;
  const remainingPlacementCount = suggestionGroups.reduce((total, group) => total + group.remaining_count, 0);

  async function createBookingRequest(input: {
    member_id: string;
    starts_at: string;
    ends_at: string;
    package_id?: string;
    lesson_category?: string;
    note?: string;
  }) {
    await httpRequest("/trainer/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        member_id: input.member_id,
        starts_at: new Date(input.starts_at).toISOString(),
        ends_at: new Date(input.ends_at).toISOString(),
        status: "PENDING",
        meta: {
          package_id: input.package_id || undefined,
          lesson_category: input.lesson_category || undefined,
          note: input.note || undefined,
        },
      }),
    });
  }

  function handleToggleSlot(groupId: string, slotId: string) {
    const group = suggestionGroupMap.get(groupId);
    if (!group) return;
    if (group.blocker_text) {
      toast.error(group.blocker_text);
      return;
    }
    setSelectedSlotsByGroup((prev) => {
      const current = prev[groupId] || [];
      if (current.includes(slotId)) {
        return {
          ...prev,
          [groupId]: current.filter((id) => id !== slotId),
        };
      }
      if (current.length >= group.remaining_count) {
        toast.error(`Bu danışan için yalnızca ${group.remaining_count} slot seçebilirsiniz.`);
        return prev;
      }
      return {
        ...prev,
        [groupId]: [...current, slotId],
      };
    });
  }

  function handleSelectRecommended(groupId: string) {
    const group = suggestionGroupMap.get(groupId);
    if (!group) return;
    if (group.blocker_text) {
      toast.error(group.blocker_text);
      return;
    }
    setSelectedSlotsByGroup((prev) => ({
      ...prev,
      [groupId]: group.slots.slice(0, group.remaining_count).map((slot) => slot.id),
    }));
  }

  function handleClearSelection(groupId: string) {
    setSelectedSlotsByGroup((prev) => ({
      ...prev,
      [groupId]: [],
    }));
  }

  async function handleScheduleGroup(groupId: string) {
    const group = suggestionGroupMap.get(groupId);
    if (!group) return;
    if (group.blocker_text) {
      toast.error(group.blocker_text);
      return;
    }

    const selectedIds = selectedSlotsByGroup[groupId] || [];
    if (selectedIds.length === 0) {
      toast.error("Önce en az bir uygun slot seçin");
      return;
    }

    const selectedSlots = group.slots.filter((slot) => selectedIds.includes(slot.id)).slice(0, group.remaining_count);
    const defaultPackageId =
      selectedPackageByGroup[groupId] ||
      group.selected_package_id ||
      (group.package_options.length === 1 ? group.package_options[0].id : "");

    setBusy(true);
    const successfulSlotIds: string[] = [];
    const failedMessages: string[] = [];

    try {
      for (const slot of selectedSlots) {
        const packageId = slot.package_id || defaultPackageId;
        if (!packageId) {
          failedMessages.push(`${slot.time_label} için önce paket seçin.`);
          continue;
        }
        const selectedPackage = formOptions.packages.find((pkg) => pkg.id === packageId);
        try {
          await createBookingRequest({
            member_id: group.member_id,
            starts_at: slot.starts_at,
            ends_at: slot.ends_at,
            package_id: packageId,
            lesson_category: slot.lesson_category || selectedPackage?.lesson_category || undefined,
            note: slot.note,
          });
          successfulSlotIds.push(slot.id);
        } catch (error) {
          failedMessages.push(error instanceof Error ? error.message : "Randevu oluşturulamadı");
        }
      }

      await loadBookings(visibleRangeRef.current.from, visibleRangeRef.current.to);

      if (successfulSlotIds.length > 0) {
        toast.success(`${successfulSlotIds.length} slot takvime aktarıldı`);
      }
      if (failedMessages.length > 0) {
        toast.error(failedMessages[0]);
      }
      setSelectedSlotsByGroup((prev) => ({
        ...prev,
        [groupId]: (prev[groupId] || []).filter((slotId) => !successfulSlotIds.includes(slotId)),
      }));
    } finally {
      setBusy(false);
    }
  }

  function handleDatesSet(info: { start: Date; end: Date; view: { title: string } }) {
    const from = info.start.toISOString();
    const to = info.end.toISOString();
    const rangeKey = `${from}|${to}`;
    if (lastDatesSetKeyRef.current === rangeKey) {
      setWeekLabel((prev) => (prev === info.view.title ? prev : info.view.title));
      return;
    }

    lastDatesSetKeyRef.current = rangeKey;
    visibleRangeRef.current = { from, to };
    setWeekLabel((prev) => (prev === info.view.title ? prev : info.view.title));
    Promise.all([loadBookings(from, to), loadAvailabilities(from, to)]).catch(() =>
      toast.error("Takvim verileri yüklenemedi")
    );
  }

  function openBookingDetail(info: EventClickArg) {
    setSelectedBookingId(String(info.event.id));
    setSelectedRescheduleOptionId("");
    setIsDetailOpen(true);
  }

  function handleOpenReschedule() {
    setIsDetailOpen(false);
    setSelectedRescheduleOptionId("");
    setIsRescheduleOpen(true);
  }

  async function handleSubmitReschedule() {
    if (!selectedBooking || !selectedRescheduleOptionId) {
      toast.error("Önce yeni slot seçin");
      return;
    }

    const selectedOption = rescheduleOptions.find((option) => option.id === selectedRescheduleOptionId);
    if (!selectedOption) {
      toast.error("Seçilen slot bulunamadı");
      return;
    }

    setBusy(true);
    try {
      await httpRequest(`/trainer/bookings/${selectedBooking.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "RESCHEDULED",
          starts_at: selectedOption.starts_at,
          ends_at: selectedOption.ends_at,
        }),
      });
      await loadBookings(visibleRangeRef.current.from, visibleRangeRef.current.to);
      toast.success("Randevu yeni slota taşındı");
      setIsRescheduleOpen(false);
      setSelectedRescheduleOptionId("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Randevu yeniden planlanamadı");
    } finally {
      setBusy(false);
    }
  }

  const calendarEvents = useMemo<EventInput[]>(
    () =>
      bookings
        .filter((row) => row.status !== "CANCELED")
        .map((row) => ({
          id: row.id,
          title: row.member_full_name || row.member_id,
          start: row.starts_at,
          end: row.ends_at,
          editable: false,
          backgroundColor:
            row.status === "APPROVED"
              ? "#10B981"
              : row.status === "RESCHEDULED"
                ? "#2563EB"
                : "#0EA5E9",
          borderColor: "transparent",
          className: ["interactive"],
          extendedProps: {
            status: row.status,
            session_id: row.session_id || null,
            member_id: row.member_id,
          },
        })),
    [bookings]
  );

  function renderEventContent(arg: { event: { title: string; start: Date | null; end: Date | null; extendedProps?: Record<string, unknown> } }) {
    const start = arg.event.start;
    const end = arg.event.end;
    const status = String(arg.event.extendedProps?.status || "PENDING");
    const timeLabel =
      start && end
        ? `${start.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString(
            "tr-TR",
            { hour: "2-digit", minute: "2-digit" }
          )}`
        : "Saat belirtilmedi";

    return (
      <div className="fc-event-content-modern">
        <p className="fc-event-title-modern">{compactMemberLabel(arg.event.title)}</p>
        <div className="fc-event-meta-modern">
          <span className={`fc-event-dot fc-event-dot-${bookingStatusTone(status)}`} aria-hidden="true" />
          <p className="fc-event-time-modern">{timeLabel}</p>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <p className="text-sm text-muted-foreground">Oturum kontrol ediliyor...</p>
      </main>
    );
  }

  if (status === "unauthorized") return null;

  return (
    <AppShell>
      <PageHeader
        title="Takvim ve Randevu Yönetimi"
        description="Uygun haftalık slotları seçip doğrudan takvime aktarın; mevcut booking’leri ise aynı ekrandan yeniden planlayın."
        actions={
          <ActionButton action="refresh" size="sm" onClick={refreshCalendarConfiguration}>
            Takvim Ayarını Yenile
          </ActionButton>
        }
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Görünür Danışan" value={visibleMemberCount} tone="sky" icon={<i className="fa-solid fa-users" aria-hidden="true" />} />
        <MetricCard label="Uygun Slot" value={visibleSlotCount} tone="emerald" icon={<i className="fa-solid fa-calendar-plus" aria-hidden="true" />} />
        <MetricCard label="Aktif Booking" value={activeBookingCount} tone="slate" icon={<i className="fa-solid fa-calendar-check" aria-hidden="true" />} />
        <MetricCard label="Kalan Yerleştirme" value={remainingPlacementCount} tone="amber" icon={<i className="fa-solid fa-list-check" aria-hidden="true" />} />
      </section>

      <BookingOverviewCard
        startTime={startTime}
        endTime={endTime}
        lunchStart={lunchStart}
        lunchEnd={lunchEnd}
        slotMinutes={slotMinutes}
      />

      <section className="grid gap-4 xl:grid-cols-[2.55fr,0.72fr]">
        <TrainerBookingCalendar
          calendarLoading={calendarLoading}
          weekLabel={weekLabel}
          startTime={startTime}
          endTime={endTime}
          lunchStart={lunchStart}
          lunchEnd={lunchEnd}
          workingDays={effectiveWorkingDays}
          slotMinutes={slotMinutes}
          slotDurationText={slotDurationText}
          businessHours={businessHours}
          calendarEvents={calendarEvents}
          openBookingDetail={openBookingDetail}
          renderEventContent={renderEventContent}
          handleDatesSet={handleDatesSet}
        />

        <BookingSupportPanel
          planningMemberQuery={planningMemberQuery}
          setPlanningMemberQuery={setPlanningMemberQuery}
          visibleMemberCount={visibleMemberCount}
          visibleSlotCount={visibleSlotCount}
          activeBookingCount={activeBookingCount}
          remainingPlacementCount={remainingPlacementCount}
          weekLabel={weekLabel}
        />
      </section>

      <BookingSuggestionsBoard
        groups={suggestionGroups}
        availabilityLoading={availabilityLoading}
        busy={busy}
        onToggleSlot={handleToggleSlot}
        onSelectRecommended={handleSelectRecommended}
        onClearSelection={handleClearSelection}
        onScheduleGroup={handleScheduleGroup}
        onPackageChange={(groupId, packageId) =>
          setSelectedPackageByGroup((prev) => ({
            ...prev,
            [groupId]: packageId,
          }))
        }
      />

      <BookingDetailDialog
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        selectedBooking={selectedBooking}
        canReschedule={!rescheduleBlockedReason}
        rescheduleHint={rescheduleBlockedReason}
        onOpenReschedule={handleOpenReschedule}
      />

      <BookingRescheduleDialog
        isOpen={isRescheduleOpen}
        onClose={() => setIsRescheduleOpen(false)}
        selectedBooking={selectedBooking}
        options={rescheduleOptions}
        selectedOptionId={selectedRescheduleOptionId}
        setSelectedOptionId={setSelectedRescheduleOptionId}
        onSubmit={handleSubmitReschedule}
        busy={busy}
        blockedReason={rescheduleBlockedReason || undefined}
      />
    </AppShell>
  );
}
