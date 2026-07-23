import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { getTrainerScheduleChangeRequestsApi, type TrainerRequestCenterItem } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { SegmentedSwitch } from "@/theme/components/segmented-switch";
import { StatusBadge } from "@/theme/components/status-badge";
import { EmptyState } from "@/theme/components/empty-state";
import { tokens } from "@/theme/tokens";
import { QueryState } from "@/theme/components/query-state";

type Filter = "PENDING" | "APPROVED" | "REJECTED";

export default function TrainerRequestCenterScreen() {
  const [filter, setFilter] = useState<Filter>("PENDING");
  const query = useQuery({ queryKey: ["trainer-schedule-change-requests"], queryFn: getTrainerScheduleChangeRequestsApi });
  const rows = useMemo<TrainerRequestCenterItem[]>(() => (query.data || []).filter((row: TrainerRequestCenterItem) => row.status === filter), [filter, query.data]);
  return (
    <AppShell testID="trainer-request-center-screen" title="Değişiklik merkezi" subtitle="Ders saati değişikliklerini bekleyen, onaylanan ve reddedilen olarak takip et." icon="calendar" showBackButton refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <SegmentedSwitch value={filter} options={[{ label: "Bekleyen", value: "PENDING" }, { label: "Onaylanan", value: "APPROVED" }, { label: "Reddedilen", value: "REJECTED" }]} onChange={(value) => setFilter(value as Filter)} />
      {query.isLoading && !query.data ? <QueryState mode="loading" title="Talepler hazırlanıyor" /> : query.isError && !query.data ? <QueryState mode="error" onRetry={() => void query.refetch()} /> : !rows.length ? <EmptyState title={`${filter === "PENDING" ? "Bekleyen" : filter === "APPROVED" ? "Onaylanan" : "Reddedilen"} talep yok`} description="Ders takviminden oluşturduğun değişiklik talepleri burada zaman çizelgesiyle görünür." icon="calendar" /> : rows.map((row) => (
        <SurfaceCard key={row.id} testID={`trainer-request-center-item-${String(row.id)}`}>
          <View style={styles.header}><View style={styles.grow}><Text style={styles.title}>{new Date(row.proposed_starts_at).toLocaleString("tr-TR")}</Text><Text style={styles.copy}>Eski saat: {new Date(row.current_starts_at).toLocaleString("tr-TR")}</Text></View><StatusBadge label={filter === "PENDING" ? "Bekliyor" : filter === "APPROVED" ? "Onaylandı" : "Reddedildi"} tone={filter === "PENDING" ? "warning" : filter === "APPROVED" ? "success" : "danger"} /></View>
          {row.note ? <Text style={styles.note}>Gerekçe: {row.note}</Text> : null}
          <Text style={styles.date}>Talep: {new Date(row.created_at).toLocaleString("tr-TR")}</Text>
        </SurfaceCard>
      ))}
    </AppShell>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", gap: tokens.spacing.sm },
  grow: { flex: 1 },
  title: { color: tokens.colors.text, fontSize: tokens.font.md, fontFamily: tokens.fontFamily.semibold },
  copy: { color: tokens.colors.textMuted, fontSize: tokens.font.sm, fontFamily: tokens.fontFamily.regular },
  note: { color: tokens.colors.text, fontSize: tokens.font.sm, lineHeight: tokens.lineHeight.normal, fontFamily: tokens.fontFamily.medium },
  date: { color: tokens.colors.textMuted, fontSize: tokens.font.xs, fontFamily: tokens.fontFamily.regular },
});
