import { useState } from "react";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ApiClientError } from "@/lib/api-error";
import { useSession } from "@/providers/auth-session";
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
  const { biometricAvailable, biometricEnabled, biometricLabel, deleteAccount, disableBiometricLogin, enableBiometricLogin } = useSession();
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isUpdatingBiometric, setIsUpdatingBiometric] = useState(false);

  const supportUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Fizyoflow hesap desteği")}`;

  const handleDeleteAccount = () => {
    Alert.alert(
      "Hesabı kalıcı sil",
      "Hesabın kapatılacak, kişisel hesap bilgilerin silinecek ve bu cihazdaki oturumun kapatılacak. Bu işlem geri alınamaz.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Devam et",
          style: "destructive",
          onPress: () => {
            Alert.alert("Son onay", "Hesabını kalıcı olarak silmek istediğine emin misin?", [
              { text: "Vazgeç", style: "cancel" },
              {
                text: "Hesabı sil",
                style: "destructive",
                onPress: () => {
                  void (async () => {
                    try {
                      setIsDeletingAccount(true);
                      await deleteAccount();
                      Alert.alert("Hesap silindi", "Hesabın kalıcı olarak silindi.");
                    } catch (error) {
                      const message =
                        error instanceof ApiClientError || error instanceof Error
                          ? error.message
                          : "Hesap silinemedi. Lütfen tekrar deneyin.";
                      Alert.alert("Hesap silinemedi", message);
                    } finally {
                      setIsDeletingAccount(false);
                    }
                  })();
                },
              },
            ]);
          },
        },
      ]
    );
  };

  const handleBiometricToggle = () => {
    void (async () => {
      try {
        setIsUpdatingBiometric(true);
        if (biometricEnabled) {
          await disableBiometricLogin();
          Alert.alert("Hızlı giriş kapatıldı", `${biometricLabel} ile giriş bu cihazda kapatıldı.`);
          return;
        }
        await enableBiometricLogin();
        Alert.alert("Hızlı giriş açıldı", `Sonraki girişlerinde ${biometricLabel} kullanabilirsin.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Hızlı giriş ayarı güncellenemedi.";
        Alert.alert("Hızlı giriş", message);
      } finally {
        setIsUpdatingBiometric(false);
      }
    })();
  };

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
        {biometricAvailable ? (
          <ActionButton
            label={`${biometricLabel} ${biometricEnabled ? "kapat" : "aç"}`}
            icon="shield"
            variant="ghost"
            loading={isUpdatingBiometric}
            onPress={handleBiometricToggle}
          />
        ) : null}
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
          label="Hesabı kalıcı sil"
          icon="risk"
          variant="danger"
          loading={isDeletingAccount}
          onPress={handleDeleteAccount}
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
