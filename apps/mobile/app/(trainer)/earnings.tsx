import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import {
  getTrainerTodayApi,
  type TrainerEarningsPeriodComparison,
  type TrainerEarningsSeriesPoint,
} from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { AppIcon } from "@/theme/components/app-icon";
import { StatusBadge } from "@/theme/components/status-badge";
import { SurfaceCard } from "@/theme/components/surface-card";
import { tokens } from "@/theme/tokens";

const MONTH_LABELS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function formatCurrency(value: number) {
  return `₺${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(value)}`;
}

function formatPercent(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}%${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(Math.abs(value))}`;
}

function resolveTone(value: number): "success" | "danger" | "info" {
  if (value > 0) return "success";
  if (value < 0) return "danger";
  return "info";
}

function getComparisonCopy(item: TrainerEarningsPeriodComparison | undefined, currentLabel: string, previousLabel: string) {
  if (!item) return `${currentLabel} verisi henüz oluşmadı.`;
  if (item.current <= 0 && item.previous <= 0) return `${currentLabel} için henüz gelir oluşturan ders kaydı yok.`;
  if (item.delta > 0) return `${currentLabel}, ${previousLabel.toLowerCase()} göre ${formatCurrency(item.delta)} daha yüksek.`;
  if (item.delta < 0) return `${currentLabel}, ${previousLabel.toLowerCase()} göre ${formatCurrency(Math.abs(item.delta))} daha düşük.`;
  return `${currentLabel} ile ${previousLabel.toLowerCase()} aynı seviyede.`;
}

function formatSeriesLabel(point: TrainerEarningsSeriesPoint, mode: "month" | "year") {
  if (mode === "year") return point.label;
  const [, month] = point.key.split("-");
  const monthIndex = Number(month) - 1;
  return MONTH_LABELS[monthIndex] || point.label;
}

function SeriesBars({
  title,
  subtitle,
  points,
  mode,
}: {
  title: string;
  subtitle: string;
  points: TrainerEarningsSeriesPoint[];
  mode: "month" | "year";
}) {
  const maxValue = Math.max(...points.map((point) => point.total), 1);

  return (
    <SurfaceCard tone="primary">
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionCopy}>{subtitle}</Text>
      </View>
      <View style={styles.seriesList}>
        {points.map((point) => (
          <View key={point.key} style={styles.seriesRow}>
            <View style={styles.seriesHeader}>
              <Text style={styles.seriesLabel}>{formatSeriesLabel(point, mode)}</Text>
              <Text style={styles.seriesValue}>{formatCurrency(point.total)}</Text>
            </View>
            <View style={styles.seriesTrack}>
              <View
                style={[
                  styles.seriesFill,
                  {
                    width: `${Math.max((point.total / maxValue) * 100, point.total > 0 ? 8 : 0)}%`,
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </SurfaceCard>
  );
}

export default function TrainerEarningsScreen() {
  const query = useQuery({ queryKey: ["trainer-earnings"], queryFn: getTrainerTodayApi });
  const earnings = query.data?.earnings || {};

  const dayComparison = earnings.comparison?.day;
  const weekComparison = earnings.comparison?.week;
  const monthComparison = earnings.comparison?.month;
  const yearComparison = earnings.comparison?.year;
  const monthlySeries = useMemo(() => {
  const rawData = (earnings.monthly_series || []).slice(-12);
  
  // Veriyi kopyalayıp ay numarasına göre (01, 02... 12) sıralıyoruz
  return [...rawData].sort((a, b) => {
    const monthA = parseInt(a.key.split("-")[1]); // "2024-05" -> 5
    const monthB = parseInt(b.key.split("-")[1]); // "2024-01" -> 1
    return monthA - monthB;
  });
}, [earnings.monthly_series]);
  const yearlySeries = useMemo(() => (earnings.yearly_series || []).slice(-5), [earnings.yearly_series]);
  const monthIncome = Number(earnings.month_trainer_income || earnings.month_total || 0);
  const yearIncome = Number(earnings.year_total || 0);
  const creditedLessons = Number(earnings.month_credited_lessons || 0);
  const averagePerLesson = creditedLessons > 0 ? Math.round(monthIncome / creditedLessons) : 0;
  const commissionRate = Number(earnings.month_commission_rate || 0);

  return (
    <AppShell
      title="Kazançlarım"
      subtitle="Kısa dönem özetini üstte görün, uzun vadeli performansı son 12 ay ve son 5 yıl üzerinden takip edin."
      icon="earnings"
      refreshing={query.isRefetching}
      onRefresh={() => {
        void query.refetch();
      }}
    >
      <SurfaceCard style={styles.heroCard} padding="hero">
        <View style={styles.heroRow}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.eyebrow}>Bu ay net kazanç</Text>
            <Text style={styles.heroAmount}>{formatCurrency(monthIncome)}</Text>
            <Text style={styles.heroCopy}>İşlenen derslerden bu ay hesabınıza yansıyan toplam kazanç.</Text>
          </View>
          <StatusBadge label={`${formatPercent(monthComparison?.delta_percent || 0)} ay farkı`} tone={resolveTone(monthComparison?.delta || 0)} />
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.sectionTitle}>Kısa dönem özeti</Text>
        <View style={styles.quickList}>
          <View style={styles.quickRow}>
            <View style={styles.quickTextBlock}>
              <Text style={styles.quickTitle}>Bugün / Dün</Text>
              <Text style={styles.quickCopy}>{getComparisonCopy(dayComparison, "Bugün", "Dün")}</Text>
            </View>
            <View style={styles.quickMetric}>
              <Text style={styles.quickValue}>{formatCurrency(dayComparison?.current || 0)}</Text>
              <StatusBadge label={formatPercent(dayComparison?.delta_percent || 0)} tone={resolveTone(dayComparison?.delta || 0)} />
            </View>
          </View>
          <View style={styles.quickRow}>
            <View style={styles.quickTextBlock}>
              <Text style={styles.quickTitle}>Bu hafta / Geçen hafta</Text>
              <Text style={styles.quickCopy}>{getComparisonCopy(weekComparison, "Bu hafta", "Geçen hafta")}</Text>
            </View>
            <View style={styles.quickMetric}>
              <Text style={styles.quickValue}>{formatCurrency(weekComparison?.current || 0)}</Text>
              <StatusBadge label={formatPercent(weekComparison?.delta_percent || 0)} tone={resolveTone(weekComparison?.delta || 0)} />
            </View>
          </View>
        </View>
      </SurfaceCard>

      <SeriesBars
        title="Son 12 ay"
        subtitle="Aylık net kazanç akışınız. Günlük ve haftalık dalgalanmaları burada değil, uzun dönem deseni görmek için kullanın."
        points={monthlySeries}
        mode="month"
      />

      <SeriesBars
        title="Son 5 yıl"
        subtitle="Yıllık toplam görünüm. Genel büyüme veya daralma eğilimini buradan okuyun."
        points={yearlySeries}
        mode="year"
      />

      <SurfaceCard>
        <Text style={styles.sectionTitle}>Ödeme özeti</Text>
         <View style={styles.summaryGrid}>
             <View style={styles.summaryItem}>
               <AppIcon name="earnings" size="sm" tone="neutral" />
                <View style={styles.summaryCopy}>
                  <Text style={styles.summaryLabel}>Bu ay net kazanç</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(monthIncome)}</Text>
               </View>
                </View>
                  <View style={styles.summaryItem}>
                    <AppIcon name="earnings" size="sm" tone="neutral" />
                    <View style={styles.summaryCopy}>
                      <Text style={styles.summaryLabel}>Bu yıl net kazanç</Text>
                      <Text style={styles.summaryValue}>{formatCurrency(yearIncome)}</Text>
                    </View>
                  </View>
                  <View style={styles.summaryItem}>
                    <AppIcon name="dumbbell" size="sm" tone="neutral" />
                    <View style={styles.summaryCopy}>
                      <Text style={styles.summaryLabel}>Bu ay işlenen ders</Text>
                      <Text style={styles.summaryValue}>{creditedLessons}</Text>
                    </View>
                  </View>    
                  <View style={styles.summaryItem}>
                    <AppIcon name="money" size="sm" tone="neutral" />
                    <View style={styles.summaryCopy}>
                      <Text style={styles.summaryLabel}>Ders başı ortalama ücret</Text>
                      <Text style={styles.summaryValue}>{formatCurrency(averagePerLesson)}</Text>
                    </View>
                  </View>
                  <View style={styles.summaryItem}>
                    <AppIcon name="percent" size="sm" tone="neutral" />
                    <View style={styles.summaryCopy}>
                      <Text style={styles.summaryLabel}>Komisyon oranı</Text>
                      <Text style={styles.summaryValue}>%{commissionRate}</Text>
                    </View>
                  </View>
                  <View style={styles.summaryItem}>
                    <AppIcon name="calendar" size="sm" tone="neutral" />
                    <View style={styles.summaryCopy}>
                      <Text style={styles.summaryLabel}>Bu ay / Geçen ay</Text>
                      <Text style={styles.summaryValue}>
                        {formatCurrency(monthComparison?.current || 0)} / {formatCurrency(monthComparison?.previous || 0)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.summaryItem}>
                    <AppIcon name="calendar" size="sm" tone="neutral" />
                    <View style={styles.summaryCopy}>
                      <Text style={styles.summaryLabel}>Bu yıl / Geçen yıl</Text>
                      <Text style={styles.summaryValue}>
                        {formatCurrency(yearComparison?.current || 0)} / {formatCurrency(yearComparison?.previous || 0)}
                      </Text>
                    </View>
                  </View>
                </View>
      </SurfaceCard>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: tokens.colors.surface,
    borderColor: "rgba(151,187,156,0.24)",
  },
  heroRow: {
    gap: tokens.spacing.md,
  },
  heroTextBlock: {
    gap: tokens.spacing.xs,
  },
  eyebrow: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroAmount: {
    color: tokens.colors.text,
    fontSize: 34,
    lineHeight: 40,
    fontFamily: tokens.fontFamily.bold,
  },
  heroCopy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  sectionHeader: {
    gap: 2,
  },
  sectionTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  sectionCopy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.regular,
  },
  quickList: {
    gap: tokens.spacing.md,
  },
  quickRow: {
    gap: tokens.spacing.sm,
    paddingBottom: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(31,41,55,0.06)",
  },
  quickTextBlock: {
    gap: 4,
  },
  quickTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  quickCopy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.regular,
  },
  quickMetric: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  quickValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
  },
  seriesList: {
    gap: tokens.spacing.md,
  },
  seriesRow: {
    gap: 6,
  },
  seriesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  seriesLabel: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.medium,
  },
  seriesValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  seriesTrack: {
    width: "100%",
    height: 12,
    borderRadius: tokens.radius.pill,
    backgroundColor: "rgba(151,187,156,0.12)",
    overflow: "hidden",
  },
  seriesFill: {
    height: "100%",
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.primaryStrong,
    minWidth: 6,
  },
  summaryList: {
    gap: tokens.spacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.md,
  },
  summaryLabel: {
    flex: 1,
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.medium,
  },
  summaryValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
   summaryGrid: {
    gap: tokens.spacing.sm,
  },
  summaryItem: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.sm + 2,
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.16)",
  },
  summaryCopy: {
    flex: 1,
    gap: 2,
  },
});
