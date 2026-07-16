// Bu sayfa mobil uygulamada admin akışındaki members ekranını temsil eder.
// Ekranın amacı ilgili roldeki kullanıcıya bu adımda gereken veri, karar veya aksiyonu sunmaktır.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getAdminMembersApi, getAdminTrainersApi } from "@/lib/mobile-api";
import {
  buildAdminDirectory,
  filterAdminDirectory,
  getAdminDirectoryMetrics,
  getDirectoryPersonStatus,
  getDirectoryRiskLabel,
  isDirectoryPersonRisky,
  type AdminDirectoryRoleFilter,
  type AdminDirectoryStatusFilter,
} from "@/lib/admin-members-directory";
import { AppShell } from "@/theme/components/app-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { VirtualListPanel } from "@/theme/components/virtual-list-panel";
import { QueryState } from "@/theme/components/query-state";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { EmptyState } from "@/theme/components/empty-state";
import { StatusBadge } from "@/theme/components/status-badge";
import { FormField } from "@/theme/components/form-field";
import { AppIcon } from "@/theme/components/app-icon";
import { SegmentedSwitch } from "@/theme/components/segmented-switch";
import { tokens } from "@/theme/tokens";
import { resolveMembersEmptyState } from "@/lib/admin-empty-states";

export default function AdminMembersScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdminDirectoryStatusFilter>("ALL");
  const [roleFilter, setRoleFilter] = useState<AdminDirectoryRoleFilter>("ALL");
  const query = useQuery({
    queryKey: ["admin-members-v3"],
    queryFn: async () => {
      const [members, trainers] = await Promise.all([getAdminMembersApi(), getAdminTrainersApi()]);
      return buildAdminDirectory(members, trainers);
    },
  });
  function handleRoleFilterChange(nextRole: AdminDirectoryRoleFilter) {
    if (statusFilter === "RISK" && nextRole === "TRAINER") {
      setStatusFilter("ALL");
    }
    setRoleFilter(nextRole);
  }

  function handleStatusFilterChange(nextStatus: AdminDirectoryStatusFilter) {
    if (nextStatus === "RISK" && roleFilter === "TRAINER") {
      setRoleFilter("MEMBER");
    }
    setStatusFilter(nextStatus);
  }

  const items = useMemo(() => {
    return filterAdminDirectory(query.data || [], { search, status: statusFilter, role: roleFilter });
  }, [query.data, search, statusFilter, roleFilter]);
  const metrics = useMemo(() => {
    return getAdminDirectoryMetrics(query.data || []);
  }, [query.data]);
  const hasFilters = roleFilter !== "ALL" || statusFilter !== "ALL";
  const hasSearchOrFilters = Boolean(search.trim()) || hasFilters;
  const membersEmptyState = resolveMembersEmptyState(hasSearchOrFilters);
  const showFirstMemberPrompt =
    !query.isLoading && !query.isError && metrics.members === 0 && !hasSearchOrFilters;

  function clearDirectoryFilters() {
    setSearch("");
    setRoleFilter("ALL");
    setStatusFilter("ALL");
  }

  return (
    <AppShell title="Üyeler" subtitle="Üye ve eğitmen listesini tek ekranda filtreleyip detaylarını aç." icon="members" refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <View style={styles.metricsRow}>
        <MetricCard label="Toplam kişi" value={metrics.total} hint="Üye + eğitmen" icon="members" />
        <MetricCard label="Eğitmen" value={metrics.trainers} hint="Aktif kadro görünümü" icon="trainer" />
      </View>
      {showFirstMemberPrompt ? (
        <EmptyState
          title={membersEmptyState.title}
          description={membersEmptyState.description}
          icon={membersEmptyState.icon}
          actionLabel={membersEmptyState.actionLabel}
          actionIcon={membersEmptyState.actionIcon}
          actionTestID="admin-members-open-clinic-qr"
          onAction={() => router.push({ pathname: "/(admin)/clinic-qr", params: { backTo: "/(admin)/members" } } as never)}
        />
      ) : null}
      <SurfaceCard style={styles.searchCard}>
        <FormField label="Kişi ara" value={search} onChangeText={setSearch} placeholder="Ad, telefon veya e-posta ile ara" />
      </SurfaceCard>
      <SurfaceCard style={styles.filterPanel} tone="primary" padding="regular">
        <View style={styles.filterHeader}>
          <View style={styles.filterHeaderCopy}>
            <Text style={styles.filterTitle}>Filtreler</Text>
            <Text style={styles.filterSubtitle}>Rol ve duruma göre listeyi daralt.</Text>
          </View>
          {hasFilters ? (
            <ActionButton
              label="Temizle"
              variant="ghost"
              fullWidth={false}
              onPress={() => {
                setRoleFilter("ALL");
                setStatusFilter("ALL");
              }}
            />
          ) : null}
        </View>
        <View style={styles.filterBlock}>
          <Text style={styles.filterLabel}>Rol</Text>
          <SegmentedSwitch
            testID="admin-members-role-filter"
            value={roleFilter}
            options={[
              { label: "Hepsi", value: "ALL" },
              { label: "Üye", value: "MEMBER" },
              { label: "Eğitmen", value: "TRAINER" },
            ]}
            onChange={(value) => handleRoleFilterChange(value as typeof roleFilter)}
          />
        </View>
        <View style={styles.filterBlock}>
          <Text style={styles.filterLabel}>Durum</Text>
          <View style={styles.statusRow}>
            {[
              { label: "Hepsi", value: "ALL" },
              { label: "Aktif", value: "ACTIVE" },
              { label: "Pasif", value: "PASSIVE" },
              { label: "Riskli", value: "RISK" },
            ].map((option) => (
              <Pressable
                key={option.value}
                onPress={() => handleStatusFilterChange(option.value as "ALL" | "ACTIVE" | "PASSIVE" | "RISK")}
                style={({ pressed }) => [
                  styles.statusButton,
                  statusFilter === option.value ? styles.statusButtonActive : null,
                  pressed ? styles.statusButtonPressed : null,
                ]}
              >
                <Text style={[styles.statusButtonLabel, statusFilter === option.value ? styles.statusButtonLabelActive : null]} numberOfLines={1}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </SurfaceCard>
      {query.isLoading && !query.data ? (
        <QueryState mode="loading" title="Kişiler hazırlanıyor" />
      ) : query.isError && !query.data ? (
        <QueryState mode="error" onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={membersEmptyState.title}
          description={membersEmptyState.description}
          icon={membersEmptyState.icon}
          actionLabel={membersEmptyState.actionLabel}
          actionIcon={membersEmptyState.actionIcon}
          actionTestID={hasSearchOrFilters ? "admin-members-clear-empty-filter" : "admin-members-empty-open-qr"}
          onAction={
            membersEmptyState.action === "CLEAR_FILTERS"
              ? clearDirectoryFilters
              : () => router.push({ pathname: "/(admin)/clinic-qr", params: { backTo: "/(admin)/members" } } as never)
          }
        />
      ) : (
        <VirtualListPanel
          data={items}
          maxHeight={520}
          minHeight={320}
          keyExtractor={(item) => item.id}
          renderItem={(item, index) => (
            <SurfaceCard key={item.id} testID={`admin-person-card-${item.role.toLowerCase()}-${index}`}>
              <View style={styles.row}>
                <View style={styles.titleWrap}>
                  <Text style={styles.title}>{[item.first_name, item.last_name].filter(Boolean).join(" ") || item.email || "Üye"}</Text>
                  <Text style={styles.copy}>{item.phone || item.email || "-"}</Text>
                </View>
                {item.role === "TRAINER" ? (
                  <StatusBadge label="Eğitmen" tone="info" />
                ) : isDirectoryPersonRisky(item) ? (
                  <StatusBadge label="Riskli üye" tone="danger" />
                ) : null}
              </View>
              <View style={styles.metaRow}>
                <View style={styles.metaPill}>
                  <AppIcon name={item.role === "TRAINER" ? "trainer" : "member"} size="sm" tone="neutral" />
                  <Text style={styles.meta}>{item.role === "TRAINER" ? "Rol: Eğitmen" : "Rol: Üye"}</Text>
                </View>
                <View style={styles.metaPill}>
                  <AppIcon name="profile" size="sm" tone="neutral" />
                  <Text style={styles.meta}>Durum: {getDirectoryPersonStatus(item) === "ACTIVE" ? "Aktif" : "Pasif"}</Text>
                </View>
                <View style={styles.metaPill}>
                  <AppIcon name="calendar" size="sm" tone="neutral" />
                  <Text style={styles.meta}>Kayıt: {item.created_at ? new Date(item.created_at).toLocaleDateString("tr-TR") : "Yeni"}</Text>
                </View>
              </View>
              <Text style={styles.hint}>{getDirectoryRiskLabel(item)}</Text>
              <ActionButton
                testID={`admin-person-detail-${item.role.toLowerCase()}-${index}`}
                label="Detayı gör"
                icon={item.role === "TRAINER" ? "trainer" : "members"}
                onPress={() =>
                  router.push({
                    pathname: "/(admin)/members/[id]",
                    params: { id: item.id, role: item.role, backTo: "/(admin)/members" },
                  } as never)
                }
              />
            </SurfaceCard>
          )}
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
  searchCard: {
    gap: 0,
  },
  filterPanel: {
    gap: tokens.spacing.md,
  },
  filterHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  filterHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  filterTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  filterSubtitle: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  filterBlock: {
    gap: tokens.spacing.sm,
  },
  filterLabel: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
  },
  statusButton: {
    flex: 1,
    minHeight: tokens.touch.min,
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: 10,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  statusButtonActive: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primaryStrong,
    ...tokens.shadow.focus,
  },
  statusButtonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.96,
  },
  statusButtonLabel: {
    color: tokens.colors.text,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  statusButtonLabelActive: {
    color: "#FFFFFF",
  },
  stack: { gap: tokens.spacing.sm },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  titleWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.regular,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.xs,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  meta: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  hint: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
});
