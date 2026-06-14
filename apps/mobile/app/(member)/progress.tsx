// Bu sayfa mobil uygulamada member akisindaki progress ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getMemberAttendanceApi, getMemberMeasurementsApi } from "@/lib/mobile-api";
import {
  buildMemberProgressMetrics,
  buildMeasurementTrend,
  buildPackageUsageForecast,
  formatAttendanceResult,
  formatMeasurementValue,
  getLatestMeasurement,
} from "@/lib/member-progress";
import { AppIcon } from "@/theme/components/app-icon";
import { AppShell } from "@/theme/components/app-shell";
import { EmptyPanel } from "@/theme/components/empty-panel";
import { MetricTile } from "@/theme/components/metric-tile";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { SectionTitle } from "@/theme/components/section-title";
import { SurfaceCard } from "@/theme/components/surface-card";
import { tokens } from "@/theme/tokens";

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function MemberProgressScreen() {
  const router = useRouter();
  const attendanceQuery = useQuery({ queryKey: ["member-attendance"], queryFn: getMemberAttendanceApi });
  const measurementsQuery = useQuery({ queryKey: ["member-measurements"], queryFn: getMemberMeasurementsApi });

  const summary = attendanceQuery.data?.summary;
  const packageBalances = Array.isArray(attendanceQuery.data?.package_balances) ? attendanceQuery.data.package_balances : [];
  const attendanceRows = Array.isArray(attendanceQuery.data?.data) ? attendanceQuery.data.data : [];
  const measurementRows = Array.isArray(measurementsQuery.data) ? measurementsQuery.data : [];
  const latestMeasurement = getLatestMeasurement(measurementRows);
  const metrics = buildMemberProgressMetrics(summary);
  const weightTrend = buildMeasurementTrend(measurementRows, "weight_kg");
  const fatTrend = buildMeasurementTrend(measurementRows, "fat_percent");
  const muscleTrend = buildMeasurementTrend(measurementRows, "muscle_kg");

  return (
    <AppShell
      title="Gelişim"
      subtitle="Katılımını, paket kullanımını ve ölçüm trendini birlikte takip et."
      icon="progress"
      refreshing={attendanceQuery.isRefetching || measurementsQuery.isRefetching}
      onRefresh={() => {
        void attendanceQuery.refetch();
        void measurementsQuery.refetch();
      }}
    >
      <View style={styles.grid}>
        <MetricTile label="Toplam katılım" value={metrics.totalAttendance} tone="primary" iconName="approvals" />
        <MetricTile label="Grup katılımı" value={metrics.groupAttendance} tone="success" iconName="members" />
        <MetricTile label="Kalan hak" value={metrics.remainingCredits} tone="warning" iconName="ticket" />
      </View>

      <SurfaceCard tone="primary">
        <SectionTitle title="Ölçüm özeti" subtitle="Son ölçümlerin ve temel vücut kompozisyonu değerlerin." />
        {latestMeasurement ? (
          <View style={styles.stack}>
            <View style={styles.measurementHeader}>
              <AppIcon name="ruler" tone="primary" />
              <Text style={styles.measurementDate}>{new Date(latestMeasurement.measured_at).toLocaleString("tr-TR")}</Text>
            </View>
            <View style={styles.measurementGrid}>
              <View style={styles.measurementCard}>
                <Text style={styles.measurementLabel}>Kilo</Text>
                <Text style={styles.measurementValue}>{formatMeasurementValue(latestMeasurement.weight_kg, " kg")}</Text>
              </View>
              <View style={styles.measurementCard}>
                <Text style={styles.measurementLabel}>Yağ</Text>
                <Text style={styles.measurementValue}>{formatMeasurementValue(latestMeasurement.fat_percent, "%")}</Text>
              </View>
              <View style={styles.measurementCard}>
                <Text style={styles.measurementLabel}>Kas</Text>
                <Text style={styles.measurementValue}>{formatMeasurementValue(latestMeasurement.muscle_kg, " kg")}</Text>
              </View>
            </View>
            <View style={styles.actionRow}>
              <Pressable style={styles.inlineAction} onPress={() => router.push("/(member)/measurements")}>
                <AppIcon name="ruler" size="sm" tone="primary" />
                <Text style={styles.inlineActionLabel}>Ölçüm ekle</Text>
              </Pressable>
              <Pressable style={styles.inlineAction} onPress={() => router.push("/(member)/measurements")}>
                <AppIcon name="progress" size="sm" tone="success" />
                <Text style={styles.inlineActionLabel}>Tüm geçmişi gör</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <EmptyPanel title="Ölçüm geçmişi yok" description="İlk ölçüm eklendiğinde trend kartları burada görünür." iconName="ruler" iconTone="primary" />
        )}
      </SurfaceCard>

      <SurfaceCard>
        <SectionTitle title="Dönem karşılaştırması" subtitle="İlk ve son ölçüm arasındaki değişimi birlikte değerlendir." />
        <View style={styles.measurementGrid}>
          <TrendTile label="Kilo" trend={weightTrend} suffix=" kg" />
          <TrendTile label="Yağ" trend={fatTrend} suffix="%" />
          <TrendTile label="Kas" trend={muscleTrend} suffix=" kg" positiveUp />
        </View>
        <Text style={styles.trendCopy}>{buildTrendNarrative(weightTrend, fatTrend, muscleTrend)}</Text>
      </SurfaceCard>

      <SurfaceCard>
        <SectionTitle title="Paket kullanım özeti" subtitle="Paket bazında toplam, kullanılan ve kalan haklarını gör." />
        {packageBalances.length === 0 ? (
          <EmptyPanel title="Aktif paket görünmüyor" description="Paket tanımlandığında kullanım kartları burada listelenir." iconName="package" iconTone="warning" />
        ) : (
          <ScrollPanel>
            {packageBalances.map((row: any) => {
              const forecast = buildPackageUsageForecast({
                remainingCredits: row.remaining_credits,
                upcomingBookingCount: attendanceQuery.data?.upcoming_bookings?.length || 0,
                weeklyUsage: Math.max(1, Math.round((summary?.total_attendance_count || 0) / 4)),
              });
              return <View key={row.user_package_id} style={styles.rowCard}>
                <Text style={styles.title}>{row.package_name || row.package_title || "Paket"}</Text>
                <View style={styles.detailPanel}>
                  <DetailRow label="Toplam hak" value={row.total_credits ?? "-"} />
                  <DetailRow label="Kullanılan hak" value={row.used_credits ?? "-"} />
                  <DetailRow label="Kalan hak" value={row.remaining_credits ?? "-"} />
                  <DetailRow label="Rezervasyon sonrası" value={`${forecast.availableAfterReservations} hak`} />
                  <DetailRow label="Tahmini bitiş" value={forecast.estimatedEnd.toLocaleDateString("tr-TR")} />
                </View>
                {forecast.shouldRenewSoon ? <Text style={styles.renewalHint}>Paketin mevcut kullanım hızına göre yakında bitebilir. Yenileme seçeneklerini inceleyebilirsin.</Text> : null}
              </View>;
            })}
          </ScrollPanel>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <SectionTitle title="Son katılım geçmişi" subtitle="Son derslerin ve işlenen katılım kayıtların." />
        {attendanceRows.length === 0 ? (
          <EmptyPanel title="Katılım kaydı yok" description="Ders işlendiğinde geçmişin burada görünür." iconName="approvals" iconTone="success" />
        ) : (
          <ScrollPanel>
            {attendanceRows.map((row: any) => (
              <Pressable key={row.id} style={styles.rowCard} onPress={() => router.push("/(member)/calendar")}>
                <Text style={styles.title}>{row.session_title || row.lesson_category_label || "Ders"}</Text>
                <View style={styles.detailPanel}>
                  <DetailRow label="Saat" value={new Date(row.created_at || row.starts_at).toLocaleString("tr-TR")} />
                  <DetailRow label="Sonuç" value={formatAttendanceResult(row.result)} />
                  <DetailRow label="Eğitmen" value={row.trainer_full_name || "Belirtilmedi"} />
                </View>
              </Pressable>
            ))}
          </ScrollPanel>
        )}
      </SurfaceCard>
    </AppShell>
  );
}

function TrendTile({ label, trend, suffix, positiveUp = false }: { label: string; trend: ReturnType<typeof buildMeasurementTrend>; suffix: string; positiveUp?: boolean }) {
  const favorable = trend ? (positiveUp ? trend.delta >= 0 : trend.delta <= 0) : false;
  return (
    <View style={styles.measurementCard}>
      <Text style={styles.measurementLabel}>{label}</Text>
      <Text style={styles.measurementValue}>{trend ? `${trend.delta > 0 ? "+" : ""}${trend.delta.toFixed(1)}${suffix}` : "-"}</Text>
      <Text style={[styles.trendState, trend && favorable ? styles.trendPositive : null]}>{trend ? (trend.direction === "STABLE" ? "Sabit" : favorable ? "Hedefle uyumlu" : "Takip edilmeli") : "En az iki ölçüm gerekli"}</Text>
    </View>
  );
}

function buildTrendNarrative(weight: ReturnType<typeof buildMeasurementTrend>, fat: ReturnType<typeof buildMeasurementTrend>, muscle: ReturnType<typeof buildMeasurementTrend>) {
  if (!weight && !fat && !muscle) return "Karşılaştırma için en az iki ölçüm kaydı gerekiyor.";
  const favorable = [weight?.delta !== undefined && weight.delta <= 0, fat?.delta !== undefined && fat.delta <= 0, muscle?.delta !== undefined && muscle.delta >= 0].filter(Boolean).length;
  return favorable >= 2 ? "Genel eğilim hedef odaklı ilerliyor. Aynı ritmi koruyup ölçümleri düzenli güncelle." : "Değişim tek başına sonuç değildir. Eğitmeninle birlikte dönem hedefini ve ders ritmini yeniden değerlendirebilirsin.";
}

const styles = StyleSheet.create({
  grid: {
    gap: tokens.spacing.sm,
  },
  stack: {
    gap: tokens.spacing.sm,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  inlineAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  inlineActionLabel: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  measurementHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  measurementDate: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.medium,
  },
  measurementGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  measurementCard: {
    minWidth: 98,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surfaceSoft,
    padding: tokens.spacing.sm,
    gap: 4,
  },
  measurementLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontFamily: tokens.fontFamily.semibold,
  },
  measurementValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.bold,
  },
  trendState: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  trendPositive: {
    color: tokens.colors.success,
  },
  trendCopy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  renewalHint: {
    color: tokens.colors.warning,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.medium,
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
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontWeight: "800",
    fontFamily: tokens.fontFamily.bold,
  },
});
