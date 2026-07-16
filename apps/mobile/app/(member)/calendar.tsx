// Bu sayfa mobil uygulamada member akisindaki calendar ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { resolveBusinessHours } from "@/lib/scheduling/business-hours.normalize";
import { getCalendarFeedApi } from "@/lib/mobile-api";
import { calendarFeedEventToDetailRow, createCalendarFeedRange, type CalendarDetailRow } from "@/lib/calendar-feed";
import { ActionButton } from "@/theme/components/action-button";
import { AppShell } from "@/theme/components/app-shell";
import { DetailSheet } from "@/theme/components/detail-sheet";
import { StatusBadge } from "@/theme/components/status-badge";
import { SurfaceCard } from "@/theme/components/surface-card";
import { WeeklyScheduler } from "@/theme/components/weekly-scheduler";
import { tokens } from "@/theme/tokens";

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
  raw?: CalendarDetailRow;
  onPress?: () => void;
};

function formatDateTimeRange(startsAt?: string | null, endsAt?: string | null, timezone = "Europe/Istanbul") {
  if (!startsAt) return "-";

  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : null;

  const day = start.toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: timezone,
  });

  const startTime = start.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });

  const endTime = end
    ? end.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
      })
    : "--:--";

  return `${day} • ${startTime} - ${endTime}`;
}

function formatEmpty(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
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
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const calendarRange = useMemo(() => createCalendarFeedRange(), []);

  const todayAnchor = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return today.toISOString();
  }, []);

  const calendarQuery = useQuery({
    queryKey: ["member-bookings-calendar", "feed", calendarRange.from, calendarRange.to],
    queryFn: () => getCalendarFeedApi(calendarRange),
  });

  const schedulerEvents = useMemo<MemberCalendarEvent[]>(() => {
    const events = calendarQuery.data?.events || [];
    return events.map((event) => {
      const raw = calendarFeedEventToDetailRow(event);
      const source = event.source === "BOOKING"
        ? "booking"
        : event.source === "AVAILABILITY"
          ? "approved-availability"
          : "pending-availability";
      return {
        id: event.id,
        source,
        bookingId: event.details.booking_id || undefined,
        raw,
        title: event.presentation.title,
        subtitle: event.presentation.subtitle,
        startsAt: event.starts_at,
        endsAt: event.ends_at,
        badgeLabel: event.presentation.badge_label,
        badgeTone: event.presentation.badge_tone,
        onPress: () => setSelectedEventId(event.id),
      };
    });
  }, [calendarQuery.data?.events]);

  const selectedEvent = useMemo(
    () => schedulerEvents.find((event) => event.id === selectedEventId) || null,
    [schedulerEvents, selectedEventId]
  );

  const selectedBooking = selectedEvent?.source === "booking" ? selectedEvent.raw : null;

  const businessHours = useMemo(
    () =>
      resolveBusinessHours([calendarQuery.data?.business_hours], {
        locationTimezone: calendarQuery.data?.timezone,
      }),
    [calendarQuery.data?.business_hours, calendarQuery.data?.timezone]
  );

  return (
    <AppShell
      testID="member-calendar-screen"
      title="Takvim"
      subtitle="Ders programını, onaylı saatlerini ve bekleyen taleplerini takip et."
      icon="calendar"
      refreshing={calendarQuery.isRefetching}
      onRefresh={() => {
        void calendarQuery.refetch();
      }}
    >
      <WeeklyScheduler
        mode="member"
        events={schedulerEvents}
        initialDate={todayAnchor}
        emptyTitle="Planlı ders bulunmuyor"
        emptyDescription="Programlanan dersler ve admin onayı sonrası kaydedilen saatlerin burada listelenir."
        businessHours={businessHours}
        timezone={calendarQuery.data?.timezone}
        viewMode="agenda"
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
              <Text style={styles.detailText}>{formatDateTimeRange(selectedEvent?.startsAt, selectedEvent?.endsAt, calendarQuery.data?.timezone)}</Text>
            </View>

            {selectedEvent?.badgeLabel ? <StatusBadge label={selectedEvent.badgeLabel} tone={selectedEvent.badgeTone || "neutral"} /> : null}
          </View>

          <View style={styles.detailGrid}>
            <DetailRow label="Durum" value={selectedEvent?.badgeLabel} />
            <DetailRow label="Saat" value={formatDateTimeRange(selectedEvent?.startsAt, selectedEvent?.endsAt, calendarQuery.data?.timezone)} />
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
                {selectedBooking?.is_duo ? <DetailRow label="Duo partner" value={selectedBooking?.duo_partner_name || "Partner daveti bekleniyor"} /> : null}
                {selectedBooking?.is_duo ? <DetailRow label="Duo durum" value={selectedBooking?.duo_status || "Partner ödemesi bekleniyor"} /> : null}
                <DetailRow
                  label="Durum"
                  value={selectedEvent?.badgeLabel}
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
                      selectedBooking.pending_schedule_change.proposed_ends_at,
                      calendarQuery.data?.timezone
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
                router.push({
                  pathname: "/(member)/booking/[id]",
                  params: { id: selectedEvent.bookingId, backTo: "/(member)/calendar" },
                } as never);
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
