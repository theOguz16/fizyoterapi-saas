// Bu sayfa mobil uygulamada trainer akisindaki calendar ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { resolveBusinessHours } from "@/lib/scheduling/business-hours.normalize";
import { formatGroupClassPrice, getGroupClassAudienceLabel } from "@/lib/group-classes";
import { showErrorAlert, showInfoAlert } from "@/lib/user-feedback";
import {
  createTrainerBookingApi,
  createTrainerScheduleChangeRequestApi,
  getCalendarFeedApi,
  getTrainerAvailabilitiesApi,
  getTrainerMembersApi,
  getTrainerTodayApi,
  getTrainerMemberAttendanceApi,
  getTrainerMemberDetailApi,
  getTrainerMemberMeasurementsApi,
  getTrainerMemberNotesApi,
  markTrainerBookingNoShowApi,
  patchTrainerBookingStatusApi,
} from "@/lib/mobile-api";
import { calendarFeedEventToDetailRow, canShowTrainerCalendarCheckin, createCalendarFeedRange, type CalendarDetailRow } from "@/lib/calendar-feed";
import { collectMemberAssignableSlots } from "@/lib/trainer-scheduler";
import {
  addCalendarMinutes,
  buildRequestPlacementSlots,
  buildSelectedGroupMembers,
  buildTrainerRequests,
  formatTrainerDateTime,
  formatTrainerDateTimeRange,
  groupTrainerSlotsByDay,
  isOutsideMinimumLeadTime,
  slotFitsBusinessHours,
  trainerCalendarRangesOverlap,
  type AvailableSlot,
  type CalendarRequest,
} from "@/lib/trainer-calendar";
import { resolveTrainerFocusedBookingEventId } from "@/lib/trainer-today";
import { ActionButton } from "@/theme/components/action-button";
import { AppShell } from "@/theme/components/app-shell";
import { DetailSheet } from "@/theme/components/detail-sheet";
import { EmptyState } from "@/theme/components/empty-state";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { StatusBadge } from "@/theme/components/status-badge";
import { SurfaceCard } from "@/theme/components/surface-card";
import { VirtualListPanel } from "@/theme/components/virtual-list-panel";
import { WeeklyScheduler } from "@/theme/components/weekly-scheduler";
import { tokens } from "@/theme/tokens";

function formatEmpty(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
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

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{formatEmpty(value)}</Text>
    </View>
  );
}

function DetailStat({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <View style={styles.detailStatBox}>
      <Text style={styles.detailStatValue}>{formatEmpty(value)}</Text>
      <Text style={styles.detailStatLabel}>{label}</Text>
    </View>
  );
}

export default function TrainerCalendarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const focusedBookingId = Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId;
  const handledFocusedBookingId = useRef<string | null>(null);
  const calendarRange = useMemo(() => createCalendarFeedRange(), []);

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
  const [requestsVisible, setRequestsVisible] = useState(false);
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null);

  const calendarQuery = useQuery({
    queryKey: ["trainer-bookings-calendar", "feed", calendarRange.from, calendarRange.to],
    queryFn: () => getCalendarFeedApi(calendarRange),
  });
  const calendarTimezone = calendarQuery.data?.timezone || "Europe/Istanbul";

  const availabilityQuery = useQuery({
    queryKey: ["trainer-availabilities-calendar"],
    queryFn: getTrainerAvailabilitiesApi,
  });

  const todayQuery = useQuery({
    queryKey: ["trainer-today-calendar"],
    queryFn: getTrainerTodayApi,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const membersQuery = useQuery({
    queryKey: ["trainer-members-calendar"],
    queryFn: getTrainerMembersApi,
  });

  const liveAvailabilities = useMemo(() => availabilityQuery.data || [], [availabilityQuery.data]);

  const calendarRows: CalendarDetailRow[] = useMemo(
    () => (calendarQuery.data?.events || []).map(calendarFeedEventToDetailRow),
    [calendarQuery.data?.events]
  );
  const bookings = useMemo(
    () => calendarRows.filter((row) => !row.is_cancelled),
    [calendarRows]
  );

  const rawRequests = useMemo(() => buildTrainerRequests(liveAvailabilities), [liveAvailabilities]);
  const actionableRequests = useMemo(
    () => buildTrainerRequests(liveAvailabilities.filter((row) => row.action_required !== false)),
    [liveAvailabilities]
  );

  const plannedRequestKeys = useMemo(() => {
    return new Set(
      bookings
        .filter((booking) => booking.member_id && booking.starts_at)
        .map((booking) => `${booking.member_id}-${String(booking.starts_at).slice(0, 10)}`)
    );
  }, [bookings]);

  const requests = useMemo(
    () => actionableRequests.filter((request) => !plannedRequestKeys.has(`${request.member_id}-${request.request_date_key}`)),
    [actionableRequests, plannedRequestKeys]
  );

  const businessHours = useMemo(() => {
    return resolveBusinessHours([calendarQuery.data?.business_hours], {
      locationTimezone: calendarQuery.data?.timezone,
    });
  }, [calendarQuery.data?.business_hours, calendarQuery.data?.timezone]);

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
      calendarRows.map((row, index) => ({
        id: String(row.calendar_event_id),
        testID: `trainer-calendar-event-${index}`,
        title: row.presentation.title,
        subtitle: row.presentation.subtitle,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        badgeLabel: row.presentation.badge_label,
        badgeTone: row.presentation.badge_tone,
        draggable: false,
        onPress: () => setSelectedBookingId(String(row.calendar_event_id)),
        ...(canShowTrainerCalendarCheckin(row, calendarTimezone)
          ? {
              actionLabel: "Check-in",
              actionIcon: "checkin" as const,
              actionTestID: `trainer-calendar-checkin-${row.calendar_event_id}`,
              onAction: () =>
                router.push({
                  pathname: "/(trainer)/checkin",
                  params: row.session_id
                    ? { sessionId: String(row.session_id), backTo: "/(trainer)/calendar" }
                    : { backTo: "/(trainer)/calendar" },
                } as never),
            }
          : {}),
      })),
    [calendarRows, calendarTimezone, router]
  );

  const selectedBooking = useMemo(
    () => calendarRows.find((item) => String(item.calendar_event_id) === selectedBookingId) || null,
    [calendarRows, selectedBookingId]
  );

  useEffect(() => {
    if (!focusedBookingId || handledFocusedBookingId.current === focusedBookingId || calendarRows.length === 0) return;
    const calendarEventId = resolveTrainerFocusedBookingEventId(calendarRows, focusedBookingId);
    handledFocusedBookingId.current = focusedBookingId;
    if (calendarEventId) {
      setSelectedBookingId(calendarEventId);
    }
  }, [calendarRows, focusedBookingId]);

  const rescheduleBooking = useMemo(
    () => calendarRows.find((item) => String(item.calendar_event_id) === rescheduleBookingId) || null,
    [calendarRows, rescheduleBookingId]
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
    const rows = membersQuery.data || [];

    return new Map(
      rows.map((row) => [
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
      void calendarQuery.refetch();
    },

    onError: (error: unknown) => {
      showErrorAlert("Ders planlanamadı", error, "Seçilen saat için ders planı oluşturulamadı.");
    },
  });

  const cancelBookingMutation = useMutation({
    mutationFn: (bookingId: string) => patchTrainerBookingStatusApi(bookingId, { status: "CANCELED" }),

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
      void calendarQuery.refetch();
    },

    onError: (error: unknown) => {
      showErrorAlert("Ders kaldırılamadı", error, "Ders takvimden çıkarılamadı. Lütfen tekrar deneyin.");
    },
  });

  const noShowMutation = useMutation({
    mutationFn: (bookingId: string) => markTrainerBookingNoShowApi(bookingId),
    meta: {
      invalidates: [
        ["trainer-bookings"],
        ["trainer-today"],
        ["trainer-today-calendar"],
        ["member-bookings"],
        ["member-bookings-calendar"],
        ["member-home"],
        ["member-home-v2"],
        ["member-packages"],
        ["admin-bookings"],
        ["admin-bookings-calendar"],
        ["admin-dashboard"],
      ],
    },
    onSuccess: () => {
      setSelectedBookingId(null);
      void calendarQuery.refetch();
      showInfoAlert("Gelmedi kaydedildi", "Danışanın bir ders hakkı kullanıldı ve klinik yöneticisi bilgilendirildi.");
    },
    onError: (error: unknown) => {
      showErrorAlert("Gelmedi kaydedilemedi", error, "Katılım durumu güncellenemedi. Lütfen tekrar deneyin.");
    },
  });

  const scheduleChangeMutation = useMutation({
    mutationFn: (payload: {
      bookingId: string;
      starts_at?: string;
      ends_at?: string;
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
      setRescheduleBookingId(null);
      void calendarQuery.refetch();
      showInfoAlert(
        "Saat değişikliği gönderildi",
        "Danışanın tercih havuzundan çakışmayan alternatif otomatik seçildi. Onay sonrası takvim güncellenecek ve paket hakkı etkilenmeyecek."
      );
    },

    onError: (error: unknown) => {
      showErrorAlert("Saat değişikliği gönderilemedi", error, "Yeni saat önerisi oluşturulamadı. Lütfen tekrar deneyin.");
    },
  });

  const latestMeasurement = memberMeasurementsQuery.data?.[0] || null;
  const latestAttendance = memberAttendanceQuery.data?.[0] || null;

  const recentNotes = memberNotesQuery.data?.items.slice(0, 2) || [];

  const memberStats = memberDetailQuery.data?.stats || {};
  const packageSummary = memberDetailQuery.data?.package_summary?.[0] || null;

  const selectedGroupMembers = useMemo(
    () => buildSelectedGroupMembers(selectedBooking, groupMemberNameMap),
    [groupMemberNameMap, selectedBooking]
  );

  const rescheduleDayGroups = useMemo(() => {
    if (!rescheduleBooking?.member_id) return [];
    const slots = collectMemberAssignableSlots(String(rescheduleBooking.member_id), rawRequests)
      .filter((slot) => slotFitsBusinessHours(slot, businessHours))
      .filter((slot) => !isOutsideMinimumLeadTime(slot.starts_at, minimumAdvanceHours))
      .filter((slot) => {
        const start = new Date(slot.starts_at);
        const end = new Date(slot.ends_at || addCalendarMinutes(start, Number(businessHours?.slot_minutes || 60)).toISOString());
        return !bookings.some(
          (booking) =>
            String(booking.id) !== String(rescheduleBooking.id) &&
            trainerCalendarRangesOverlap(start, end, booking.starts_at, booking.ends_at)
        );
      });
    return groupTrainerSlotsByDay(slots);
  }, [bookings, businessHours, minimumAdvanceHours, rawRequests, rescheduleBooking?.id, rescheduleBooking?.member_id]);

  const selectedRescheduleDay = useMemo(
    () => rescheduleDayGroups.find((item) => item.dayKey === selectedRescheduleDayKey) || rescheduleDayGroups[0] || null,
    [rescheduleDayGroups, selectedRescheduleDayKey]
  );

  useEffect(() => {
    setSelectedRescheduleDayKey(rescheduleDayGroups[0]?.dayKey || null);
  }, [rescheduleBooking?.id, rescheduleDayGroups]);

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
      testID="trainer-calendar-screen"
      title="Takvimim"
      subtitle="Günün seanslarını takip et ve check-in işlemini doğru dersten başlat."
      icon="calendar"
      refreshing={calendarQuery.isRefetching || availabilityQuery.isRefetching || todayQuery.isRefetching}
      onRefresh={() => {
        void calendarQuery.refetch();
        void availabilityQuery.refetch();
        void todayQuery.refetch();
      }}
    >
      <SurfaceCard tone="primary">
        <View style={styles.flowHeader}>
          <View style={styles.flowHeaderText}>
            <Text style={styles.boardTitle}>Günlük akış</Text>
            <Text style={styles.detailText}>Bugünkü seanslar ve planlanmayı bekleyen talepler.</Text>
          </View>
          <StatusBadge label={`${requests.length} talep`} tone={requests.length > 0 ? "warning" : "neutral"} />
        </View>
        <View style={styles.flowActions}>
          <ActionButton
            testID="trainer-calendar-open-checkin"
            label="QR / kod ile check-in"
            icon="checkin"
            onPress={() => router.push({ pathname: "/(trainer)/checkin", params: { backTo: "/(trainer)/calendar" } } as never)}
          />
          <ActionButton
            testID="trainer-calendar-open-requests"
            label={`Ders talepleri (${requests.length})`}
            icon="request"
            variant="ghost"
            onPress={() => setRequestsVisible(true)}
          />
        </View>
      </SurfaceCard>

      <WeeklyScheduler
        mode="trainer"
        events={events}
        initialDate={todayAnchor}
        emptyTitle="Planlı ders bulunmuyor"
        emptyDescription="Onaylanan dersler burada görüntülenir."
        businessHours={businessHours}
        timezone={calendarQuery.data?.timezone}
        showRequestPanel={false}
        viewMode="agenda"
        onSelectedDateChange={({ key }) => {
          setSelectedDateKey(key);
        }}
      />

      <DetailSheet
        visible={requestsVisible}
        onClose={() => setRequestsVisible(false)}
        title="Ders talepleri"
        subtitle="Takvimde seçtiğin güne ait planlanmamış talepler"
        scrollEnabled={false}
      >
        {selectedDayRequests.length === 0 ? (
          <EmptyState title="Talep bulunmuyor" description="Seçili gün için bekleyen ders talebi yok." icon="request" />
        ) : (
          <VirtualListPanel
            data={selectedDayRequests}
            maxHeight={380}
            testID="trainer-calendar-request-list"
            keyExtractor={(request) => request.id}
            renderItem={(request) => (
              <RequestCard
                request={request}
                onOpen={() => {
                  setRequestsVisible(false);
                  setSelectedRequestId(request.id);
                }}
                onAdd={() => {
                  setRequestsVisible(false);
                  handleAddRequest(request);
                }}
                adding={createBookingMutation.isPending && placementRequestId === request.id}
              />
            )}
          />
        )}
      </DetailSheet>

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
              {selectedRequest.assignable_slots.map((slot) => formatTrainerDateTimeRange(slot.starts_at, slot.ends_at, calendarTimezone)).join(" • ")}
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
        title={selectedBooking?.is_group_class ? selectedBooking?.lesson_name || "Grup dersi" : selectedBooking?.is_duo ? `Duo: ${selectedBooking?.member_full_name || "Ders detayı"}` : selectedBooking?.member_full_name || "Ders detayı"}
        subtitle={selectedBooking?.presentation?.badge_label || "Ders detayı"}
      >
        <SurfaceCard tone="primary">
          <View style={styles.detailHeaderRow}>
            <View style={styles.detailHeaderText}>
              <Text style={styles.detailTitle}>Ders özeti</Text>
              <Text style={styles.detailText}>{formatTrainerDateTimeRange(selectedBooking?.starts_at, selectedBooking?.ends_at, calendarTimezone)}</Text>
            </View>

            {selectedBooking?.presentation ? (
              <StatusBadge label={selectedBooking.presentation.badge_label} tone={selectedBooking.presentation.badge_tone} />
            ) : null}
          </View>

          <View style={styles.detailGrid}>
            <DetailRow
              label="Ders türü"
              value={
                selectedBooking?.is_group_class
                  ? "Grup dersi"
                  : selectedBooking?.is_duo
                    ? "İkili ders"
                  : selectedBooking?.lesson_category_label || selectedBooking?.lesson_category || "Bireysel seans"
              }
            />
            <DetailRow label="Paket" value={selectedBooking?.package_title || selectedBooking?.package_name} />
            <DetailRow
              label="Danışan"
              value={selectedBooking?.is_group_class ? "Grup dersi katılımcıları" : selectedBooking?.member_full_name}
            />
            {selectedBooking?.is_duo ? <DetailRow label="Duo partner" value={selectedBooking?.duo_partner_name || "Partner daveti bekleniyor"} /> : null}
            {selectedBooking?.is_duo ? <DetailRow label="Duo durum" value={selectedBooking?.duo_status || "Partner ödemesi bekleniyor"} /> : null}
            <DetailRow label="Planlanan saat" value={formatTrainerDateTimeRange(selectedBooking?.starts_at, selectedBooking?.ends_at, calendarTimezone)} />
          </View>
        </SurfaceCard>

        {selectedBooking?.is_group_class ? (
          <SurfaceCard>
            <Text style={styles.detailTitle}>Grup dersi bilgileri</Text>

            <View style={styles.detailStatGrid}>
              <DetailStat label="Katılım" value={Number(selectedBooking?.joined_member_count || 0)} />
              <DetailStat label="Davet" value={Number(selectedBooking?.invited_member_count || 0)} />
              <DetailStat label="Ücret" value={formatGroupClassPrice(selectedBooking?.price)} />
            </View>

            <View style={styles.detailGrid}>
              <DetailRow label="Ders adı" value={selectedBooking?.lesson_name || selectedBooking?.session_title} />
              <DetailRow label="Bildirim kapsamı" value={getGroupClassAudienceLabel(selectedBooking?.notification_scope)} />
              <DetailRow label="Tekrar bilgisi" value={selectedBooking?.recurrence_label || "Özel tarih"} />
            </View>

           {selectedGroupMembers.length > 0 ? (
          <View style={styles.memberListBox}>
            <Text style={styles.detailLabel}>Derse katılan üyeler</Text>

    {selectedGroupMembers.map((member) => {
      const isPending = member.status === "PENDING";
      const isInvited = member.status === "INVITED";

      return (
        <View key={member.id || member.name} style={styles.groupMemberRow}>
          <Text style={styles.groupMemberName}>{member.name}</Text>

          <StatusBadge
            label={isInvited ? "Davetli" : isPending ? "Bekliyor" : "Onaylı"}
            tone={isPending || isInvited ? "warning" : "success"}
          />
        </View>
      );
     })}
      </View>
    ) : (
      <View style={styles.memberListBox}>
        <Text style={styles.detailLabel}>Derse katılan üyeler</Text>
        <Text style={styles.detailText}>Henüz kayıtlı üye görünmüyor.</Text>
      </View>
    )}
          </SurfaceCard>
        ) : (
          <SurfaceCard>
            <Text style={styles.detailTitle}>Danışan durumu</Text>

            <View style={styles.detailStatGrid}>
              <DetailStat label="Kalan hak" value={packageSummary?.remaining_credits} />
              <DetailStat label="Toplam ders" value={memberStats.booking_count} />
              <DetailStat label="Katılım" value={memberStats.checkin_count} />
            </View>

            <View style={styles.detailGrid}>
              <DetailRow label="Son katılım" value={latestAttendance?.created_at ? formatTrainerDateTime(latestAttendance.created_at) : "Kayıt yok"} />
              <DetailRow
                label="Son ölçüm"
                value={
                  latestMeasurement
                    ? `${latestMeasurement.weight_kg ?? "-"} kg • Yağ ${latestMeasurement.fat_percent ?? "-"} • Kas ${
                        latestMeasurement.muscle_kg ?? latestMeasurement.muscle_percent ?? "-"
                      }`
                    : "Kayıt yok"
                }
              />
            </View>
          </SurfaceCard>
        )}

        {selectedBooking?.pending_schedule_change ? (
          <SurfaceCard tone="warning">
            <Text style={styles.detailTitle}>Bekleyen saat değişikliği</Text>
            <Text style={styles.detailText}>
              Üyeye yeni saat önerisi gönderildi. Üye onayladığında takvim otomatik güncellenecek.
            </Text>
            <View style={styles.pendingBox}>
              <DetailRow
                label="Önerilen yeni saat"
                value={formatTrainerDateTimeRange(
                  selectedBooking.pending_schedule_change.proposed_starts_at,
                  selectedBooking.pending_schedule_change.proposed_ends_at,
                  calendarTimezone
                )}
              />
            </View>
          </SurfaceCard>
        ) : null}

        <SurfaceCard>
          <Text style={styles.detailTitle}>Eğitmen notları</Text>

          {recentNotes.length === 0 ? (
            <Text style={styles.detailText}>Bu danışan için kayıtlı not yok.</Text>
          ) : (
            <ScrollPanel maxHeight={160}>
              {recentNotes.map((note) => (
                <View key={note.id || note.created_at} style={styles.noteItem}>
                  <Text style={styles.noteTitle}>{note.title || note.category || "Not"}</Text>
                  <Text style={styles.detailText}>{note.body || note.note || "-"}</Text>
                </View>
              ))}
            </ScrollPanel>
          )}
        </SurfaceCard>

        {!selectedBooking?.is_group_class ? (
          <ActionButton
            testID="trainer-calendar-open-reschedule"
            label="Otomatik alternatif saat öner"
            icon="calendar"
            variant="ghost"
            onPress={() => {
              if (!selectedBooking?.id || !selectedBooking.member_id) return;
              Alert.alert(
                "Alternatif saat otomatik seçilecek",
                "Sistem danışanın daha önce verdiği tercihlerden, hem danışan hem eğitmen için çakışmayan ilk güvenli saati seçecek. Danışanın paket hakkı etkilenmeyecek.",
                [
                  { text: "Vazgeç", style: "cancel" },
                  {
                    text: "Öneriyi oluştur",
                    onPress: () =>
                      scheduleChangeMutation.mutate({
                        bookingId: String(selectedBooking.id),
                        member_id: String(selectedBooking.member_id),
                      }),
                  },
                ]
              );
            }}
            loading={scheduleChangeMutation.isPending}
          />
        ) : null}

        {!selectedBooking?.is_group_class ? (
          <ActionButton
            testID="trainer-calendar-cancel-booking"
            label="Takvimden kaldır"
            variant="danger"
            onPress={() => {
              if (!selectedBooking?.id) return;

              Alert.alert(
                "Dersi takvimden kaldır",
                `${selectedBooking.member_full_name || "Bu danışan"} için ${formatTrainerDateTimeRange(selectedBooking.starts_at, selectedBooking.ends_at, calendarTimezone)} seansını kaldırmak istiyor musun?`,
                [
                { text: "Vazgeç", style: "cancel" },
                {
                  text: "Kaldır",
                  style: "destructive",
                  onPress: () => {
                    cancelBookingMutation.mutate(String(selectedBooking.id));
                  },
                },
                ]
              );
            }}
            loading={cancelBookingMutation.isPending}
          />
        ) : null}

        {!selectedBooking?.is_group_class &&
        selectedBooking?.id &&
        new Date(selectedBooking.starts_at).getTime() <= Date.now() &&
        !["CANCELED", "COMPLETED"].includes(String(selectedBooking.status || "").toUpperCase()) ? (
          <ActionButton
            testID="trainer-calendar-mark-no-show"
            label="Gelmedi olarak işaretle"
            icon="risk"
            variant="danger"
            loading={noShowMutation.isPending}
            onPress={() => {
              Alert.alert(
                "Bir ders hakkı kullanılacak",
                `${selectedBooking.member_full_name || "Danışan"} gelmedi olarak işaretlenirse paketinden bir ders hakkı düşecek. Bu işlemi onaylıyor musun?`,
                [
                  { text: "Vazgeç", style: "cancel" },
                  {
                    text: "Onayla ve kaydet",
                    style: "destructive",
                    onPress: () => noShowMutation.mutate(String(selectedBooking.id)),
                  },
                ]
              );
            }}
          />
        ) : null}

        {selectedBooking?.member_id ? (
          <ActionButton
            label="Danışan detayına git"
            icon="clients"
            variant="ghost"
            onPress={() => {
              setSelectedBookingId(null);
              router.push({
                pathname: "/(trainer)/members/[id]",
                params: { id: selectedBooking.member_id, backTo: "/(trainer)/calendar" },
              } as never);
            }}
          />
        ) : null}
      </DetailSheet>

      <DetailSheet
        visible={Boolean(rescheduleBooking)}
        onClose={() => setRescheduleBookingId(null)}
        title="Saat değişikliği öner"
        subtitle={rescheduleBooking?.member_full_name || "Ders planı"}
      >
        <SurfaceCard tone="primary">
          <Text style={styles.detailTitle}>Mevcut seans</Text>
          <Text style={styles.detailText}>{formatTrainerDateTimeRange(rescheduleBooking?.starts_at, rescheduleBooking?.ends_at, calendarTimezone)}</Text>
        </SurfaceCard>

        {rescheduleDayGroups.length === 0 ? (
          <EmptyState
            title="Alternatif saat bulunmuyor"
            description="Danışanın paylaştığı uygun saatler bu ders için kullanılabilir değil."
            icon="calendar"
          />
        ) : (
          <>
            <View style={styles.rescheduleCalendar}>
              {rescheduleDayGroups.map((group) => {
                const active = group.dayKey === selectedRescheduleDay?.dayKey;
                const dayDate = new Date(`${group.dayKey}T00:00:00`);
                return (
                  <Pressable
                    key={group.dayKey}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
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
                  testID={`trainer-calendar-reschedule-${slot.key}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Yeni saat ${formatTrainerDateTimeRange(slot.startsAt, slot.endsAt, calendarTimezone)}`}
                  style={styles.slotOption}
                  onPress={() => {
                    if (!rescheduleBooking?.id || !rescheduleBooking?.member_id) return;
                    Alert.alert(
                      "Yeni saati doğrula",
                      `${formatTrainerDateTimeRange(rescheduleBooking.starts_at, rescheduleBooking.ends_at, calendarTimezone)} yerine ${formatTrainerDateTimeRange(slot.startsAt, slot.endsAt, calendarTimezone)} önerilecek.`,
                      [
                        { text: "Vazgeç", style: "cancel" },
                        {
                          text: "Öneriyi gönder",
                          onPress: () => scheduleChangeMutation.mutate({
                            bookingId: String(rescheduleBooking.id),
                            starts_at: slot.startsAt,
                            ends_at: slot.endsAt,
                            member_id: String(rescheduleBooking.member_id),
                          }),
                        },
                      ]
                    );
                  }}
                >
                  <Text style={styles.slotOptionText}>{slot.label}</Text>
                </Pressable>
              ))}
            </ScrollPanel>
          </>
        )}
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
  flowHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  flowHeaderText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  flowActions: {
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
  detailHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  detailHeaderText: {
    flex: 1,
    gap: 4,
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
  detailGrid: {
    marginTop: tokens.spacing.sm,
    gap: tokens.spacing.xs,
  },
  detailRow: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSoft,
    padding: tokens.spacing.sm,
    gap: 4,
  },
  detailLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  detailValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: 20,
    fontFamily: tokens.fontFamily.semibold,
  },
  detailStatGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  detailStatBox: {
    flexGrow: 1,
    minWidth: 92,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSoft,
    padding: tokens.spacing.sm,
    gap: 4,
  },
  detailStatValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
  },
  detailStatLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  memberListBox: {
    marginTop: tokens.spacing.sm,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSoft,
    padding: tokens.spacing.sm,
    gap: 4,
  },
  pendingBox: {
    marginTop: tokens.spacing.sm,
  },
  noteItem: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSoft,
    padding: tokens.spacing.sm,
    gap: 4,
    marginBottom: tokens.spacing.xs,
  },
  noteTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
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
  groupMemberRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: tokens.spacing.sm,
  paddingVertical: tokens.spacing.xs,
  },
  groupMemberName: {
    flex: 1,
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  });
