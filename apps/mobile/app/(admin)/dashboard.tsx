import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getAdminDashboardApi } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { EmptyState } from "@/theme/components/empty-state";
import { AppIcon, type AppIconName } from "@/theme/components/app-icon";
import { StatusBadge } from "@/theme/components/status-badge";
import { tokens } from "@/theme/tokens";
import { buildQuickSetupChecklist, type QuickSetupStep } from "@/lib/admin-dashboard";
import { resolveDashboardEmptyState } from "@/lib/admin-empty-states";

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
  });
  const kpis = query.data?.kpis || {};
  const riskPreview = Array.isArray(query.data?.risk_preview) ? query.data.risk_preview : [];
  const quickSetup = buildQuickSetupChecklist(query.data);
  const dashboardEmptyState = resolveDashboardEmptyState(Number(kpis.active_members || 0));
  const focusItems = [
    { label: "Bekleyen onay", value: kpis.pending_approvals ?? 0, tone: "warning" as const, icon: "approvals" as const },
    { label: "Bugünkü ders", value: kpis.todays_bookings ?? 0, tone: "primary" as const, icon: "calendar" as const },
    { label: "Riskli üye", value: kpis.at_risk_members ?? 0, tone: "danger" as const, icon: "risk" as const },
  ];

  return (
    <AppShell 
      title="Yönetim merkezi" 
      subtitle="Aktif üye, risk, bugünkü ders ve operasyon sinyallerinin özet görünümü." 
      icon="dashboard" 
      refreshing={query.isRefetching} 
      onRefresh={() => void query.refetch()}
      rightAction={<ActionButton testID="admin-dashboard-notifications" label="Bildirim" icon="notifications" fullWidth={false} variant="ghost" onPress={() => router.push({ pathname: "/(admin)/notifications", params: { backTo: "/(admin)/dashboard" } } as never)} />}
    >
      <View style={styles.metricsRow}>
        <MetricCard label="Aktif üye" value={kpis.active_members ?? 0} hint="Salon genel görünümü" icon="members" />
        <MetricCard label="Aktif eğitmen" value={kpis.active_trainers ?? 0} hint="Bugün sahada olan ekip" icon="trainer" />
      </View>

      {query.data?.quick_setup && !quickSetup.isComplete ? (
        <SurfaceCard tone="primary">
          <View style={styles.setupHeader}>
            <View style={styles.setupHeaderCopy}>
              <Text style={styles.sectionTitle}>Hızlı kurulum</Text>
              <Text style={styles.copy}>Kliniğini birkaç kısa adımla ilk danışana hazırla.</Text>
            </View>
            <StatusBadge label={`${quickSetup.completed}/${quickSetup.total}`} tone="info" />
          </View>

          <View style={styles.progressTrack} accessibilityLabel={`Kurulum ${quickSetup.completed}/${quickSetup.total} tamamlandı`}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round((quickSetup.completed / quickSetup.total) * 100)}%` },
              ]}
            />
          </View>

          <View style={styles.setupList}>
            {quickSetup.steps.map((step) => (
              <SetupStepRow
                key={step.key}
                step={step}
                onPress={() => {
                  if (!step.route) return;
                  router.push({ pathname: step.route, params: { backTo: "/(admin)/dashboard" } } as never);
                }}
              />
            ))}
          </View>

          {quickSetup.nextStep ? (
            <ActionButton
              testID="admin-quick-setup-next"
              label={quickSetup.nextStep.title}
              icon={quickSetup.nextStep.icon}
              onPress={() =>
                router.push({
                  pathname: quickSetup.nextStep!.route,
                  params: { backTo: "/(admin)/dashboard" },
                } as never)
              }
            />
          ) : null}
        </SurfaceCard>
      ) : null}

      <SurfaceCard tone="primary">
        <Text style={styles.sectionTitle}>Bugünün odağı</Text>
        <Text style={styles.copy}>İlk bakışta aksiyon gerektiren operasyon başlıklarını gösterir.</Text>
        <View style={styles.focusList}>
          {focusItems.map((item) => (
            <View key={item.label} style={styles.focusItem}>
              <AppIcon name={item.icon} size="sm" tone={item.tone} />
              <View style={styles.focusCopy}>
                <Text style={styles.focusLabel}>{item.label}</Text>
                <Text style={styles.focusValue}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.sectionTitle}>Günlük operasyon</Text>
        <Text style={styles.copy}>Bugün en sık kullanacağın alanları öne çıkarır.</Text>
        <View style={styles.quickGrid}>
          <QuickAction testID="admin-dashboard-approvals" title="Onaylar" icon="approvals" onPress={() => router.push({ pathname: "/(admin)/approvals", params: { backTo: "/(admin)/dashboard" } } as never)} />
          <QuickAction testID="admin-dashboard-entry-scan" title="Giriş Tarama" icon="scan" onPress={() => router.push({ pathname: "/(admin)/entry-scan", params: { backTo: "/(admin)/dashboard" } } as never)} />
          <QuickAction testID="admin-dashboard-calendar" title="Takvim" icon="calendar" onPress={() => router.push("/(admin)/calendar" as never)} />
          <QuickAction testID="admin-dashboard-members" title="Üyeler" icon="members" onPress={() => router.push("/(admin)/members" as never)} />
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.sectionTitle}>Yönetim araçları</Text>
        <Text style={styles.copy}>Daha düşük frekanslı ama kritik yönetim alanları burada kalır.</Text>
        <View style={styles.quickGrid}>
          <QuickAction testID="admin-dashboard-risk" title="Risk Havuzu" icon="risk" onPress={() => router.push({ pathname: "/(admin)/risk-members", params: { backTo: "/(admin)/dashboard" } } as never)} />
          <QuickAction testID="admin-dashboard-packages" title="Paketler" icon="package" onPress={() => router.push({ pathname: "/(admin)/packages", params: { backTo: "/(admin)/dashboard" } } as never)} />
          <QuickAction testID="admin-dashboard-campaigns" title="Kampanyalar" icon="campaigns" onPress={() => router.push({ pathname: "/(admin)/campaigns", params: { backTo: "/(admin)/dashboard" } } as never)} />
          <QuickAction testID="admin-dashboard-digital-vitrine" title="Dijital Vitrin" icon="external" onPress={() => router.push({ pathname: "/(admin)/salon", params: { backTo: "/(admin)/dashboard" } } as never)} />
          <QuickAction testID="admin-dashboard-revenue" title="Gelir Detayı" icon="earnings" onPress={() => router.push({ pathname: "/(admin)/dashboard/revenue-detail", params: { backTo: "/(admin)/dashboard" } } as never)} />
          <QuickAction testID="admin-dashboard-salon" title="Salon Ayarları" icon="clinic" onPress={() => router.push({ pathname: "/(admin)/salon", params: { backTo: "/(admin)/dashboard" } } as never)} />
          <QuickAction testID="admin-dashboard-clinic-qr" title="Salon QR" icon="qr" onPress={() => router.push({ pathname: "/(admin)/clinic-qr", params: { backTo: "/(admin)/dashboard" } } as never)} />
        </View>
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

function SetupStepRow({ step, onPress }: { step: QuickSetupStep; onPress: () => void }) {
  return (
    <Pressable
      testID={`admin-quick-setup-${step.key}`}
      accessibilityLabel={`${step.title}, ${step.complete ? "tamamlandı" : "bekliyor"}`}
      disabled={!step.route}
      onPress={onPress}
      style={({ pressed }) => [styles.setupRow, pressed ? styles.setupRowPressed : null]}
    >
      <AppIcon name={step.icon} size="sm" tone={step.complete ? "success" : "neutral"} />
      <View style={styles.setupRowCopy}>
        <Text style={styles.setupRowTitle}>{step.title}</Text>
        <Text style={styles.setupRowDescription}>{step.description}</Text>
      </View>
      {step.complete ? (
        <StatusBadge label="Tamam" tone="success" />
      ) : step.route ? (
        <AppIcon name="arrow-right" size="sm" tone="neutral" variant="plain" />
      ) : null}
    </Pressable>
  );
}

function QuickAction({ title, icon, onPress, testID }: { title: string; icon: AppIconName; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.quickCard, pressed ? styles.quickCardPressed : null]}>
      <View style={styles.quickHeader}>
        <View style={styles.quickIconWrap}>
          <AppIcon name={icon} size="md" tone="primary" />
        </View>
        <AppIcon name="arrow-right" size="sm" tone="neutral" />
      </View>
      <Text style={styles.quickTitle}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  setupHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  setupHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: tokens.colors.border,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: tokens.colors.success,
  },
  setupList: {
    gap: 0,
  },
  setupRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.border,
  },
  setupRowPressed: {
    opacity: 0.72,
  },
  setupRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  setupRowTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  setupRowDescription: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: tokens.spacing.sm, marginBottom: 8 },
  sectionTitle: { color: tokens.colors.text, fontSize: tokens.font.lg, fontFamily: tokens.fontFamily.semibold, flex: 1 },
  copy: { color: tokens.colors.textMuted, fontSize: tokens.font.sm, lineHeight: tokens.lineHeight.normal, fontFamily: tokens.fontFamily.regular },
  focusList: {
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  focusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.16)",
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  focusCopy: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  focusLabel: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.medium,
  },
  focusValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.bold,
  },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.sm, marginTop: tokens.spacing.sm },
  quickCard: { flexGrow: 1, flexBasis: "47%", minHeight: 104, borderRadius: tokens.radius.lg, borderWidth: 1, backgroundColor: "rgba(255,255,255,0.88)", borderColor: "rgba(151,187,156,0.18)", padding: tokens.spacing.md, gap: tokens.spacing.sm, justifyContent: "center", ...tokens.shadow.soft },
  quickCardPressed: { transform: [{ scale: 0.98 }] },
  quickHeader: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  quickIconWrap: { width: 50, height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(151,187,156,0.14)" },
  quickTitle: { color: tokens.colors.text, fontSize: tokens.font.sm, lineHeight: 20, fontFamily: tokens.fontFamily.semibold },

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
