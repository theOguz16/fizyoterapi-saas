// Bu sayfa mobil uygulamada trainer akisindaki today ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getTrainerTodayApi } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import {
  formatTrainerTodayDate,
  type TrainerCheckinRow,
  type TrainerRiskPreviewRow,
  type TrainerTodayBooking,
  selectTrainerNextBooking,
  selectTrainerRecentCheckins,
  selectTrainerRiskPreview,
} from "@/lib/trainer-today";
import { SurfaceCard } from "@/theme/components/surface-card";
import { MetricTile } from "@/theme/components/metric-tile";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { SectionTitle } from "@/theme/components/section-title";
import { ActionButton } from "@/theme/components/action-button";
import { EmptyPanel } from "@/theme/components/empty-panel";
import { AppIcon } from "@/theme/components/app-icon";
import { tokens } from "@/theme/tokens";
import { bookingStatusLabel } from "@/lib/labels";

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function TrainerTodayScreen() {
  const router = useRouter();
  const { data, isRefetching, refetch } = useQuery({ queryKey: ["trainer-today"], queryFn: getTrainerTodayApi });
  const bookings = Array.isArray(data?.bookings) ? data.bookings : [];
  const riskPreview = selectTrainerRiskPreview(data);
  const nextBooking = selectTrainerNextBooking(bookings);
  const checkins = selectTrainerRecentCheckins(data);
  const summary = data?.summary || {};
  const earnings = data?.earnings || {};

  return (
    <AppShell
      title="Bugün"
      subtitle="Günün ders planı, risk sinyalleri ve hızlı operasyonlar burada."
      icon="today"
      refreshing={isRefetching}
      onRefresh={() => {
        void refetch();
      }}
    >
      <SurfaceCard tone="primary" padding="hero">
        <View style={styles.heroRow}>
          <View style={styles.heroText}>
            <Text style={styles.eyebrow}>Eğitmen Paneli</Text>
            <Text style={styles.heroTitle}>Bugünkü akış hazır</Text>
            <Text style={styles.item}>
              {Number(summary.booking_total || 0) + Number(summary.session_total || 0)} planlı ders, {summary.checkin_total ?? 0} check-in ve {data?.risk?.at_risk_count ?? 0} öncelikli takip.
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <AppIcon name="today" tone="primary" size="lg" />
          </View>
        </View>
      </SurfaceCard>

      <View style={styles.grid}>
        <MetricTile label="Bugünkü ders" value={Number(summary.booking_total || 0) + Number(summary.session_total || 0)} tone="primary" iconName="calendar" />
        <MetricTile label="Check-in" value={summary.checkin_total ?? 0} tone="success" iconName="checkin" />
        <MetricTile label="Bu ay kazanç" value={`₺${Number(earnings.month_trainer_income || 0).toFixed(0)}`} tone="warning" iconName="earnings" />
        <MetricTile label="Riskli danışan" value={data?.risk?.at_risk_count ?? 0} tone="danger" iconName="risk" />
      </View>

      <SurfaceCard tone="primary">
        <SectionTitle title="Sıradaki ders" subtitle="En yakın planlanan dersin ve hızlı aksiyonların." />
        {nextBooking ? (
          <View style={styles.stack}>
            <View style={styles.heroRow}>
              <View style={styles.heroText}>
                <Text style={styles.title}>{nextBooking.member_full_name || "Danışan"}</Text>
                <Text style={styles.item}>{formatTrainerTodayDate(nextBooking.starts_at)}</Text>
              </View>
              <View style={styles.heroBadge}>
                <AppIcon name="calendar" tone="warning" />
              </View>
            </View>
            <View style={styles.detailPanel}>
              <DetailRow label="Ders" value={nextBooking.session_title || nextBooking.lesson_category_label || "Belirtilmedi"} />
              <DetailRow label="Durum" value={bookingStatusLabel(nextBooking.status)} />
            </View>
            <View style={styles.actionRow}>
              <ActionButton
                label="Check-in"
                icon="scan"
                onPress={() =>
                  router.push({
                    pathname: "/(trainer)/checkin",
                    params: nextBooking.session_id ? { sessionId: nextBooking.session_id, backTo: "/(trainer)/today" } : { backTo: "/(trainer)/today" },
                  } as never)
                }
              />
              <ActionButton
                label="Profili aç"
                icon="members"
                variant="ghost"
                onPress={() =>
                  router.push({
                    pathname: "/(trainer)/members/[id]",
                    params: { id: nextBooking.member_id, backTo: "/(trainer)/today" },
                  } as never)
                }
              />
            </View>
          </View>
        ) : (
          <EmptyPanel title="Yakın ders yok" description="Bugün planlanan randevu bulunduğunda burada ilk sırada görünecek." iconName="calendar" iconTone="warning" />
        )}
      </SurfaceCard>

      <SurfaceCard>
        <SectionTitle title="Bugünkü ders listesi" subtitle="Kronolojik görünüm ve hızlı üye erişimi." />
        {bookings.length === 0 ? (
          <EmptyPanel title="Ders görünmüyor" description="Bugünkü randevular oluştuğunda burada listelenecek." iconName="calendar" iconTone="warning" />
        ) : (
          <ScrollPanel maxHeight={300}>
            {bookings.map((row: TrainerTodayBooking) => (
              <Pressable
                key={row.id}
                style={styles.rowCard}
                onPress={() =>
                  router.push({
                    pathname: "/(trainer)/members/[id]",
                    params: { id: row.member_id, backTo: "/(trainer)/today" },
                  } as never)
                }
              >
                  <Text style={styles.title}>{row.member_full_name || "Danışan"}</Text>
                <View style={styles.detailPanel}>
                  <DetailRow label="Saat" value={formatTrainerTodayDate(row.starts_at)} />
                  <DetailRow label="Kategori" value={row.lesson_category_label || row.lesson_category || "Belirtilmedi"} />
                  <DetailRow label="Durum" value={bookingStatusLabel(row.status)} />
                </View>
              </Pressable>
            ))}
          </ScrollPanel>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <SectionTitle title="Riskli danışanlar" subtitle="Öncelikli takip gerektiren üyeler." />
        {riskPreview.length === 0 ? (
          <EmptyPanel title="Risk alarmı yok" description="Bu an için kritik takip gerektiren danışan görünmüyor." iconName="shield" iconTone="neutral" />
        ) : (
          <ScrollPanel maxHeight={260}>
            {riskPreview.map((row: TrainerRiskPreviewRow, index: number) => (
              <View key={row.member_id || index} style={styles.rowCard}>
                <Text style={styles.title}>{row.member_full_name || row.full_name || row.member_id || "Danışan"}</Text>
                <View style={styles.detailPanel}>
                  <DetailRow label="Risk skoru" value={row.risk_score ?? row.score ?? "-"} />
                  <DetailRow label="Durum" value={riskStatusLabel(row.risk_label || row.level)} />
                </View>
              </View>
            ))}
          </ScrollPanel>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <SectionTitle title="Son check-in" subtitle="Bugün işlenen son dersler." />
        {checkins.length === 0 ? (
          <EmptyPanel title="Check-in yok" description="Bugün işlenen dersler burada görünür." iconName="checkin" iconTone="success" />
        ) : (
          <ScrollPanel maxHeight={260}>
            {checkins.map((row: TrainerCheckinRow) => (
              <View key={row.id} style={styles.rowCard}>
                <Text style={styles.title}>{row.member_full_name || "Danışan"}</Text>
                <View style={styles.detailPanel}>
                  <DetailRow label="Saat" value={formatTrainerTodayDate(row.created_at)} />
                  <DetailRow label="Ders" value={row.session_title || row.lesson_category_label || "Belirtilmedi"} />
                  <DetailRow label="Düşen hak" value={row.credits_deducted ?? 0} />
                </View>
              </View>
            ))}
          </ScrollPanel>
        )}
      </SurfaceCard>
    </AppShell>
  );
}

function riskStatusLabel(value?: string | null) {
  const raw = String(value || "").toUpperCase();
  if (raw === "COK_RISKLI" || raw === "HIGH") return "Çok riskli";
  if (raw === "RISKLI" || raw === "MEDIUM") return "Riskli";
  if (raw === "STABIL" || raw === "LOW") return "Stabil";
  return "Takip gerekli";
}

const styles = StyleSheet.create({
  grid: { gap: tokens.spacing.sm },
  stack: { gap: tokens.spacing.sm },
  heroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  heroText: {
    flex: 1,
    gap: 4,
  },
  heroBadge: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.warningSoft,
    padding: 6,
  },
  rowCard: {
    gap: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.sm,
    backgroundColor: tokens.colors.surfaceSoft,
  },
  detailPanel: {
    gap: tokens.spacing.xs,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  detailLabel: {
    flex: 1,
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: 20,
    fontFamily: tokens.fontFamily.medium,
  },
  detailValue: {
    flex: 1,
    textAlign: "right",
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: 20,
    fontFamily: tokens.fontFamily.semibold,
  },
  eyebrow: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontFamily: tokens.fontFamily.semibold,
  },
  heroTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.display,
    lineHeight: 34,
    fontFamily: tokens.fontFamily.bold,
  },
  title: { color: tokens.colors.text, fontSize: tokens.font.md, fontWeight: "800", fontFamily: tokens.fontFamily.bold },
  item: { color: tokens.colors.text, fontSize: tokens.font.sm, lineHeight: 20, fontFamily: tokens.fontFamily.regular },
  actionRow: { flexDirection: "row", gap: tokens.spacing.sm, flexWrap: "wrap" },
});
