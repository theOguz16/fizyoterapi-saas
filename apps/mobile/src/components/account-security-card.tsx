import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ActionButton } from "@/theme/components/action-button";
import { SurfaceCard } from "@/theme/components/surface-card";
import { tokens } from "@/theme/tokens";

const WEB_BASE_URL = "https://fizyoflow.com";
const SUPPORT_EMAIL = "destek@fizyoflow.com";

type AccountSecurityCardProps = {
  backTo: string;
};

async function openExternalUrl(url: string) {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert("Bağlantı açılamadı", "Cihaz bu bağlantıyı açamıyor. Lütfen daha sonra tekrar dene.");
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert("Bağlantı açılamadı", "Lütfen internet bağlantını kontrol edip tekrar dene.");
  }
}

export function AccountSecurityCard({ backTo }: AccountSecurityCardProps) {
  const router = useRouter();

  const supportUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Fizyoflow hesap desteği")}`;

  return (
    <SurfaceCard>
      <Text style={styles.section}>Hesap ve güvenlik</Text>
      <Text style={styles.copy}>Bildirim, destek ve yasal metinlere buradan hızlıca ulaşabilirsin.</Text>
      <View style={styles.actions}>
        <ActionButton
          label="Bildirim ayarları"
          icon="notifications"
          onPress={() => router.push({ pathname: "/(shared)/notification-settings", params: { backTo } } as never)}
        />
        <ActionButton
          label="Şifre yenileme desteği"
          icon="settings"
          variant="ghost"
          onPress={() => void openExternalUrl(supportUrl)}
        />
        <ActionButton
          label="Gizlilik ve KVKK"
          icon="shield"
          variant="ghost"
          onPress={() => void openExternalUrl(`${WEB_BASE_URL}/gizlilik-politikasi`)}
        />
        <ActionButton
          label="Kullanım şartları"
          icon="external"
          variant="ghost"
          onPress={() => void openExternalUrl(`${WEB_BASE_URL}/kullanim-sartlari`)}
        />
        <ActionButton
          label="Hesap silme talebi"
          icon="risk"
          variant="ghost"
          onPress={() =>
            void openExternalUrl(
              `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Fizyoflow hesap silme talebi")}`
            )
          }
        />
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  section: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
    marginBottom: tokens.spacing.xs,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
    marginBottom: tokens.spacing.sm,
  },
  actions: {
    gap: tokens.spacing.xs,
  },
});
