import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text } from "react-native";
import { getTrainerAssignedPackagesApi } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { EmptyState } from "@/theme/components/empty-state";
import { tokens } from "@/theme/tokens";

export default function TrainerPackagesScreen() {
  const query = useQuery({
    queryKey: ["trainer-assigned-packages"],
    queryFn: getTrainerAssignedPackagesApi,
  });

  const packages = query.data || [];

  return (
    <AppShell title="Verdiğim paketler" subtitle="Bu alanda yalnızca sana atanmış paketleri ve verdiğin ders türlerini görürsün. Komisyon bilgisi burada gösterilmez." icon="package" refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      {packages.length === 0 ? (
        <EmptyState title="Atanmış paket görünmüyor" description="Salondaki admin henüz sana bir paket bağlamamış olabilir." icon="package" />
      ) : (
        packages.map((pkg) => (
          <SurfaceCard key={pkg.id} tone="primary">
            <Text style={styles.title}>{pkg.title}</Text>
            <Text style={styles.meta}>{pkg.service_name || pkg.lesson_category_label || "Ders türü tanımlanmadı"}</Text>
            <Text style={styles.copy}>Paket tipi: {pkg.package_type || "-"} • Paket adı: {pkg.package_name || pkg.title}</Text>
            <Text style={styles.copy}>Bu paket üzerinden açılan ders ve rezervasyonlar takviminde kullanılabilir.</Text>
          </SurfaceCard>
        ))
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
  },
  meta: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
});
