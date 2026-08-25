import { useState } from "react";
import { Alert, Linking, StyleSheet, Text } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getUserFacingMessage, showSuccessNotice } from "@/lib/user-feedback";
import { useSession } from "@/providers/auth-session";
import { ActionButton } from "@/theme/components/action-button";
import { AppShell } from "@/theme/components/app-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { tokens } from "@/theme/tokens";
import { changePasswordApi } from "@/lib/mobile-api";
import { SecurePasswordField } from "@/theme/components/secure-password-field";
import { getPasswordConfirmationMessage, getPasswordValidationMessage } from "@/lib/password-validation";

const WEB_BASE_URL = "https://fizyoflow.com";
const SUPPORT_EMAIL = "destek@fizyoflow.com";

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

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

export default function SecuritySettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ backTo?: string | string[]; profileBackTo?: string | string[] }>();
  const { biometricAvailable, biometricEnabled, biometricLabel, disableBiometricLogin, enableBiometricLogin, logout } = useSession();
  const [isUpdatingBiometric, setIsUpdatingBiometric] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const profileBackTo = firstParam(params.profileBackTo);
  const accountSettingsBackTo = firstParam(params.backTo) || "/(shared)/account-settings";

  function goBack() {
    router.replace({
      pathname: accountSettingsBackTo,
      params: profileBackTo ? { backTo: profileBackTo } : undefined,
    } as never);
  }

  function handleBiometricToggle() {
    void (async () => {
      try {
        setIsUpdatingBiometric(true);
        if (biometricEnabled) {
          await disableBiometricLogin();
          showSuccessNotice("Hızlı giriş kapatıldı", `${biometricLabel} ile giriş bu cihazda kapatıldı.`);
        } else {
          await enableBiometricLogin();
          showSuccessNotice("Hızlı giriş açıldı", `Sonraki girişlerinde ${biometricLabel} kullanabilirsin.`);
        }
      } catch (error) {
        Alert.alert("Hızlı giriş", error instanceof Error ? error.message : "Hızlı giriş ayarı güncellenemedi.");
      } finally {
        setIsUpdatingBiometric(false);
      }
    })();
  }

  const supportUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Fizyoflow şifre yenileme desteği")}`;
  const passwordMutation = useMutation({
    mutationFn: () => changePasswordApi({ current_password: currentPassword, new_password: newPassword }),
    onSuccess: async () => {
      showSuccessNotice("Şifre değiştirildi", "Güvenliğin için tüm oturumlar kapatıldı. Yeni şifrenle tekrar giriş yapabilirsin.");
      await logout();
    },
    onError: (error) => setPasswordError(getUserFacingMessage(error, "Şifre değiştirilemedi.")),
  });

  function handlePasswordChange() {
    const strengthError = getPasswordValidationMessage(newPassword);
    const confirmationError = getPasswordConfirmationMessage(newPassword, confirmPassword);
    if (!currentPassword) return setPasswordError("Mevcut şifreni gir.");
    if (strengthError) return setPasswordError(strengthError);
    if (confirmationError) return setPasswordError(confirmationError);
    setPasswordError("");
    passwordMutation.mutate();
  }

  return (
    <AppShell
      testID="security-settings-screen"
      title="Güvenlik ve şifre"
      subtitle="Hızlı giriş, şifre desteği ve yasal hesap bilgilerini yönet."
      icon="shield"
      onBack={goBack}
    >
      <SurfaceCard>
        <Text style={styles.section}>Giriş güvenliği</Text>
        <Text style={styles.copy}>Bu cihazdaki hızlı giriş tercihini ve şifre desteğini yönet.</Text>
        {biometricAvailable ? (
          <ActionButton
            testID="security-settings-biometric"
            label={`${biometricLabel} ${biometricEnabled ? "kapat" : "aç"}`}
            icon="shield"
            loading={isUpdatingBiometric}
            onPress={handleBiometricToggle}
          />
        ) : null}
        <SecurePasswordField label="Mevcut şifre" inputId="security-current-password" toggleTestID="security-current-password-toggle" value={currentPassword} onChangeText={setCurrentPassword} intent="current" />
        <SecurePasswordField label="Yeni şifre" inputId="security-new-password" toggleTestID="security-new-password-toggle" value={newPassword} onChangeText={setNewPassword} intent="new" />
        <SecurePasswordField label="Yeni şifre tekrar" inputId="security-confirm-password" toggleTestID="security-confirm-password-toggle" value={confirmPassword} onChangeText={setConfirmPassword} intent="new" />
        {passwordError ? <Text testID="security-password-error" accessibilityRole="alert" style={styles.error}>{passwordError}</Text> : null}
        <ActionButton testID="security-settings-change-password" label="Şifreyi değiştir" icon="shield" onPress={handlePasswordChange} loading={passwordMutation.isPending} />
        <ActionButton testID="security-settings-password-reset" label="Şifre desteği al" icon="settings" variant="ghost" onPress={() => void openExternalUrl(supportUrl)} />
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.section}>Yasal bilgiler</Text>
        <ActionButton
          testID="security-settings-privacy"
          label="Gizlilik ve KVKK"
          icon="shield"
          variant="ghost"
          onPress={() => void openExternalUrl(`${WEB_BASE_URL}/gizlilik-politikasi`)}
        />
        <ActionButton
          testID="security-settings-terms"
          label="Kullanım şartları"
          icon="external"
          variant="ghost"
          onPress={() => void openExternalUrl(`${WEB_BASE_URL}/kullanim-sartlari`)}
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
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  error: {
    color: tokens.colors.danger,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.medium,
  },
});
