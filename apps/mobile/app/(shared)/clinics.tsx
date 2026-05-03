import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { getPublıcSalonsApi } from "@/lib/mobile-api";
import { AppShell } from "@/theme/components/app-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { EmptyState } from "@/theme/components/empty-state";
import { StatusBadge } from "@/theme/components/status-badge";
import { tokens } from "@/theme/tokens";

export default function SharedClinicsScreen() {
  const router = useRouter();
  const salonsQuery = useQuery({
    queryKey: ["shared-clinics"],
    queryFn: () => getPublıcSalonsApi(),
  });

  const salons = Array.isArray(salonsQuery.data) ? salonsQuery.data : [];

  return (
    <AppShell title="Salonları görüntüle" subtitle="Henüz bir salona bağlı değilsen aktif salonları inceleyebilir, ardından davet kodunla bağlanabilirsin." icon="salon" refreshing={salonsQuery.isRefetching} onRefresh={() => void salonsQuery.refetch()}>
      {salons.length === 0 ? (
        <EmptyState title="Aktif salon bulunamadı" description="Şu anda listelenecek bir salon görünmüyor. Daha sonra tekrar deneyebilirsin." icon="salon" />
      ) : (
        salons.map((salon) => (
          <SurfaceCard key={salon.slug} tone={salon.is_boosted ? "primary" : "default"}>
            <View style={styles.headerRow}>
              <View style={styles.copyWrap}>
                <Text style={styles.title}>{salon.tenant_name || salon.name}</Text>
                <Text style={styles.meta}>{[salon.city, salon.district].filter(Boolean).join(" • ") || "Konum bilgisi yakında"}</Text>
              </View>
              {salon.is_boosted ? <StatusBadge label="Öne çıkan" tone="premium" /> : null}
            </View>
            <Text style={styles.body}>{salon.hero_subtitle || salon.about_text || "Salon profili yakında güncellenecek."}</Text>
          </SurfaceCard>
        ))
      )}

      <ActionButton label="Davet kodu ile devam et" icon="trainer" onPress={() => router.push("/(auth)/invite-accept" as never)} />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  copyWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.semibold,
  },
  meta: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  body: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
});
