import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ActionButton } from "@/theme/components/action-button";
import { getAdminDashboardApi } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { AppIcon, type AppIconName } from "@/theme/components/app-icon";
import { StatusBadge } from "@/theme/components/status-badge";
import { SurfaceCard } from "@/theme/components/surface-card";
import { tokens } from "@/theme/tokens";

type DashboardRevenue = {
  daily?: number | string | null;
  weekly?: number | string | null;
  monthly?: number | string | null;
  yearly?: number | string | null;
};

type DashboardPackageSales = {
  weekly_credits_sold?: number | string | null;
  monthly_credits_sold?: number | string | null;

  weekly_package_count?: number | string | null;
  monthly_package_count?: number | string | null;
  yearly_package_count?: number | string | null;

  weekly_pack_8_count?: number | string | null;
  weekly_pack_4_count?: number | string | null;
  monthly_pack_8_count?: number | string | null;
  monthly_pack_4_count?: number | string | null;
  yearly_pack_8_count?: number | string | null;
  yearly_pack_4_count?: number | string | null;
};

function toNumber(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return 0;

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : 0;
}

function formatCurrency(value?: number | string | null) {
  return `₺${new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 0,
  }).format(toNumber(value))}`;
}

function formatCompactNumber(value?: number | string | null) {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 1,
  }).format(toNumber(value));
}

function formatPercent(value?: number | string | null) {
  return `%${new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 0,
  }).format(Math.max(toNumber(value), 0))}`;
}

function formatSignedPercent(value?: number | string | null) {
  const numeric = toNumber(value);
  const sign = numeric > 0 ? "+" : numeric < 0 ? "-" : "";

  return `${sign}%${new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 0,
  }).format(Math.abs(numeric))}`;
}

function getDaysInCurrentMonth() {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function getTodayOfMonth() {
  return new Date().getDate();
}

function resolveForecastTone(projectedMonth: number, monthlyRevenue: number): "success" | "warning" | "info" {
  if (monthlyRevenue <= 0 && projectedMonth <= 0) return "warning";
  if (projectedMonth > monthlyRevenue) return "success";
  return "info";
}

function ShareBarItem({
  label,
  value,
  total,
  helper,
}: {
  label: string;
  value: number;
  total: number;
  helper?: string;
}) {
  const share = total > 0 ? (value / total) * 100 : 0;
  const width = Math.min(100, Math.max(share, value > 0 ? 8 : 0));

  return (
    <View style={styles.seriesRow}>
      <View style={styles.seriesHeader}>
        <View style={styles.seriesLabelBlock}>
          <Text style={styles.seriesLabel}>{label}</Text>
          {helper ? <Text style={styles.seriesHelper}>{helper}</Text> : null}
        </View>

        <Text style={styles.seriesValue}>{formatCurrency(value)}</Text>
      </View>

      <View style={styles.seriesTrack}>
        <View style={[styles.seriesFill, { width: `${width}%` }]} />
      </View>
    </View>
  );
}

function SummaryItem({
  icon,
  label,
  value,
  helper,
}: {
  icon: AppIconName;
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <View style={styles.summaryItem}>
      <AppIcon name={icon} size="sm" tone="neutral" />

      <View style={styles.summaryCopy}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={styles.summaryValue}>{value}</Text>
        {helper ? <Text style={styles.summaryHelper}>{helper}</Text> : null}
      </View>
    </View>
  );
}

export default function AdminRevenueDetailScreen() {
  const router = useRouter();
  const { data, isRefetching, refetch } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: getAdminDashboardApi,
  });

  const revenue = (data?.revenue || {}) as DashboardRevenue;
  const packageSales = (data?.package_sales || {}) as DashboardPackageSales;

  const todayRevenue = toNumber(revenue.daily);
  const weeklyRevenue = toNumber(revenue.weekly);
  const monthlyRevenue = toNumber(revenue.monthly);
  const yearlyRevenue = toNumber(revenue.yearly);

  const weeklyCredits = toNumber(packageSales.weekly_credits_sold);
  const monthlyCredits = toNumber(packageSales.monthly_credits_sold);

  const weeklyPackageCount = toNumber(packageSales.weekly_package_count);
  const monthlyPackageCountFromApi = toNumber(packageSales.monthly_package_count);
  const yearlyPackageCount = toNumber(packageSales.yearly_package_count);

  const monthlyPack8 = toNumber(packageSales.monthly_pack_8_count);
  const monthlyPack4 = toNumber(packageSales.monthly_pack_4_count);
  const yearlyPack8 = toNumber(packageSales.yearly_pack_8_count);
  const yearlyPack4 = toNumber(packageSales.yearly_pack_4_count);

  const todayOfMonth = getTodayOfMonth();
  const daysInMonth = getDaysInCurrentMonth();

  const insights = useMemo(() => {
    const dailyPace = todayOfMonth > 0 ? monthlyRevenue / todayOfMonth : 0;
    const projectedMonth = dailyPace * daysInMonth;
    const remainingDays = Math.max(daysInMonth - todayOfMonth, 0);

    const monthlyPackageCount = monthlyPackageCountFromApi || monthlyPack8 + monthlyPack4;
    const knownMonthlyPackCount = monthlyPack8 + monthlyPack4;
    const otherMonthlyPackageCount = Math.max(monthlyPackageCount - knownMonthlyPackCount, 0);

    const yearlyKnownPackCount = yearlyPack8 + yearlyPack4;
    const otherYearlyPackageCount = Math.max(yearlyPackageCount - yearlyKnownPackCount, 0);

    const averageRevenuePerSale = monthlyPackageCount > 0 ? monthlyRevenue / monthlyPackageCount : 0;
    const averageCreditsPerSale = monthlyPackageCount > 0 ? monthlyCredits / monthlyPackageCount : 0;

    const pack8Share = monthlyPackageCount > 0 ? (monthlyPack8 / monthlyPackageCount) * 100 : 0;
    const pack4Share = monthlyPackageCount > 0 ? (monthlyPack4 / monthlyPackageCount) * 100 : 0;
    const otherPackageShare = monthlyPackageCount > 0 ? (otherMonthlyPackageCount / monthlyPackageCount) * 100 : 0;

    const todayShareOfMonth = monthlyRevenue > 0 ? (todayRevenue / monthlyRevenue) * 100 : 0;
    const weekShareOfMonth = monthlyRevenue > 0 ? (weeklyRevenue / monthlyRevenue) * 100 : 0;
    const monthShareOfYear = yearlyRevenue > 0 ? (monthlyRevenue / yearlyRevenue) * 100 : 0;

    const forecastDeltaPercent =
      monthlyRevenue > 0 ? ((projectedMonth - monthlyRevenue) / monthlyRevenue) * 100 : 0;

    return {
      dailyPace,
      projectedMonth,
      remainingDays,
      monthlyPackageCount,
      otherMonthlyPackageCount,
      otherYearlyPackageCount,
      averageRevenuePerSale,
      averageCreditsPerSale,
      pack8Share,
      pack4Share,
      otherPackageShare,
      todayShareOfMonth,
      weekShareOfMonth,
      monthShareOfYear,
      forecastDeltaPercent,
    };
  }, [
    daysInMonth,
    monthlyCredits,
    monthlyPack4,
    monthlyPack8,
    monthlyPackageCountFromApi,
    monthlyRevenue,
    todayOfMonth,
    todayRevenue,
    weeklyRevenue,
    yearlyPack4,
    yearlyPack8,
    yearlyPackageCount,
    yearlyRevenue,
  ]);

  return (
    <AppShell
      title="Gelir Detayı"
      subtitle="Salon gelirini, paket satışlarını ve ay sonu tahminini tek ekranda analiz et."
      icon="earnings"
      refreshing={isRefetching}
      onRefresh={() => {
        void refetch();
      }}
      showBackButton
    >
      <ActionButton label="Filtreli rapor ve CSV" icon="earnings" variant="ghost" onPress={() => router.push("/(admin)/revenue-report" as never)} />
      <SurfaceCard style={styles.heroCard} padding="hero">
        <View style={styles.heroRow}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.eyebrow}>Bu ay gerçekleşen gelir</Text>
            <Text style={styles.heroAmount}>{formatCurrency(monthlyRevenue)}</Text>
            <Text style={styles.heroCopy}>
              Satış anındaki paket tutarlarına göre hesaplanan bu ayki toplam salon geliri.
            </Text>
          </View>

          <StatusBadge
            label={`Ay sonu tahmini: ${formatCurrency(insights.projectedMonth)}`}
            tone={resolveForecastTone(insights.projectedMonth, monthlyRevenue)}
          />
        </View>
      </SurfaceCard>

      <SurfaceCard tone="primary">
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Dönemsel gelir dağılımı</Text>
          <Text style={styles.sectionCopy}>
            Bugün, hafta, ay ve yıl gelirlerinin dönem içindeki ağırlığını gösterir.
          </Text>
        </View>

        <View style={styles.seriesList}>
          <ShareBarItem
            label="Bugün"
            value={todayRevenue}
            total={monthlyRevenue}
            helper={
              todayRevenue > 0
                ? `Bu ayın %${formatCompactNumber(insights.todayShareOfMonth)} payı`
                : "Bugün henüz satış yok"
            }
          />

          <ShareBarItem
            label="Bu hafta"
            value={weeklyRevenue}
            total={monthlyRevenue}
            helper={
              weeklyRevenue > 0
                ? `Bu ayın %${formatCompactNumber(insights.weekShareOfMonth)} payı`
                : "Bu hafta henüz satış yok"
            }
          />
          <ShareBarItem
            label="Bu ay"
            value={monthlyRevenue}
            total={yearlyRevenue || monthlyRevenue}
            helper={`Bu yılın %${formatCompactNumber(insights.monthShareOfYear)} payı`}
          />
          <ShareBarItem
            label="Bu yıl"
            value={yearlyRevenue}
            total={yearlyRevenue || 1}
            helper="Yıl başından bugüne toplam gelir"
          />
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Yönetsel içgörüler</Text>
          <Text style={styles.sectionCopy}>
            Bugüne kadarki gelir ritmine göre ay sonu tahmini ve satış verimliliği.
          </Text>
        </View>

        <View style={styles.summaryGrid}>
          <SummaryItem
            icon="calendar"
            label="Günlük ortalama"
            value={formatCurrency(insights.dailyPace)}
            helper={`${todayOfMonth} günlük gerçekleşen ortalama`}
          />
          <SummaryItem
            icon="target"
            label="Ay sonu kapanış tahmini"
            value={formatCurrency(insights.projectedMonth)}
            helper={`${insights.remainingDays} gün kaldı • ${formatSignedPercent(insights.forecastDeltaPercent)} projeksiyon`}
          />
          <SummaryItem
            icon="money"
            label="Satış başı ortalama gelir"
            value={formatCurrency(insights.averageRevenuePerSale)}
            helper={`${insights.monthlyPackageCount} aylık paket satışına göre`}
          />
          <SummaryItem
            icon="package"
            label="Satış başı ortalama ders hakkı"
            value={`${formatCompactNumber(insights.averageCreditsPerSale)} hak`}
            helper={`${monthlyCredits} aylık satılan toplam ders hakkı`}
          />
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Paket satış dinamikleri</Text>
          <Text style={styles.sectionCopy}>
            Satış adedi, satılan ders hakkı ve paket büyüklüğü dağılımı.
          </Text>
        </View>

        <View style={styles.summaryGrid}>
          <SummaryItem
            icon="wallet"
            label="Bu hafta paket satışı"
            value={String(weeklyPackageCount)}
            helper={`${weeklyCredits} ders hakkı satıldı`}
          />
          <SummaryItem
            icon="earnings"
            label="Bu ay paket satışı"
            value={String(insights.monthlyPackageCount)}
            helper={`${monthlyCredits} ders hakkı satıldı`}
          />
          <SummaryItem
            icon="dumbbell"
            label={`8 haklı paket (${monthlyPack8} adet)`}
            value={formatPercent(insights.pack8Share)}
            helper="Bu ayki toplam paket satışları içindeki pay"
          />
          <SummaryItem
            icon="dumbbell"
            label={`4 haklı paket (${monthlyPack4} adet)`}
            value={formatPercent(insights.pack4Share)}
            helper="Bu ayki toplam paket satışları içindeki pay"
          />
          <SummaryItem
            icon="package"
            label={`Diğer paketler (${insights.otherMonthlyPackageCount} adet)`}
            value={formatPercent(insights.otherPackageShare)}
            helper="4/8 dışındaki paket satışları"
          />
          <SummaryItem
            icon="calendar"
            label="Yıllık paket satışı"
            value={String(yearlyPackageCount)}
            helper={`Diğer yıllık paketler: ${insights.otherYearlyPackageCount} adet`}
          />
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
    marginBottom: tokens.spacing.xs,
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
  seriesList: {
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.xs,
  },
  seriesRow: {
    gap: 6,
  },
  seriesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  seriesLabelBlock: {
    flex: 1,
    gap: 2,
  },
  seriesLabel: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.medium,
  },
  seriesHelper: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 16,
    fontFamily: tokens.fontFamily.regular,
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
  summaryLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.medium,
  },
  summaryValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  summaryHelper: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 16,
    fontFamily: tokens.fontFamily.regular,
  },
});
