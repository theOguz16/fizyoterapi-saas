// Bu sayfa mobil uygulamada member akisindaki calendar ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { resolveBusinessHours } from "@/lib/scheduling/business-hours.normalize";
import { getMemberAvailabilityApi, getMemberBookingsApi, getMemberHomeApi } from "@/lib/mobile-api";
import { useSession } from "@/providers/auth-session";
import { formatStatusLabel, getStatusTone } from "@/theme/components/calendar-agenda";
import { ActionButton } from "@/theme/components/action-button";
import { AppShell } from "@/theme/components/app-shell";
import { DetailSheet } from "@/theme/components/detail-sheet";
import { StatusBadge } from "@/theme/components/status-badge";
import { SurfaceCard } from "@/theme/components/surface-card";
import { WeeklyScheduler } from "@/theme/components/weekly-scheduler";
import { tokens } from "@/theme/tokens";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const PROJECTED_WEEKS_AHEAD = 26;

type MemberCalendarEvent = {
  id: string;
  source: "booking" | "approved-availability" | "pending-availability";
  title: string;
  subtitle: string;
  startsAt: string;
  endsAt?: string | null;
  badgeLabel?: string;
  badgeTone?: "success" | "warning" | "danger" | "info" | "neutral";
  bookingId?: string;
  raw?: any;
  onPress?: () => void;
};

function startOfIsoWeek(date: Date) {
  const dt = new Date(date);
  const day = dt.getDay() || 7;
  dt.setDate(dt.getDate() - day + 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

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

function formatEmpty(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function projectRecurringAvailabilityRows(rows: any[], from: Date, weeksAhead: number) {
  const to = new Date(from.getTime() + weeksAhead * WEEK_MS);
  const projected: any[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const templateStart = new Date(row?.starts_at);
    const templateEnd = new Date(row?.ends_at);

    if (Number.isNaN(templateStart.getTime()) || Number.isNaN(templateEnd.getTime()) || templateEnd <= templateStart) {
      continue;
    }

    let offset = 0;

    if (templateEnd <= from) {
      offset = Math.floor((from.getTime() - templateStart.getTime()) / WEEK_MS);
    }

    let occurrenceStart = new Date(templateStart.getTime() + offset * WEEK_MS);
    let occurrenceEnd = new Date(templateEnd.getTime() + offset * WEEK_MS);

    while (occurrenceEnd <= from) {
      occurrenceStart = new Date(occurrenceStart.getTime() + WEEK_MS);
      occurrenceEnd = new Date(occurrenceEnd.getTime() + WEEK_MS);
    }

    while (occurrenceStart < to) {
      const key = `${String(row?.package_title || "")}|${occurrenceStart.toISOString()}|${occurrenceEnd.toISOString()}`;

      if (!seen.has(key)) {
        seen.add(key);
        projected.push({
          ...row,
          starts_at: occurrenceStart.toISOString(),
          ends_at: occurrenceEnd.toISOString(),
        });
      }

      occurrenceStart = new Date(occurrenceStart.getTime() + WEEK_MS);
      occurrenceEnd = new Date(occurrenceEnd.getTime() + WEEK_MS);
    }
  }

  return projected.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
}

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{formatEmpty(value)}</Text>
    </View>
  );
}

export default function MemberCalendarScreen() {
  const router = useRouter();
  const { pendingPaymentRequest } = useSession();

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const todayAnchor = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return today.toISOString();
  }, []);

  const bookingsQuery = useQuery({
    queryKey: ["member-bookings-calendar"],
    queryFn: getMemberBookingsApi,
  });

  const availabilityQuery = useQuery({
    queryKey: ["member-availability-calendar"],
    queryFn: getMemberAvailabilityApi,
  });

  const homeQuery = useQuery({
    queryKey: ["member-home-calendar"],
    queryFn: getMemberHomeApi,
  });

  const bookings = useMemo(() => {
    const base = Array.isArray(bookingsQuery.data)
      ? bookingsQuery.data
      : Array.isArray((bookingsQuery.data as any)?.items)
        ? (bookingsQuery.data as any).items
        : [];

    return base.filter((booking: any) => !["CANCELED", "CANCELLED"].includes(String(booking?.status || "").toUpperCase()));
  }, [bookingsQuery.data]);

  const bookingEvents = useMemo<MemberCalendarEvent[]>(
    () =>
      bookings.map((booking: any) => ({
        id: `booking-${String(booking.id)}`,
        source: "booking",
        bookingId: String(booking.id),
        raw: booking,
        title: booking.session_title || booking.lesson_category_label || "Ders",
        subtitle: `${booking.trainer_full_name || "Eğitmen"} • ${booking.package_title || booking.package_name || "Planlı seans"}`,
        startsAt: booking.starts_at,
        endsAt: booking.ends_at,
        badgeLabel: booking.pending_schedule_change ? "Saat Onayı Bekliyor" : formatStatusLabel(booking.status),
        badgeTone: booking.pending_schedule_change ? "warning" : getStatusTone(booking.status),
        onPress: () => setSelectedEventId(`booking-${String(booking.id)}`),
      })),
    [bookings]
  );

  const approvedAvailabilityEvents = useMemo<MemberCalendarEvent[]>(() => {
    const rows = Array.isArray(availabilityQuery.data) ? availabilityQuery.data : [];
    const projectedRows = projectRecurringAvailabilityRows(rows, startOfIsoWeek(new Date()), PROJECTED_WEEKS_AHEAD);

    const bookingKeys = new Set(bookings.map((booking: any) => `${String(booking.starts_at || "")}|${String(booking.ends_at || "")}`));

    return projectedRows
      .filter((row: any) => row?.starts_at)
      .filter((row: any) => !bookingKeys.has(`${String(row.starts_at || "")}|${String(row.ends_at || "")}`))
      .map((row: any, index: number) => ({
        id: `approved-availability-${index}-${String(row.starts_at)}`,
        source: "approved-availability",
        raw: row,
        title: row.package_title || "Onaylı saat tercihin",
        subtitle: "Admin onayı sonrası kaydedilen uygunluk",
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        badgeLabel: "Onaylandı",
        badgeTone: "info" as const,
        onPress: () => setSelectedEventId(`approved-availability-${index}-${String(row.starts_at)}`),
      }));
  }, [availabilityQuery.data, bookings]);

  const pendingAvailabilityEvents = useMemo<MemberCalendarEvent[]>(() => {
    const rows = Array.isArray(pendingPaymentRequest?.selected_days) ? pendingPaymentRequest.selected_days : [];

    const bookingKeys = new Set(bookings.map((booking: any) => `${String(booking.starts_at || "")}|${String(booking.ends_at || "")}`));

    return rows
      .filter((row: any) => row?.starts_at)
      .filter((row: any) => !bookingKeys.has(`${String(row.starts_at || "")}|${String(row.ends_at || "")}`))
      .map((row: any, index: number) => ({
        id: `pending-availability-${index}-${String(row.starts_at)}`,
        source: "pending-availability",
        raw: row,
        title: row.label || "Saat tercihin",
        subtitle: "Salon onayı bekleniyor",
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        badgeLabel: "Onay bekliyor",
        badgeTone: "warning" as const,
        onPress: () => setSelectedEventId(`pending-availability-${index}-${String(row.starts_at)}`),
      }));
  }, [bookings, pendingPaymentRequest?.selected_days]);

  const schedulerEvents = useMemo(
    () => [...pendingAvailabilityEvents, ...approvedAvailabilityEvents, ...bookingEvents],
    [approvedAvailabilityEvents, bookingEvents, pendingAvailabilityEvents]
  );

  const selectedEvent = useMemo(
    () => schedulerEvents.find((event) => event.id === selectedEventId) || null,
    [schedulerEvents, selectedEventId]
  );

  const selectedBooking = selectedEvent?.source === "booking" ? selectedEvent.raw : null;

  const businessHours = useMemo(
    () =>
      resolveBusinessHours([homeQuery.data?.calendar?.business_hours], {
        locationTimezone: homeQuery.data?.calendar?.timezone,
      }),
    [homeQuery.data?.calendar?.business_hours, homeQuery.data?.calendar?.timezone]
  );

  return (
    <AppShell
      title="Takvim"
      subtitle="Ders programını, onaylı saatlerini ve bekleyen taleplerini takip et."
      icon="calendar"
      refreshing={bookingsQuery.isRefetching || availabilityQuery.isRefetching || homeQuery.isRefetching}
      onRefresh={() => {
        void bookingsQuery.refetch();
        void availabilityQuery.refetch();
        void homeQuery.refetch();
      }}
    >
      <WeeklyScheduler
        mode="member"
        events={schedulerEvents}
        initialDate={todayAnchor}
        emptyTitle="Planlı ders bulunmuyor"
        emptyDescription="Programlanan dersler ve admin onayı sonrası kaydedilen saatlerin burada listelenir."
        businessHours={businessHours}
        hideEmptyState
      />

      <DetailSheet
        visible={Boolean(selectedEvent)}
        onClose={() => setSelectedEventId(null)}
        title={selectedEvent?.title || "Takvim detayı"}
        subtitle={selectedEvent?.badgeLabel || "Ders ve saat bilgisi"}
      >
        <SurfaceCard tone={selectedEvent?.source === "pending-availability" ? "warning" : "primary"}>
          <View style={styles.detailHeaderRow}>
            <View style={styles.detailHeaderText}>
              <Text style={styles.detailTitle}>
                {selectedEvent?.source === "booking"
                  ? "Ders özeti"
                  : selectedEvent?.source === "approved-availability"
                    ? "Onaylı saat tercihi"
                    : "Onay bekleyen saat tercihi"}
              </Text>
              <Text style={styles.detailText}>{formatDateTimeRange(selectedEvent?.startsAt, selectedEvent?.endsAt)}</Text>
            </View>

            {selectedEvent?.badgeLabel ? <StatusBadge label={selectedEvent.badgeLabel} tone={selectedEvent.badgeTone || "neutral"} /> : null}
          </View>

          <View style={styles.detailGrid}>
            <DetailRow label="Durum" value={selectedEvent?.badgeLabel} />
            <DetailRow label="Saat" value={formatDateTimeRange(selectedEvent?.startsAt, selectedEvent?.endsAt)} />
            <DetailRow label="Açıklama" value={selectedEvent?.subtitle} />
          </View>
        </SurfaceCard>

        {selectedEvent?.source === "booking" ? (
          <>
            <SurfaceCard>
              <Text style={styles.detailTitle}>Ders bilgileri</Text>

              <View style={styles.detailGrid}>
                <DetailRow label="Ders" value={selectedBooking?.session_title || selectedBooking?.lesson_category_label || "Ders"} />
                <DetailRow label="Eğitmen" value={selectedBooking?.trainer_full_name || "Eğitmen"} />
                <DetailRow label="Paket" value={selectedBooking?.package_title || selectedBooking?.package_name || "Planlı seans"} />
                <DetailRow
                  label="Durum"
                  value={selectedBooking?.pending_schedule_change ? "Saat onayı bekliyor" : formatStatusLabel(selectedBooking?.status)}
                />
              </View>
            </SurfaceCard>

            {selectedBooking?.pending_schedule_change ? (
              <SurfaceCard tone="warning">
                <Text style={styles.detailTitle}>Bekleyen saat değişikliği</Text>
                <Text style={styles.detailText}>
                  Bu ders için yeni saat önerisi var. Onay süreci tamamlandığında takvim güncellenecek.
                </Text>

                <View style={styles.pendingBox}>
                  <DetailRow
                    label="Önerilen yeni saat"
                    value={formatDateTimeRange(
                      selectedBooking.pending_schedule_change.proposed_starts_at,
                      selectedBooking.pending_schedule_change.proposed_ends_at
                    )}
                  />
                </View>
              </SurfaceCard>
            ) : null}

            <ActionButton
              label="Ders detayına git"
              icon="calendar"
              onPress={() => {
                if (!selectedEvent?.bookingId) return;

                setSelectedEventId(null);
                router.push(`/(member)/booking/${selectedEvent.bookingId}` as never);
              }}
            />
          </>
        ) : (
          <SurfaceCard>
            <Text style={styles.detailTitle}>Saat tercihi bilgisi</Text>

            <View style={styles.detailGrid}>
              <DetailRow label="Paket" value={selectedEvent?.raw?.package_title || selectedEvent?.raw?.package_name || selectedEvent?.title} />
              <DetailRow
                label="Onay durumu"
                value={selectedEvent?.source === "approved-availability" ? "Salon tarafından onaylandı" : "Salon onayı bekleniyor"}
              />
              <DetailRow
                label="Not"
                value={
                  selectedEvent?.source === "approved-availability"
                    ? "Bu saat tercihin salon tarafından kaydedildi. Ders planlaması yapılınca takvimde ders olarak görünecek."
                    : "Bu saat tercihin henüz salon tarafından onaylanmadı."
                }
              />
            </View>
          </SurfaceCard>
        )}
      </DetailSheet>
    </AppShell>
  );
}

const styles = StyleSheet.create({
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
  pendingBox: {
    marginTop: tokens.spacing.sm,
  },
});