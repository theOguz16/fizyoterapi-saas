// Bu sayfa mobil uygulamada shared akisindaki invite join ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { AppShell } from "@/theme/components/app-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { MetricTile } from "@/theme/components/metric-tile";
import { SectionTitle } from "@/theme/components/section-title";
import { tokens } from "@/theme/tokens";

export default function InviteJoinScreen() {
  const router = useRouter();

  return (
    <AppShell title="Salona bağlan" subtitle="Eğitmen deneyimine devam etmek için bir salon davetiyle hesabını eşleştirmen gerekiyor." icon="trainer">
      <View style={styles.metricsRow}>
        <MetricTile label="Takvim" value="Kilitli" tone="warning" iconName="calendar" />
        <MetricTile label="Danışanlar" value="Beklemede" tone="primary" iconName="members" />
      </View>
      <SurfaceCard tone="primary">
        <SectionTitle title="Salon bağlantısı gerekli" subtitle="Takvim, danışan yönetimi ve check-in ekranları yalnızca aktif salon bağlantısı sonrası açılır." />
        <Text style={styles.copy}>Henüz bir salona bağlı değilsen önce aktif salonları inceleyebilir, ardından davet kodunla hesabını bağlayabilirsin.</Text>
      </SurfaceCard>
      <SurfaceCard>
        <Text style={styles.copy}>Davet kodu tamamlandıktan sonra uzmanlık, çalışma alanı ve bağlı salon bilgileri hesabına işlenir. Sonrasında eğitmen ana sayfası ve takvim ekranları açılır.</Text>
      </SurfaceCard>
      <ActionButton label="Davet kodu gir" icon="trainer" onPress={() => router.replace("/(auth)/invite-accept" as never)} />
      <ActionButton label="Salonları görüntüle" icon="salon" variant="ghost" onPress={() => router.push({ pathname: "/(shared)/clinics", params: { backTo: "/(shared)/invite-join" } } as never)} />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    gap: tokens.spacing.sm,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
});
