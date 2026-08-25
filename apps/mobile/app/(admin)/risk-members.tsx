// Bu sayfa mobil uygulamada admin akisindaki risk members ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { getAdminRiskMembersApi, type AdminRiskMemberItem } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { VirtualListPanel } from "@/theme/components/virtual-list-panel";
import { SurfaceCard } from "@/theme/components/surface-card";
import { EmptyState } from "@/theme/components/empty-state";
import { StatusBadge } from "@/theme/components/status-badge";
import { AppIcon } from "@/theme/components/app-icon";
import { ActionButton } from "@/theme/components/action-button";
import { tokens } from "@/theme/tokens";

export default function AdminRiskMembersScreen() {
  const router = useRouter();
  const query = useQuery({ queryKey: ["admin-risk-members"], queryFn: getAdminRiskMembersApi });
  const items = Array.isArray(query.data) ? query.data : [];

  return (
    <AppShell testID="admin-risk-members-screen" title="Riskli üyeler" subtitle="Backend risk havuzundaki aktif üyeleri, ana nedenleri ve önerilen aksiyonu tek listede incele." icon="risk" refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <View style={styles.metricsRow}>
        <MetricCard testID="admin-risk-pool-metric" label="Risk havuzu" value={items.length} hint="Takip edilecek üye" icon="risk" />
        <MetricCard
          testID="admin-risk-renewal-metric"
          label="Yenileme adayı"
          value={items.filter((item: AdminRiskMemberItem) => resolveRiskReason(item).toLowerCase().includes("paket")).length}
          hint="Paketi bitişe yakın"
          icon="package"
        />
      </View>
      {items.length === 0 ? (
        <EmptyState title="Risk kaydı yok" description="Aktif risk kriterlerini karşılayan üye bulunursa burada listelenecek." icon="risk" />
      ) : (
        <VirtualListPanel
          data={items}
          maxHeight={500}
          minHeight={320}
          keyExtractor={(item, index) => String(item.member_id || index)}
          renderItem={(item: AdminRiskMemberItem, index: number) => (
            <SurfaceCard key={`${item.member_id || index}`} testID={`admin-risk-member-${index}`}>
              <View style={styles.headerRow}>
                <View style={styles.identityRow}>
                  <AppIcon name="risk" size="sm" tone="danger" />
                  <Text style={styles.title}>{resolveMemberName(item)}</Text>
                </View>
                <StatusBadge label={item.risk_label || item.level || "Takip"} tone="danger" />
              </View>
              <Text style={styles.copy}>{resolveRiskReason(item)}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>Skor: {item.risk_score ?? item.score ?? "-"}</Text>
                <Text style={styles.meta}>Devamsızlık: {item.attendance_gap_days ?? item.days_since_attendance ?? "-"} gün</Text>
                <Text style={styles.meta}>Kalan hak: {item.remaining_credits ?? "-"}</Text>
              </View>
              <View style={styles.actionPill}>
                <AppIcon name="campaigns" size="sm" tone="warning" />
                <Text style={styles.hint}>Bu kayıt kampanya, arama veya paket yenileme aksiyonu için uygundur.</Text>
              </View>
              <View style={styles.actions}>
                <ActionButton
                  testID={`admin-risk-member-detail-${index}`}
                  label="Üye detayını incele"
                  icon="members"
                  onPress={() =>
                    router.push({
                      pathname: "/(admin)/members/[id]",
                      params: { id: String(item.member_id), role: "MEMBER", backTo: "/(admin)/risk-members" },
                    } as never)
                  }
                />
                <ActionButton
                  testID={`admin-risk-member-action-${index}`}
                  label="Riskli üyelere aksiyon oluştur"
                  icon="campaigns"
                  variant="ghost"
                  onPress={() =>
                    router.push({
                      pathname: "/(admin)/campaign-create",
                      params: { audience: "RISK", source: "risk-members" },
                    } as never)
                  }
                />
              </View>
            </SurfaceCard>
          )}
        />
      )}
    </AppShell>
  );
}

function resolveRiskReason(item: AdminRiskMemberItem) {
  return item.primary_reason || item.reasom || item.reasons?.[0] || "Katılım düşmüş, paket bitişe yaklaşmış veya takip verisi güncel değil.";
}

function resolveMemberName(item: AdminRiskMemberItem) {
  return item.member_full_name || item.member_name || item.full_name || item.email || "Üye adı bekleniyor";
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
  actions: {
    gap: tokens.spacing.sm,
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
