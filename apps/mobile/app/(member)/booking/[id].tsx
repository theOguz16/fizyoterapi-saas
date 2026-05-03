// Bu sayfa mobil uygulamada member akisindaki detay ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { cancelMemberBookingApi, getMemberBookingByIdApi } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { StatusBadge } from "@/theme/components/status-badge";
import { tokens } from "@/theme/tokens";
import { bookingStatusLabel, statusLabel } from "@/lib/labels";

export default function MemberBookingDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const query = useQuery({
    queryKey: ["member-booking", params.id],
    queryFn: () => getMemberBookingByIdApi(String(params.id)),
  });
  const mutation = useMutation({
  mutationFn: () => cancelMemberBookingApi(String(params.id)),

  meta: {
    invalidates: [
      ["member-booking", String(params.id)],
      ["member-bookings"],
      ["member-bookings-calendar"],
      ["member-home"],
      ["member-home-v2"],

      ["trainer-bookings"],
      ["trainer-today"],
      ["trainer-today-calendar"],

      ["admin-bookings"],
      ["admin-dashboard"],
      ["admin-dashboard-v2"],
      ["admin-settings-calendar"],
    ],
  },
});
  const booking = useMemo(() => query.data, [query.data]);
  const cancellationHours =
    booking?.cancellation_policy?.min_hours_before_start || booking?.cancel_before_hours || booking?.tenant_cancellation_hours || 3;
  const startsAtTime = booking?.starts_at ? new Date(booking.starts_at).getTime() : null;
  const hoursUntilStart = startsAtTime ? (startsAtTime - Date.now()) / (1000 * 60 * 60) : null;
  const canCancel = typeof hoursUntilStart === "number" ? hoursUntilStart >= cancellationHours : false;
  const sessionTitle = booking?.session_title || booking?.lesson_category_label || "Ders detayı";
  const venueLabel = booking?.tenant_name || booking?.salon_name || "-";
  const packageLabel = booking?.package_name || booking?.package_title || "-";
  const categoryLabel = booking?.lesson_category_label || booking?.lesson_category || "-";

  return (
    <AppShell title={sessionTitle} subtitle="Ders saati, iptal kuralı ve giriş durumu tek ekranda." icon="calendar" showBackButton>
      <View style={styles.metricsRow}>
        <MetricCard label="Durum" value={booking?.pending_schedule_change ? "Onay bekliyor" : bookingStatusLabel(booking?.status)|| "-"} hint="Plan kaydı" icon="calendar" />
        <MetricCard label="Check-in" value={booking?.checkin_status || "Bekliyor"} hint="Ders girişi" icon="checkin" />
      </View>
      <SurfaceCard tone="primary">
        <Text style={styles.section}>Bugünün odağı</Text>
        <Text style={styles.copy}>Tarih / saat: {booking?.starts_at ? new Date(booking.starts_at).toLocaleString("tr-TR") : "-"}</Text>
        <Text style={styles.copy}>Eğitmen: {booking?.trainer_full_name || "-"}</Text>
        <Text style={styles.copy}>Salon: {venueLabel}</Text>
        <Text style={styles.copy}>İptal sınırı: Derse {cancellationHours} saatten az kaldıysa iptal edilemez.</Text>
        {booking?.pending_schedule_change ? (
          <Text style={styles.copy}>
            Eğitmen yeni saat önerdi: {new Date(booking.pending_schedule_change.proposed_starts_at).toLocaleString("tr-TR")}
          </Text>
        ) : null}
      </SurfaceCard>
      <SurfaceCard>
        <Text style={styles.section}>Ders bilgisi</Text>
        <Text style={styles.copy}>Süre: {booking?.duration_minutes || 50} dk</Text>
        <Text style={styles.copy}>Paket: {packageLabel}</Text>
        <Text style={styles.copy}>Kategori: {categoryLabel}</Text>
        {booking?.checkin_status ? <StatusBadge label={statusLabel(booking.checkin_status)} tone={booking.checkin_status === "COMPLETED" ? "success" : "info"} /> : null}
      </SurfaceCard>
      <SurfaceCard>
        <Text style={styles.section}>Aksiyon</Text>
        <Text style={styles.copy}>İptal süresi geçerse hak yanabilir. Saat değişikliği varsa önce önerilen saati kontrol et.</Text>
      </SurfaceCard>
      <ActionButton
        testID="member-booking-cancel-button"
        label={canCancel ? "Dersi İptal Et" : "İptal Süresi Doldu"}
        icon="risk"
        variant="danger"
        onPress={() => mutation.mutate()}
        loading={mutation.isPending}
        disabled={!canCancel}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  section: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
});
