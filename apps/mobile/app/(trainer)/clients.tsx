// Bu sayfa mobil uygulamada trainer akisindaki clients ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getTrainerMembersApi } from "@/lib/mobile-api";
import { filterTrainerClients, isTrainerClientRisky, type TrainerClientFilter } from "@/lib/trainer-clients";
import { AppShell } from "@/theme/components/app-shell";
import { AppIcon, type AppIconName } from "@/theme/components/app-icon";
import { MetricCard } from "@/theme/components/metric-card";
import { SelectionChip } from "@/theme/components/selection-chip";
import { SurfaceCard } from "@/theme/components/surface-card";
import { FormField } from "@/theme/components/form-field";
import { EmptyState } from "@/theme/components/empty-state";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { tokens } from "@/theme/tokens";

export default function TrainerClientsScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TrainerClientFilter>("ALL");
  const result = useQuery({
    queryKey: ["trainer-clients"],
    queryFn: getTrainerMembersApi,
  });

  const source = Array.isArray(result.data) ? result.data : Array.isArray((result.data as any)?.data) ? (result.data as any).data : [];
  const items = useMemo(() => filterTrainerClients(source, { query, filter }), [filter, query, source]);
  const activeCount = source.filter((item: any) => item.is_active !== false).length;
  const riskCount = source.filter((item: any) => isTrainerClientRisky(item)).length;

  return (
    <AppShell
      title="Danışanlarım"
      subtitle="Portföyündeki danışanları ara, filtrele ve detaylarına hızlıca ulaş."
      icon="clients"
      refreshing={result.isRefetching}
      onRefresh={() => {
        void result.refetch();
      }}
    >
      <View style={styles.metricsRow}>
        <MetricCard label="Toplam danışan" value={source.length} hint="Portföy görünümü" icon="members" />
        <MetricCard label="Aktif danışan" value={activeCount} hint="Derse devam edenler" icon="calendar" />
      </View>

      <SurfaceCard tone="primary">
        <Text style={styles.section}>Bugünün odağı</Text>
        <Text style={styles.copy}>Danışan havuzunda öncelikli takip sinyalini öne çıkarır.</Text>
        <View style={styles.focusRow}>
          <AppIcon name="risk" size="sm" tone="danger" />
          <Text style={styles.copy}>Riskli danışan sayısı: {riskCount}</Text>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <FormField label="Danışan ara" value={query} onChangeText={setQuery} placeholder="Ad, telefon veya e-posta ile ara" />
      </SurfaceCard>

      <View style={styles.filters}>
        <SelectionChip label="Tümü" active={filter === "ALL"} onPress={() => setFilter("ALL")} />
        <SelectionChip label="Aktif" active={filter === "ACTIVE"} onPress={() => setFilter("ACTIVE")} />
        <SelectionChip label="Pasif" active={filter === "PASSIVE"} onPress={() => setFilter("PASSIVE")} />
        <SelectionChip label="Riskli" active={filter === "RISK"} onPress={() => setFilter("RISK")} />
      </View>

      {items.length === 0 ? (
        <EmptyState title="Danışan bulunamadı" description="Arama veya filtreyi değiştirerek listeyi yeniden daraltabilirsin." icon="clients" />
      ) : (
        <ScrollPanel maxHeight={480} contentContainerStyle={styles.stack}>
          {items.map((item: any) => (
            <Pressable key={item.id} style={styles.rowCard} onPress={() => router.push(`/(trainer)/members/${item.id}` as never)}>
              <View style={styles.rowHeader}>
                <View style={styles.titleWrap}>
                  <Text style={styles.title}>{item.full_name || "Danışan"}</Text>
                </View>
                <View style={styles.headerActions}>
                  <View style={[styles.statusBadge, item.is_active === false ? styles.statusBadgePassive : styles.statusBadgeActive]}>
                    <Text style={[styles.statusText, item.is_active === false ? styles.statusPassive : styles.statusActive]}>
                      {item.is_active === false ? "Pasif" : "Aktif"}
                    </Text>
                  </View>
                  <View style={styles.chevronWrap}>
                    <AppIcon name="arrow-right" size="sm" tone="neutral" variant="plain" />
                  </View>
                </View>
              </View>

              <View style={styles.detailPanel}>
                <DetailRow icon="phone" label="Telefon" value={item.phone || "Kayıtlı değil"} />
                <DetailRow icon="email" label="E-posta" value={item.email || "Kayıtlı değil"} />
              </View>

              <View style={styles.badgeRow}>
                {isTrainerClientRisky(item) ? <View style={styles.riskPill}><Text style={styles.riskPillText}>Riskli danışan</Text></View> : null}
                {item.is_active === false ? <View style={styles.passivePill}><Text style={styles.passivePillText}>Takipte pasif</Text></View> : null}
              </View>

              <Text style={styles.hint}>
                Paket durumu, katılım geçmişi, ölçüm kayıtları ve koç notlarını detay ekranında inceleyebilirsin.
              </Text>
            </Pressable>
          ))}
        </ScrollPanel>
      )}
    </AppShell>
  );
}

function DetailRow({ icon, label, value }: { icon: AppIconName; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLead}>
        <AppIcon name={icon} size="sm" tone="neutral" />
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      <Text style={styles.detailValue} numberOfLines={1} ellipsizeMode="tail">
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  section: {
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
  focusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.xs,
  },
  stack: {
    gap: tokens.spacing.sm,
  },
  rowCard: {
    gap: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    backgroundColor: tokens.colors.surface,
    ...tokens.shadow.soft,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
  },
  titleWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.bold,
  },
  statusBadge: {
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeActive: {
    backgroundColor: "#EAF8EF",
  },
  statusBadgePassive: {
    backgroundColor: "#FEE2E2",
  },
  chevronWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(15,23,42,0.04)",
  },
  statusText: {
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
  },
  statusActive: {
    color: tokens.colors.success,
  },
  statusPassive: {
    color: tokens.colors.danger,
  },
  detailPanel: {
    gap: tokens.spacing.xs,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  detailLead: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
  },
  detailLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: 20,
    fontFamily: tokens.fontFamily.medium,
  },
  detailValue: {
    flex: 1,
    textAlign: "right",
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: 20,
    fontFamily: tokens.fontFamily.semibold,
    minWidth: 0,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  riskPill: {
    backgroundColor: "#FFF1F2",
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  riskPillText: {
    color: tokens.colors.danger,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
  },
  passivePill: {
    backgroundColor: "#FEF2F2",
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  passivePillText: {
    color: tokens.colors.danger,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
  },
  hint: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.regular,
  },
});
