// Bu sayfa mobil uygulamada admin akisindaki calendar ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { formatGroupClassPrice, getGroupClassAudienceLabel } from "@/lib/group-classes";
import { getCalendarFeedApi } from "@/lib/mobile-api";
import { calendarFeedEventToDetailRow, createCalendarFeedRange } from "@/lib/calendar-feed";
import { resolveBusinessHours } from "@/lib/scheduling/business-hours.normalize";
import { AppShell } from "@/theme/components/app-shell";
import { DetailSheet } from "@/theme/components/detail-sheet";
import { StatusBadge } from "@/theme/components/status-badge";
import { SurfaceCard } from "@/theme/components/surface-card";
import { WeeklyScheduler } from "@/theme/components/weekly-scheduler";
import { EmptyState } from "@/theme/components/empty-state";
import { tokens } from "@/theme/tokens";
import { resolveCalendarEmptyState } from "@/lib/admin-empty-states";

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

function DetailStat({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <View style={styles.detailStatBox}>
      <Text style={styles.detailStatValue}>{formatEmpty(value)}</Text>
      <Text style={styles.detailStatLabel}>{label}</Text>
    </View>
  );
}

export default function AdminCalendarScreen() {
  const router = useRouter();
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const calendarRange = useMemo(() => createCalendarFeedRange(), []);

  const todayAnchor = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return today.toISOString();
  }, []);

  const calendarQuery = useQuery({
    queryKey: ["admin-bookings-calendar", "feed", calendarRange.from, calendarRange.to],
    queryFn: () => getCalendarFeedApi(calendarRange),
  });

  const rows = useMemo(() => {
    const events = calendarQuery.data?.events || [];
    return events.map(calendarFeedEventToDetailRow);
  }, [calendarQuery.data?.events]);

  const selectedBooking = useMemo(
    () => rows.find((row) => String(row.calendar_event_id) === selectedBookingId) || null,
    [rows, selectedBookingId]
  );

  const events = useMemo(
    () =>
      rows.map((row, index) => ({
        id: String(row.calendar_event_id),
        testID: `admin-calendar-event-${index}`,
        title: row.presentation.title,
        subtitle: row.presentation.subtitle,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        badgeLabel: row.presentation.badge_label,
        badgeTone: row.presentation.badge_tone,
        onPress: () => setSelectedBookingId(String(row.calendar_event_id)),
      })),
    [rows]
  );

  const businessHours = useMemo(() => {
    return resolveBusinessHours([calendarQuery.data?.business_hours], {
      locationTimezone: calendarQuery.data?.timezone,
    });
  }, [calendarQuery.data?.business_hours, calendarQuery.data?.timezone]);
  const calendarEmptyState = resolveCalendarEmptyState(businessHours.is_configured);

  return (
    <AppShell
      testID="admin-calendar-screen"
      title="Salon Takvimi"
      subtitle="Ders akışını, eğitmen programını ve grup derslerini takip edin."
      icon="calendar"
      refreshing={calendarQuery.isRefetching}
      onRefresh={() => {
        void calendarQuery.refetch();
      }}
    >
      <WeeklyScheduler
        mode="admin"
        events={events}
        initialDate={todayAnchor}
        emptyTitle="Planlı ders bulunmuyor"
        emptyDescription="Salon programı burada görüntülenir."
        businessHours={businessHours}
        timezone={calendarQuery.data?.timezone}
        viewMode="agenda"
        hideEmptyState={events.length === 0}
      />

      {!calendarQuery.isLoading &&
      !calendarQuery.isError &&
      events.length === 0 ? (
        <EmptyState
          title={calendarEmptyState.title}
          description={calendarEmptyState.description}
          icon={calendarEmptyState.icon}
          actionLabel={calendarEmptyState.actionLabel}
          actionIcon={calendarEmptyState.actionIcon}
          actionTestID={businessHours.is_configured ? "admin-calendar-empty-open-qr" : "admin-calendar-empty-working-hours"}
          onAction={() =>
            router.push({
              pathname: calendarEmptyState.route,
              params: { backTo: "/(admin)/calendar" },
            } as never)
          }
        />
      ) : null}

      <DetailSheet
        visible={Boolean(selectedBooking)}
        onClose={() => setSelectedBookingId(null)}
        title={
          selectedBooking?.is_group_class
            ? selectedBooking?.lesson_name || selectedBooking?.session_title || "Grup dersi detayı"
            : selectedBooking?.member_full_name || "Rezervasyon detayı"
        }
        subtitle={
          selectedBooking?.pending_schedule_change
            ? "Üye onayı bekleniyor"
            : selectedBooking?.is_group_class
              ? selectedBooking?.trainer_full_name || "Grup dersi"
              : selectedBooking?.trainer_full_name || "Ders detayı"
        }
      >
        <SurfaceCard tone="primary">
          <View style={styles.detailHeaderRow}>
            <View style={styles.detailHeaderText}>
              <Text style={styles.detailTitle}>Ders özeti</Text>
              <Text style={styles.detailText}>{formatDateTimeRange(selectedBooking?.starts_at, selectedBooking?.ends_at, calendarQuery.data?.timezone)}</Text>
            </View>

            {selectedBooking?.pending_schedule_change ? (
              <StatusBadge label="Üye Onayı Bekliyor" tone="warning" />
            ) : selectedBooking?.presentation ? (
              <StatusBadge label={selectedBooking.presentation.badge_label} tone={selectedBooking.presentation.badge_tone} />
            ) : null}
          </View>

          <View style={styles.detailGrid}>
            <DetailRow
              label="Ders tipi"
              value={selectedBooking?.is_group_class ? "Grup dersi" : selectedBooking?.lesson_category_label || "Bireysel ders"}
            />
            <DetailRow label="Ders adı" value={selectedBooking?.lesson_name || selectedBooking?.session_title || selectedBooking?.lesson_category_label} />
            <DetailRow label="Paket" value={selectedBooking?.package_title || selectedBooking?.package_name} />
            <DetailRow label="Durum" value={selectedBooking?.presentation?.badge_label} />
          </View>
        </SurfaceCard>

        <SurfaceCard>
          <Text style={styles.detailTitle}>Kişiler</Text>

          <View style={styles.detailGrid}>
            <DetailRow
              label="Üye"
              value={selectedBooking?.member_full_name || (selectedBooking?.is_group_class ? "Salon geneli / grup katılımcıları" : "-")}
            />
            <DetailRow label="Eğitmen" value={selectedBooking?.trainer_full_name} />
          </View>
        </SurfaceCard>

        {selectedBooking?.is_group_class ? (
          <SurfaceCard>
            <Text style={styles.detailTitle}>Grup dersi bilgileri</Text>

            <View style={styles.detailStatGrid}>
              <DetailStat label="Katılım" value={`${Number(selectedBooking?.joined_member_count || 0)}/${selectedBooking?.capacity || "-"}`} />
              <DetailStat label="Onaylı" value={Number(selectedBooking?.approved_member_count || 0)} />
              <DetailStat label="Ücret" value={formatGroupClassPrice(selectedBooking?.price)} />
            </View>

            <View style={styles.detailGrid}>
              <DetailRow label="Bildirim kapsamı" value={getGroupClassAudienceLabel(selectedBooking?.notification_scope)} />
              <DetailRow label="Tekrar bilgisi" value={selectedBooking?.recurrence_label || "Özel tarih"} />
              <DetailRow label="Tahsilat planı" value={formatGroupClassPrice(selectedBooking?.planned_total_revenue)} />
              <DetailRow label="Eğitmen payı" value={formatGroupClassPrice(selectedBooking?.trainer_planned_earning)} />
            </View>
          </SurfaceCard>
        ) : null}

        {selectedBooking?.pending_schedule_change ? (
          <SurfaceCard tone="warning">
            <Text style={styles.detailTitle}>Bekleyen saat değişikliği</Text>
            <Text style={styles.detailText}>
              Bu ders için üyeye yeni saat önerisi gönderilmiş. Üye onayladığında takvim güncellenecek.
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
  pendingBox: {
    marginTop: tokens.spacing.sm,
  },
});
