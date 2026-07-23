import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Share, StyleSheet, Text, View } from "react-native";
import { getAdminRevenueCsvApi, getAdminRevenueReportApi, getAdminTrainersApi, type AdminRevenueReport } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { MetricCard } from "@/theme/components/metric-card";
import { FormField } from "@/theme/components/form-field";
import { SelectionChip } from "@/theme/components/selection-chip";
import { ActionButton } from "@/theme/components/action-button";
import { EmptyState } from "@/theme/components/empty-state";
import { tokens } from "@/theme/tokens";
import { QueryState } from "@/theme/components/query-state";

function formatCurrency(value: number) {
  return `₺${Number(value || 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
}

export default function AdminRevenueReportScreen() {
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getTime() - 28 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [packageId, setPackageId] = useState("");
  const [trainerId, setTrainerId] = useState("");
  const query = useQuery({
    queryKey: ["admin-revenue-report", from, to, packageId, trainerId],
    queryFn: () => getAdminRevenueReportApi({ from, to: `${to}T23:59:59.999Z`, package_id: packageId || undefined, trainer_id: trainerId || undefined }),
  });
  const trainersQuery = useQuery({ queryKey: ["admin-trainers"], queryFn: getAdminTrainersApi });
  const report = query.data;
  const packages = useMemo<AdminRevenueReport["by_package"]>(() => report?.by_package || [], [report?.by_package]);
  const trainers = useMemo(() => Array.isArray(trainersQuery.data) ? trainersQuery.data : [], [trainersQuery.data]);

  async function shareCsv() {
    const csv = await getAdminRevenueCsvApi({ from, to: `${to}T23:59:59.999Z`, package_id: packageId || undefined, trainer_id: trainerId || undefined });
    await Share.share({ title: "FizyoFlow gelir raporu", message: csv });
  }

  return (
    <AppShell testID="admin-revenue-report-screen" title="Gelir raporu" subtitle="Tarih ve paket filtresiyle satışlarını karşılaştır, raporu CSV olarak paylaş." icon="earnings" showBackButton refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      {query.isLoading && !query.data ? <QueryState mode="loading" title="Gelir raporu hazırlanıyor" /> : query.isError && !query.data ? <QueryState mode="error" onRetry={() => void query.refetch()} /> : null}
      <View style={styles.metrics}>
        <MetricCard label="Toplam gelir" value={formatCurrency(report?.total_revenue || 0)} hint={`${report?.sale_count || 0} satış`} icon="money" />
        <MetricCard label="Satış ortalaması" value={formatCurrency(report?.average_sale || 0)} hint="Paket başına" icon="package" />
      </View>

      <SurfaceCard>
        <Text style={styles.section}>Rapor aralığı</Text>
        <FormField inputId="admin-revenue-report-from" label="Başlangıç" value={from} onChangeText={setFrom} placeholder="2026-06-01" autoCapitalize="none" />
        <FormField inputId="admin-revenue-report-to" label="Bitiş" value={to} onChangeText={setTo} placeholder="2026-06-30" autoCapitalize="none" />
        <View style={styles.chips}>
          <SelectionChip label="Tüm paketler" active={!packageId} onPress={() => setPackageId("")} />
          {packages.map((row) => <SelectionChip key={row.package_id} label={row.package_title} active={packageId === row.package_id} onPress={() => setPackageId(row.package_id)} />)}
        </View>
        <Text style={styles.filterLabel}>Eğitmen</Text>
        <View style={styles.chips}>
          <SelectionChip label="Tüm eğitmenler" active={!trainerId} onPress={() => setTrainerId("")} />
          {trainers.map((trainer: any) => <SelectionChip key={trainer.id} label={trainer.full_name || `${trainer.first_name || ""} ${trainer.last_name || ""}`.trim() || "Eğitmen"} active={trainerId === trainer.id} onPress={() => setTrainerId(String(trainer.id))} />)}
        </View>
        <ActionButton testID="admin-revenue-report-export-csv" label="CSV dışa aktar" icon="earnings" variant="ghost" onPress={() => void shareCsv()} />
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.section}>Paket dağılımı</Text>
        {!packages.length ? <EmptyState title="Bu aralıkta satış yok" description="Tarih aralığını değiştirerek tekrar kontrol edebilirsin." icon="earnings" /> : packages.map((row) => (
          <View key={row.package_id} style={styles.row}>
            <View style={styles.grow}><Text style={styles.title}>{row.package_title}</Text><Text style={styles.copy}>{row.count} satış</Text></View>
            <Text style={styles.amount}>{formatCurrency(row.amount)}</Text>
          </View>
        ))}
      </SurfaceCard>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.sm },
  section: { color: tokens.colors.text, fontSize: tokens.font.md, fontFamily: tokens.fontFamily.semibold },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.xs },
  filterLabel: { color: tokens.colors.textMuted, fontSize: tokens.font.xs, fontFamily: tokens.fontFamily.semibold },
  row: { flexDirection: "row", gap: tokens.spacing.sm, alignItems: "center", paddingVertical: tokens.spacing.sm, borderBottomWidth: 1, borderBottomColor: tokens.colors.border },
  grow: { flex: 1 },
  title: { color: tokens.colors.text, fontSize: tokens.font.sm, fontFamily: tokens.fontFamily.semibold },
  copy: { color: tokens.colors.textMuted, fontSize: tokens.font.xs, fontFamily: tokens.fontFamily.regular },
  amount: { color: tokens.colors.text, fontSize: tokens.font.md, fontFamily: tokens.fontFamily.bold },
});
