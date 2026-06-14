import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { getAdminSubscriptionHistoryApi } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { StatusBadge } from "@/theme/components/status-badge";
import { EmptyState } from "@/theme/components/empty-state";
import { tokens } from "@/theme/tokens";
import { QueryState } from "@/theme/components/query-state";

export default function AdminSubscriptionHistoryScreen() {
  const query = useQuery({ queryKey: ["admin-subscription-history"], queryFn: getAdminSubscriptionHistoryApi });
  const rows = Array.isArray(query.data) ? query.data : [];
  return (
    <AppShell title="Abonelik geçmişi" subtitle="Deneme, satın alma, yenileme ve mağaza olaylarını zaman sırasıyla takip et." icon="subscription" showBackButton refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      {query.isLoading && !query.data ? <QueryState mode="loading" title="Abonelik geçmişi hazırlanıyor" /> : query.isError && !query.data ? <QueryState mode="error" onRetry={() => void query.refetch()} /> : !rows.length ? <EmptyState title="Abonelik olayı yok" description="Deneme veya satın alma işlemleri burada zaman çizelgesi olarak görünür." icon="subscription" /> : rows.map((row, index) => (
        <SurfaceCard key={`${row.type}-${row.occurred_at}-${index}`}>
          <View style={styles.header}><View style={styles.dot} /><View style={styles.grow}><Text style={styles.title}>{row.title}</Text><Text style={styles.date}>{new Date(row.occurred_at).toLocaleString("tr-TR")}</Text></View><StatusBadge label={row.type.replaceAll("_", " ")} tone={index === 0 ? "success" : "info"} /></View>
          <Text style={styles.copy}>{row.description}</Text>
        </SurfaceCard>
      ))}
    </AppShell>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: tokens.spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: tokens.colors.primary },
  grow: { flex: 1 },
  title: { color: tokens.colors.text, fontSize: tokens.font.sm, fontFamily: tokens.fontFamily.semibold },
  date: { color: tokens.colors.textMuted, fontSize: tokens.font.xs, fontFamily: tokens.fontFamily.regular },
  copy: { color: tokens.colors.textMuted, fontSize: tokens.font.sm, lineHeight: tokens.lineHeight.normal, fontFamily: tokens.fontFamily.regular },
});
