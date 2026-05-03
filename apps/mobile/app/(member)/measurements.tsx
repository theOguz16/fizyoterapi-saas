// Bu sayfa mobil uygulamada member akisindaki measurements ekranini temsil eder.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { getMemberMeaşurementsApi } from "@/lib/mobile-api";
import { ActionButton } from "@/theme/components/action-button";
import { AppIcon } from "@/theme/components/app-icon";
import { AppShell } from "@/theme/components/app-shell";
import { EmptyState } from "@/theme/components/empty-state";
import { MetricCard } from "@/theme/components/metric-card";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { SegmentedSwitch } from "@/theme/components/segmented-switch";
import { SurfaceCard } from "@/theme/components/surface-card";
import { TrainerMemberMeasurementChart } from "@/theme/components/trainer-member-measurement-chart";
import { tokens } from "@/theme/tokens";

// Yardımcı Format Fonksiyonları
function formatDateTime(value?: string | null) {
  if (!value) return "Belirtilmedi";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Belirtilmedi" : date.toLocaleString("tr-TR");
}

function formatChartDate(value?: string | null) {
  if (!value) return "--.--.--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--.--.--";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatMetricValue(value: string | number | null | undefined, unit?: string, prefix = false) {
  const numeric = toNumber(value);
  if (numeric === null) return "-";
  const text = numeric % 1 === 0 ? String(numeric) : numeric.toFixed(1);
  if (!unit) return text;
  return prefix ? `${unit}${text}` : `${text} ${unit}`;
}

export default function MemberMeasurementsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<"SUMMARY" | "HISTORY">("SUMMARY");

  const query = useQuery({
    queryKey: ["member-measurements"],
    queryFn: getMemberMeaşurementsApi, // Kendi import adına göre bırakıldı
  });

  const items = Array.isArray(query.data) ? query.data : [];
  const latest = items[0] || null;
  const previous = items[1] || null;
// Kilo Trendi Hesaplama
  const weightTrend = useMemo(() => {
    if (!latest || !previous) return "Karşılaştırma için veri bekleniyor";

    const latestWeight = toNumber(latest.weight_kg);
    const prevWeight = toNumber(previous.weight_kg);

    // Eğer değerlerden biri null ise çıkarma işlemi yapma ve "-" dön
    if (latestWeight === null || prevWeight === null) return "-";

    const diff = latestWeight - prevWeight;
    
    if (diff === 0) return "Sabit kaldı";
    return `${diff > 0 ? "+" : ""}${diff.toFixed(1)} kg`;
  }, [latest, previous]);

  // Grafik Bileşeni İçin Veri Hazırlama (Eskiden Yeniye Sıralı)
  const measurementTrend = useMemo(() => {
    return [...items]
      .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())
      .map((row) => ({
        label: formatChartDate(row.measured_at),
        height_cm: toNumber(row.height_cm),
        weight_kg: toNumber(row.weight_kg),
        fat_percent: toNumber(row.fat_percent),
        muscle_kg: toNumber(row.muscle_kg ?? row.muscle_percent),
      }));
  }, [items]);

  return (
    <AppShell
      title="Ölçümlerim"
      subtitle="Fiziksel gelişimini zaman içinde detaylıca takip et."
      icon="measurements"
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      rightAction={
        <ActionButton
          testID="member-measurements-add"
          label="Yeni Ölçüm" 
          icon="measurements" 
          fullWidth={false} 
          onPress={() => router.push("/(member)/measurement/new" as never)} 
        />
      }
    >
      {latest ? (
        <>
          <View style={styles.metricsRow}>
            <MetricCard label="Kayıt Sayısı" value={items.length} hint="Toplam ölçüm" icon="measurements" />
            <MetricCard label="Kilo Trendi" value={weightTrend} hint="Son iki kayıt" icon="progress" />
          </View>

          <SegmentedSwitch
            testID="member-measurements-tab"
            value={tab}
            options={[
              { label: "Özet & Grafik", value: "SUMMARY" },
              { label: "Geçmiş Liste", value: "HISTORY" },
            ]}
            onChange={(val) => setTab(val as "SUMMARY" | "HISTORY")}
          />

          {tab === "SUMMARY" && (
            <>
              {/* 2x2 Renkli Grid Alanı */}
              <SurfaceCard>
                <Text style={styles.sectionTitle}>En Güncel Değerlerin</Text>
                <View style={styles.measurementGrid}>
                  <View style={[styles.measurementTile, styles.measurementTileNeutral]}>
                    <AppIcon name="ruler" size="sm" tone="neutral" />
                    <Text style={styles.measurementLabel}>Boy</Text>
                    <Text style={styles.measurementValue}>{formatMetricValue(latest.height_cm, "cm")}</Text>
                  </View>
                  <View style={[styles.measurementTile, styles.measurementTileSuccess]}>
                    <AppIcon name="weight" size="sm" tone="success" />
                    <Text style={styles.measurementLabel}>Kilo</Text>
                    <Text style={styles.measurementValue}>{formatMetricValue(latest.weight_kg, "kg")}</Text>
                  </View>
                  <View style={[styles.measurementTile, styles.measurementTileWarning]}>
                    <AppIcon name="droplets" size="sm" tone="warning" />
                    <Text style={styles.measurementLabel}>Yağ Oranı</Text>
                    <Text style={styles.measurementValue}>{formatMetricValue(latest.fat_percent, "%", true)}</Text>
                  </View>
                  <View style={[styles.measurementTile, styles.measurementTileInfo]}>
                    <AppIcon name="dumbbell" size="sm" tone="primary" />
                    <Text style={styles.measurementLabel}>Kas Kütlesi</Text>
                    <Text style={styles.measurementValue}>{formatMetricValue(latest.muscle_kg ?? latest.muscle_percent, "kg")}</Text>
                  </View>
                </View>
                <Text style={styles.hint}>
                  Son Kayıt: {latest.measured_at ? formatDateTime(latest.measured_at) : "-"}
                </Text>
              </SurfaceCard>

              {/* Detaylı İnteraktif Grafik (Trainer sayfasından besleniyor) */}
              <SurfaceCard>
                <Text style={styles.sectionTitle}>Gelişim Grafiği</Text>
                <Text style={styles.copy}>
                  Aşağıdaki grafikten eğilimleri inceleyebilir, metrikleri açıp kapatabilirsin.
                </Text>
                <TrainerMemberMeasurementChart points={measurementTrend} />
              </SurfaceCard>
            </>
          )}

          {tab === "HISTORY" && (
            <SurfaceCard>
              <Text style={styles.sectionTitle}>Geçmiş Ölçümler</Text>
              <ScrollPanel maxHeight={500}>
                {items.map((item: any) => (
                  <View key={item.id} style={styles.historyCard}>
                    <View style={styles.historyHeader}>
                      <AppIcon name="calendar" size="sm" tone="primary" />
                      <Text style={styles.historyDate}>{formatDateTime(item.measured_at)}</Text>
                    </View>
                    <View style={styles.historyGrid}>
                      <View style={styles.historyMetric}>
                        <Text style={styles.historyMetricLabel}>Kilo</Text>
                        <Text style={styles.historyMetricValue}>{formatMetricValue(item.weight_kg, "kg")}</Text>
                      </View>
                      <View style={styles.historyMetric}>
                        <Text style={styles.historyMetricLabel}>Yağ</Text>
                        <Text style={styles.historyMetricValue}>{formatMetricValue(item.fat_percent, "%")}</Text>
                      </View>
                      <View style={styles.historyMetric}>
                        <Text style={styles.historyMetricLabel}>Kas</Text>
                        <Text style={styles.historyMetricValue}>{formatMetricValue(item.muscle_kg ?? item.muscle_percent, "kg")}</Text>
                      </View>
                      <View style={styles.historyMetric}>
                        <Text style={styles.historyMetricLabel}>Boy</Text>
                        <Text style={styles.historyMetricValue}>{formatMetricValue(item.height_cm, "cm")}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollPanel>
            </SurfaceCard>
          )}
        </>
      ) : (
        <EmptyState 
          title="Henüz ölçüm eklenmemiş" 
          description="İlk ölçümünü eklediğinde burada gelişim grafiğin ve özet kartların belirecek." 
          icon="measurements" 
        />
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  sectionTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.semibold,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  hint: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.medium,
    marginTop: tokens.spacing.xs,
  },
  
  // 2x2 Renkli Grid Stilleri (Trainer detaydan alındı)
  measurementGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  measurementTile: {
    flexGrow: 1,
    flexBasis: "47%",
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    gap: tokens.spacing.xs + 2,
    borderWidth: 1,
  },
  measurementTileNeutral: {
    backgroundColor: "#F8FAFC",
    borderColor: "#CBD5E1",
  },
  measurementTileSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  measurementTileWarning: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
  },
  measurementTileInfo: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  measurementLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  measurementValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
  },

  // Liste Kartı Stilleri
  listCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#FFFFFF",
    padding: tokens.spacing.md,
    gap: 8,
    marginBottom: tokens.spacing.xs,
  },
  inlineBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  grow: {
    flex: 1,
  },
  cardTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.bold,
  },
  historyCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: "#F8FAFB",
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.sm,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    paddingBottom: 8,
  },
  historyDate: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.bold,
  },
  historyGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
  },
  historyMetric: {
    alignItems: "center",
    gap: 2,
  },
  historyMetricLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  historyMetricValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.bold,
  },
});
