import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { getAdminDashboardApi, getAdminMobileApprovalsApi } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { EmptyState } from "@/theme/components/empty-state";
import { AppIcon } from "@/theme/components/app-icon";
import { StatusBadge } from "@/theme/components/status-badge";
import { HomePriorityCard } from "@/theme/components/home-priority-card";
import { QueryState } from "@/theme/components/query-state";
import { tokens } from "@/theme/tokens";
import { buildQuickSetupChecklist } from "@/lib/admin-dashboard";
import { resolveDashboardEmptyState } from "@/lib/admin-empty-states";
import { buildRoleActionHref, getRoleAction } from "@/lib/role-actions";
import { buildAdminHomePriorities, type HomePriorityItem } from "@/lib/home-priority";
import { QUERY_TIMING } from "@/lib/query-performance";

function resolveRiskReason(item: any) {
  if (Array.isArray(item?.reasons) && item.reasons.length > 0) {
    return String(item.reasons[0]);
  }
  return item?.primary_reason || item?.reason || item?.reasom || item?.risk_label || "Risk sinyali";
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const query = useQuery({
    queryKey: ["admin-dashboard-v2"],
    queryFn: getAdminDashboardApi,
    staleTime: QUERY_TIMING.home,
  });
  const approvalsQuery = useQuery({
    queryKey: ["admin-mobile-approvals"],
    queryFn: getAdminMobileApprovalsApi,
    staleTime: QUERY_TIMING.live,
  });
  const kpis = query.data?.kpis || {};
  const riskPreview = Array.isArray(query.data?.risk_preview) ? query.data.risk_preview : [];
  const quickSetup = buildQuickSetupChecklist(query.data);
  const priorities = buildAdminHomePriorities({
    setup: quickSetup,
    pendingApprovals: Array.isArray(approvalsQuery.data) ? approvalsQuery.data.length : 0,
    todaysBookings: kpis.todays_bookings,
    atRiskMembers: kpis.at_risk_members,
  });
  const dashboardEmptyState = resolveDashboardEmptyState(Number(kpis.active_members || 0));
  const notificationAction = getRoleAction("ADMIN_NOTIFICATIONS");
  const entryScanAction = getRoleAction("ADMIN_ENTRY_SCAN");
  const clinicQrAction = getRoleAction("ADMIN_CLINIC_QR");
  const campaignsAction = getRoleAction("ADMIN_CAMPAIGNS");

  function openPriority(item: HomePriorityItem) {
    if (!item.route) return;
    router.push({
      pathname: item.route,
      params: { ...item.params, backTo: "/(admin)/dashboard" },
    } as never);
  }

  return (
    <AppShell 
      testID="admin-dashboard-screen"
      title="Yönetim merkezi" 
      subtitle="Aktif üye, risk, bugünkü ders ve operasyon sinyallerinin özet görünümü." 
      icon="dashboard" 
      refreshing={query.isRefetching} 
      onRefresh={() => void query.refetch()}
      rightAction={<ActionButton testID="admin-dashboard-notifications" label={notificationAction.label} icon={notificationAction.icon} fullWidth={false} variant="ghost" onPress={() => router.push(buildRoleActionHref("ADMIN_NOTIFICATIONS", "/(admin)/dashboard") as never)} />}
    >
      <View style={styles.metricsRow}>
        <MetricCard label="Aktif üye" value={kpis.active_members ?? 0} hint="Salon genel görünümü" icon="members" />
        <MetricCard label="Aktif eğitmen" value={kpis.active_trainers ?? 0} hint="Bugün sahada olan ekip" icon="trainer" />
      </View>

      <View testID="admin-home-priority-section" style={styles.prioritySection}>
        <View style={styles.priorityHeader}>
          <Text style={styles.sectionTitle}>Şimdi ne yapmalısın?</Text>
          <Text style={styles.copy}>Öncelikler salonunun canlı durumuna göre sıralanır.</Text>
        </View>
        {query.isLoading && !query.data ? (
          <QueryState mode="loading" title="Öncelikler hazırlanıyor" />
        ) : query.isError && !query.data ? (
          <QueryState mode="error" error={query.error} title="Öncelikler alınamadı" onRetry={() => void query.refetch()} />
        ) : (
          priorities.map((item, index) => (
            <HomePriorityCard
              key={item.key}
              item={item}
              primary={index === 0}
              onPress={item.route ? () => openPriority(item) : undefined}
            />
          ))
        )}
      </View>

      <SurfaceCard>
        <Text style={styles.sectionTitle}>Hızlı işlemler</Text>
        <Text style={styles.copy}>Alt menüde olmayan saha işlemlerine buradan ulaş.</Text>
        <ActionButton testID="admin-dashboard-entry-scan" label={entryScanAction.label} icon={entryScanAction.icon} onPress={() => router.push(buildRoleActionHref("ADMIN_ENTRY_SCAN", "/(admin)/dashboard") as never)} />
        <ActionButton testID="admin-dashboard-clinic-qr" label={clinicQrAction.label} icon={clinicQrAction.icon} variant="ghost" onPress={() => router.push(buildRoleActionHref("ADMIN_CLINIC_QR", "/(admin)/dashboard") as never)} />
        <ActionButton testID="admin-dashboard-campaigns" label={campaignsAction.label} icon={campaignsAction.icon} variant="ghost" onPress={() => router.push(buildRoleActionHref("ADMIN_CAMPAIGNS", "/(admin)/dashboard") as never)} />
      </SurfaceCard>

      {riskPreview.length === 0 ? (
        <EmptyState
          title={dashboardEmptyState.title}
          description={dashboardEmptyState.description}
          icon={dashboardEmptyState.icon}
          actionLabel={dashboardEmptyState.actionLabel}
          actionIcon={dashboardEmptyState.actionIcon}
          actionTestID={Number(kpis.active_members || 0) === 0 ? "admin-dashboard-empty-open-qr" : "admin-dashboard-empty-open-members"}
          onAction={() =>
            router.push({
              pathname: dashboardEmptyState.route,
              params: { backTo: "/(admin)/dashboard" },
            } as never)
          }
        />
      ) : (
        <SurfaceCard>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Risk Sinyalleri</Text>
            <StatusBadge label={`${kpis.at_risk_members ?? riskPreview.length} Kayıt`} tone="danger" />
          </View>
          <ScrollPanel maxHeight={220}>
            {riskPreview.map((item: any, index: number) => (
              <View key={`${item.member_id || index}`} style={styles.riskListItem}>
                <View style={styles.riskIconWrap}>
                   <AppIcon name="risk" size="sm" tone="danger" />
                </View>
                <View style={styles.riskContent}>
                  <Text style={styles.riskName}>{item.member_full_name || item.member_name || item.full_name || "Üye"}</Text>
                  <Text style={styles.riskReason}>{resolveRiskReason(item)}</Text>
                </View>
              </View>
            ))}
          </ScrollPanel>
          <ActionButton label="Tüm riskli üyeleri gör" icon="risk" variant="ghost" onPress={() => router.push({ pathname: "/(admin)/risk-members", params: { backTo: "/(admin)/dashboard" } } as never)} />
        </SurfaceCard>
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
  prioritySection: { gap: tokens.spacing.sm },
  priorityHeader: { gap: 2 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: tokens.spacing.sm, marginBottom: 8 },
  sectionTitle: { color: tokens.colors.text, fontSize: tokens.font.lg, fontFamily: tokens.fontFamily.semibold, flex: 1 },
  copy: { color: tokens.colors.textMuted, fontSize: tokens.font.sm, lineHeight: tokens.lineHeight.normal, fontFamily: tokens.fontFamily.regular },
  riskListItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  riskIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF5F7",
    alignItems: "center",
    justifyContent: "center",
  },
  riskContent: {
    flex: 1,
  },
  riskName: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  riskReason: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.regular,
    marginTop: 2,
  },
});
