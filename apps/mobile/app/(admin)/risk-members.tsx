// Bu sayfa mobil uygulamada admin akisindaki risk members ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { getAdminRiskMembersApi, type AdminRiskMemberItem } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { SurfaceCard } from "@/theme/components/surface-card";
import { EmptyState } from "@/theme/components/empty-state";
import { StatusBadge } from "@/theme/components/status-badge";
import { AppIcon } from "@/theme/components/app-icon";
import { tokens } from "@/theme/tokens";

export default function AdminRiskMembersScreen() {
  const query = useQuery({ queryKey: ["admin-risk-members"], queryFn: getAdminRiskMembersApi });
  const items = Array.isArray(query.data) ? query.data : [];

  return (
    <AppShell title="Riskli üyeler" subtitle="Backend risk havuzundaki aktif üyeleri, ana nedenleri ve önerilen aksiyonu tek listede incele." icon="risk" refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <View style={styles.metricsRow}>
        <MetricCard label="Risk havuzu" value={items.length} hint="Takip edilecek üye" icon="risk" />
        <MetricCard
          label="Yenileme adayı"
          value={items.filter((item: AdminRiskMemberItem) => resolveRiskReason(item).toLowerCase().includes("paket")).length}
          hint="Paketi bitişe yakın"
          icon="package"
        />
      </View>
      {items.length === 0 ? (
        <EmptyState title="Risk kaydı yok" description="Aktif risk kriterlerini karşılayan üye bulunursa burada listelenecek." icon="risk" />
      ) : (
        <ScrollPanel maxHeight={500}>
          {items.map((item: AdminRiskMemberItem, index: number) => (
            <SurfaceCard key={`${item.member_id || index}`}>
              <View style={styles.headerRow}>
                <View style={styles.identityRow}>
                  <AppIcon name="risk" size="sm" tone="danger" />
                  <Text style={styles.title}>{item.member_full_name || item.member_name || (item as any).full_name || "Üye"}</Text>
                </View>
                <StatusBadge label={item.risk_label || item.level || "Takip"} tone="danger" />
              </View>
              <Text style={styles.copy}>{resolveRiskReason(item)}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>Skor: {item.risk_score ?? "-"}</Text>
                <Text style={styles.meta}>Devamsızlık: {item.attendance_gap_days ?? "-"} gün</Text>
                <Text style={styles.meta}>Kalan hak: {item.remaining_credits ?? "-"}</Text>
              </View>
              <View style={styles.actionPill}>
                <AppIcon name="campaigns" size="sm" tone="warning" />
                <Text style={styles.hint}>Bu kayıt kampanya, arama veya paket yenileme aksiyonu için uygundur.</Text>
              </View>
            </SurfaceCard>
          ))}
        </ScrollPanel>
      )}
    </AppShell>
  );
}

function resolveRiskReason(item: AdminRiskMemberItem) {
  return item.primary_reason || item.reasom || "Katılım düşmüş, paket bitişe yaklaşmış veya takip verisi güncel değil.";
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    flex: 1,
  },
  title: {
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
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.xs,
  },
  meta: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  hint: {
    flex: 1,
    flexShrink: 1,
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.medium,
  },
});
