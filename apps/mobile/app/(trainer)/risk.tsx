// Bu sayfa mobil uygulamada trainer akisindaki risk ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { getTrainerRiskApi } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { EmptyPanel } from "@/theme/components/empty-panel";
import { AppIcon } from "@/theme/components/app-icon";
import { MetricCard } from "@/theme/components/metric-card";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { tokens } from "@/theme/tokens";
import { normalizeTrainerRiskRows } from "@/lib/trainer-risk";

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function TrainerRiskScreen() {
  const { data, isRefetching, refetch } = useQuery({ queryKey: ["trainer-risk"], queryFn: getTrainerRiskApi });
  const rows = normalizeTrainerRiskRows(Array.isArray(data?.data) ? data.data : []);
  const highRiskCount = rows.filter((row) => String(row.level).toUpperCase().includes("HIGH")).length;

  return (
    <AppShell testID="trainer-risk-screen" title="Riskli danışanlar" subtitle="Mobil hızlı takip için risk özet listesini tek ekranda topla." icon="risk" refreshing={isRefetching} onRefresh={() => { void refetch(); }} showBackButton>
      <View style={styles.metricsRow}>
        <MetricCard label="Riskli kişi" value={rows.length} hint="Takip listesi" icon="risk" />
        <MetricCard label="Yüksek risk" value={highRiskCount} hint="Öncelikli aksiyon" icon="shield" />
      </View>
      {rows.length === 0 ? <EmptyPanel title="Risk görünmüyor" description="Şu an kritik danışan listesi boş." iconName="shield" iconTone="neutral" /> : (
        <ScrollPanel maxHeight={500}>
          {rows.map((row, index) => (
            <SurfaceCard key={row.key} testID={`trainer-risk-item-${index}`}>
              <View style={styles.headerRow}>
                <Text style={styles.title}>{row.name}</Text>
                <View style={styles.badge}>
                  <AppIcon name="risk" size="sm" tone="danger" />
                </View>
              </View>
              <View style={styles.detailPanel}>
                <DetailRow label="Skor" value={row.score} />
                <DetailRow label="Seviye" value={row.level} />
                <Text style={styles.reason}>Neden: {row.reason || "Katılım düştü, paket azalıyor veya takip verisi eksik."}</Text>
              </View>
            </SurfaceCard>
          ))}
        </ScrollPanel>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  metricsRow: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.sm },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: tokens.spacing.sm },
  badge: { padding: 6, borderRadius: tokens.radius.pill, backgroundColor: "rgba(225,29,72,0.10)" },
  detailPanel: { gap: tokens.spacing.xs },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: tokens.spacing.sm },
  detailLabel: { flex: 1, color: tokens.colors.textMuted, fontSize: tokens.font.sm, lineHeight: 20, fontFamily: tokens.fontFamily.medium },
  detailValue: { flex: 1, textAlign: "right", color: tokens.colors.text, fontSize: tokens.font.sm, lineHeight: 20, fontFamily: tokens.fontFamily.semibold },
  title: { color: tokens.colors.text, fontSize: tokens.font.md, fontWeight: "800", fontFamily: tokens.fontFamily.bold },
  reason: { color: tokens.colors.textMuted, fontSize: tokens.font.xs, lineHeight: 18, fontFamily: tokens.fontFamily.regular },
});
