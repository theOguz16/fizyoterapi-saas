// Bu sayfa mobil uygulamada admin akisindaki calendar ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { resolveBusinessHours } from "@/lib/business-hours";
import { formatGroupClassPrice, getGroupClassAudienceLabel } from "@/lib/group-classes";
import { getAdminBookingsApi, getAdminSessionsApi, getAdminSettingsApi } from "@/lib/mobile-api";
import { formatStatusLabel, getStatusTone } from "@/theme/components/calendar-agenda";
import { AppShell } from "@/theme/components/app-shell";
import { DetailSheet } from "@/theme/components/detail-sheet";
import { SurfaceCard } from "@/theme/components/surface-card";
import { WeeklyScheduler } from "@/theme/components/weekly-scheduler";
import { tokens } from "@/theme/tokens";

function formatDateTimeRange(startsAt?: string, endsAt?: string) {
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

export default function AdminCalendarScreen() {
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const todayAnchor = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return today.toISOString();
  }, []);
  const bookingsQuery = useQuery({
    queryKey: ["admin-bookings-calendar"],
    queryFn: () => getAdminBookingsApi(),
  });
  const sessionsQuery = useQuery({
    queryKey: ["admin-sessions-calendar"],
    queryFn: () => getAdminSessionsApi({ status: "SCHEDULED" }),
  });
  const settingsQuery = useQuery({
    queryKey: ["admin-settings-calendar"],
    queryFn: getAdminSettingsApi,
  });

  const rows = useMemo(() => {
    const base = Array.isArray(bookingsQuery.data) ? bookingsQuery.data : [];
    const sessionRows = Array.isArray(sessionsQuery.data) ? sessionsQuery.data.filter((row: any) => row.is_group_class) : [];
    return [...sessionRows, ...base]
      .filter((row: any, index: number, all: any[]) => {
        const key = String(row.is_group_class ? row.group_class_id || row.id : row.id);
        return all.findIndex((item) => String(item.is_group_class ? item.group_class_id || item.id : item.id) === key) === index;
      })
      .filter((row: any) => !["CANCELED", "CANCELLED"].includes(String(row?.status || "").toUpperCase()));
  }, [bookingsQuery.data, sessionsQuery.data]);
  const selectedBooking = useMemo(() => rows.find((row: any) => String(row.id) === selectedBookingId) || null, [rows, selectedBookingId]);

  const events = useMemo(
    () =>
      rows.map((row: any) => ({
        id: String(row.id),
        title: row.is_group_class ? row.lesson_name || row.session_title || "Grup dersi" : row.member_full_name || "Üye",
        subtitle: row.is_group_class
          ? `${row.trainer_full_name || "Eğitmen"} • ${row.recurrence_label || "Özel tarih"}`
          : `${row.trainer_full_name || "Eğitmen"} • ${row.lesson_category_label || row.package_title || "Ders"}`,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        badgeLabel: row.pending_schedule_change ? "Üye Onayı Bekliyor" : formatStatusLabel(row.status) || undefined,
        badgeTone: row.pending_schedule_change ? "warning" : getStatusTone(row.status),
        onPress: () => setSelectedBookingId(String(row.id)),
      })),
    [rows]
  );

  const businessHours = useMemo(
    () => {
      const profile = settingsQuery.data?.profile || settingsQuery.data || {};
      return resolveBusinessHours(profile.location?.business_hours, profile.business_hours);
    },
    [settingsQuery.data]
  );

  return (
    <AppShell
      title="Salon Takvimi"
      subtitle="Ders akışını takip edin."
      icon="calendar"
      refreshing={bookingsQuery.isRefetching || sessionsQuery.isRefetching || settingsQuery.isRefetching}
      onRefresh={() => {
        void bookingsQuery.refetch();
        void sessionsQuery.refetch();
        void settingsQuery.refetch();
      }}
    >
      <WeeklyScheduler
        mode="admin"
        events={events}
        initialDate={todayAnchor}
        emptyTitle="Planlı ders bulunmuyor"
        emptyDescription="Salon programı burada görüntülenir."
        businessHours={businessHours}
        hideEmptyState
      />

      <DetailSheet
        visible={Boolean(selectedBooking)}
        onClose={() => setSelectedBookingId(null)}
        title={selectedBooking?.is_group_class ? selectedBooking?.lesson_name || selectedBooking?.session_title || "Grup dersi detayı" : selectedBooking?.member_full_name || "Rezervasyon detayı"}
        subtitle={selectedBooking?.is_group_class ? selectedBooking?.trainer_full_name || selectedBooking?.package_title || "Salon takvimi" : selectedBooking?.trainer_full_name || "Ders detayı"}
      >
        <SurfaceCard tone="primary">
          <Text style={styles.detailTitle}>{formatDateTimeRange(selectedBooking?.starts_at, selectedBooking?.ends_at)}</Text>
          <Text style={styles.detailText}>Üye: {selectedBooking?.member_full_name || (selectedBooking?.is_group_class ? "Salon geneli / grup katılımcıları" : "-")}</Text>
          <Text style={styles.detailText}>Eğitmen: {selectedBooking?.trainer_full_name || "-"}</Text>
          <Text style={styles.detailText}>Ders: {selectedBooking?.lesson_category_label || selectedBooking?.package_title || "-"}</Text>
          {selectedBooking?.is_group_class ? <Text style={styles.detailText}>Grup dersi: {selectedBooking?.lesson_name || selectedBooking?.session_title || "-"}</Text> : null}
          {selectedBooking?.is_group_class ? <Text style={styles.detailText}>Bildirim: {getGroupClassAudienceLabel(selectedBooking?.notification_scope)}</Text> : null}
          {selectedBooking?.is_group_class ? <Text style={styles.detailText}>Ücret: {formatGroupClassPrice(selectedBooking?.price)}</Text> : null}
          {selectedBooking?.is_group_class ? <Text style={styles.detailText}>Katılım: {selectedBooking?.joined_member_count || 0}/{selectedBooking?.capacity || "-"}</Text> : null}
          {selectedBooking?.is_group_class ? <Text style={styles.detailText}>Onaylı: {selectedBooking?.approved_member_count || 0}</Text> : null}
          {selectedBooking?.is_group_class ? <Text style={styles.detailText}>Tahsilat planı: {formatGroupClassPrice(selectedBooking?.planned_total_revenue)}</Text> : null}
          {selectedBooking?.is_group_class ? <Text style={styles.detailText}>Eğitmen payı: {formatGroupClassPrice(selectedBooking?.trainer_planned_earning)}</Text> : null}
          <Text style={styles.detailText}>Durum: {selectedBooking?.pending_schedule_change ? "Üye onayı bekleniyor" : formatStatusLabel(selectedBooking?.status)}</Text>
          <Text style={styles.detailText}>Paket: {selectedBooking?.package_title || "-"}</Text>
          {selectedBooking?.pending_schedule_change ? (
            <Text style={styles.detailText}>
              Önerilen yeni saat: {formatDateTimeRange(selectedBooking.pending_schedule_change.proposed_starts_at, selectedBooking.pending_schedule_change.proposed_ends_at)}
            </Text>
          ) : null}
        </SurfaceCard>
      </DetailSheet>
    </AppShell>
  );
}

const styles = StyleSheet.create({
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
});
