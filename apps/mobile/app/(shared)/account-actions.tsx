import { useState } from "react";
import { Alert, Linking, StyleSheet, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ApiClientError } from "@/lib/api-error";
import { getAccountActionsForRole } from "@/lib/account-settings";
import { showSuccessNotice } from "@/lib/user-feedback";
import { useSession } from "@/providers/auth-session";
import { ActionButton } from "@/theme/components/action-button";
import { AppShell } from "@/theme/components/app-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { tokens } from "@/theme/tokens";

const SUPPORT_EMAIL = "destek@fizyoflow.com";

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AccountActionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ backTo?: string | string[]; profileBackTo?: string | string[] }>();
  const { user, logout, deleteAccount } = useSession();
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const accountActions = getAccountActionsForRole(user?.role);
  const profileBackTo = firstParam(params.profileBackTo);
  const accountSettingsBackTo = firstParam(params.backTo) || "/(shared)/account-settings";
  const canLeaveSalon = accountActions.some((item) => item.id === "LEAVE_SALON");

  function goBack() {
    router.replace({
      pathname: accountSettingsBackTo,
      params: profileBackTo ? { backTo: profileBackTo } : undefined,
    } as never);
  }

  function handleDeleteAccount() {
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
                      showSuccessNotice("Hesap silindi", "Hesabın kalıcı olarak silindi.");
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
  }

  return (
    <AppShell
      testID="account-actions-screen"
      title="Hesap işlemleri"
      subtitle="Destek, oturum ve üyelik işlemlerini buradan yönet."
      icon="profile"
      onBack={goBack}
    >
      {canLeaveSalon ? (
        <SurfaceCard tone="warning">
          <Text style={styles.dangerTitle}>Salon üyeliği</Text>
          <Text style={styles.copy}>Salondan ayrıldığında aktif paket ve ders bağlantıların etkilenebilir.</Text>
          <ActionButton
            testID="account-actions-leave-salon"
            label="Salondan ayrıl"
            icon="risk"
            variant="danger"
            onPress={() =>
              router.push({
                pathname: "/(shared)/leave-salon",
                params: { backTo: "/(shared)/account-actions", profileBackTo },
              } as never)
            }
          />
        </SurfaceCard>
      ) : null}

      <SurfaceCard>
        <Text style={styles.section}>Destek ve oturum</Text>
        <ActionButton
          testID="account-actions-support"
          label="Hesap desteği"
          icon="email"
          variant="ghost"
          onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Fizyoflow hesap desteği")}`)}
        />
        <ActionButton
          testID="account-actions-logout"
          label="Çıkış yap"
          icon="logout"
          variant="ghost"
          onPress={() => void logout()}
        />
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.dangerTitle}>Kalıcı hesap işlemleri</Text>
        <Text style={styles.copy}>Hesap silme işlemi geri alınamaz ve tüm rollerini etkiler.</Text>
        <ActionButton
          testID="account-actions-delete-account"
          label="Hesabı kalıcı sil"
          icon="risk"
          variant="danger"
          loading={isDeletingAccount}
          onPress={handleDeleteAccount}
        />
      </SurfaceCard>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  section: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  dangerTitle: {
    color: tokens.colors.danger,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
});
