// Bu sayfa mobil uygulamada admin akisindaki risk preview ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { getAdminDashboardApi } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { SurfaceCard } from "@/theme/components/surface-card";
import { EmptyPanel } from "@/theme/components/empty-panel";
import { AppIcon } from "@/theme/components/app-icon";
import { tokens } from "@/theme/tokens";

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function AdminRiskPreviewScreen() {
  const { data, isRefetching, refetch } = useQuery({ queryKey: ["admin-dashboard"], queryFn: getAdminDashboardApi });
  const rows = Array.isArray(data?.risk_preview) ? data.risk_preview : [];

  return (
    <AppShell title="Risk önizleme" subtitle="İlk riskli üyelerin mobil özetini hızlıca incele." icon="risk" refreshing={isRefetching} onRefresh={() => { void refetch(); }} showBackButton>
      <View style={styles.metricsRow}>
        <MetricCard label="Riskli üye" value={rows.length} hint="Ön izleme listesi" icon="risk" />
        <MetricCard label="Aksiyon" value="Takip et" hint="Kampanya / arama" icon="campaigns" />
      </View>
      {rows.length === 0 ? <EmptyPanel title="Risk kaydı yok" description="Şu an alarm seviyesinde üye bulunmuyor." iconName="shield" iconTone="neutral" /> : (
        <ScrollPanel maxHeight={500}>
          {rows.map((row: any, index: number) => (
            <SurfaceCard key={row.member_id || index}>
              <View style={styles.headerRow}>
                <Text style={styles.title}>{row.member_full_name || row.full_name || row.member_id || "Üye"}</Text>
                <View style={styles.badge}>
                  <AppIcon name="risk" size="sm" tone="danger" />
                </View>
              </View>
              <View style={styles.detailPanel}>
                <DetailRow label="Skor" value={row.risk_score ?? row.score ?? "-"} />
                <DetailRow label="Seviye" value={row.risk_level_label || row.level || "Takip"} />
                <Text style={styles.reason}>{row.reason || row.primary_reason || "Katılım düşüşü veya paket bitişi yaklaşmış olabilir."}</Text>
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
