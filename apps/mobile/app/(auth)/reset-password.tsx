import { useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { confirmPasswordResetApi, requestPasswordResetApi } from "@/lib/mobile-api";
import { getUserFacingMessage } from "@/lib/user-feedback";
import { MarketingShell } from "@/theme/components/marketing-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { FormField } from "@/theme/components/form-field";
import { ActionButton } from "@/theme/components/action-button";
import { tokens } from "@/theme/tokens";

type Stage = "REQUEST" | "CONFIRM" | "DONE";
const isE2EMode = process.env.EXPO_PUBLIC_E2E_MODE === "1";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const initialToken = useMemo(() => String(params.token || "").trim(), [params.token]);
  const [stage, setStage] = useState<Stage>(initialToken ? "CONFIRM" : "REQUEST");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function requestReset() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Geçerli bir e-posta adresi gir.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      await requestPasswordResetApi(email.trim().toLowerCase());
      setStage("CONFIRM");
    } catch (err) {
      setError(getUserFacingMessage(err, "Şifre sıfırlama isteği gönderilemedi. Tekrar dene."));
    } finally {
      setLoading(false);
    }
  }

  async function confirmReset() {
    if (!token.trim()) {
      setError("E-postana gönderilen doğrulama kodunu gir.");
      return;
    }
    if (password.length < 8) {
      setError("Yeni şifren en az 8 karakter olmalıdır.");
      return;
    }
    if (password !== repeatPassword) {
      setError("Yeni şifreler birbiriyle eşleşmiyor.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      await confirmPasswordResetApi({ token: token.trim(), password });
      setPassword("");
      setRepeatPassword("");
      setStage("DONE");
    } catch (err) {
      setError(getUserFacingMessage(err, "Şifre değiştirilemedi. Kodunu kontrol edip tekrar dene."));
    } finally {
      setLoading(false);
    }
  }

  if (stage === "DONE") {
    return (
      <MarketingShell
        title="Şifren güncellendi"
        subtitle="Tüm eski oturumların kapatıldı. Yeni şifrenle güvenle giriş yapabilirsin."
        icon="settings"
        footer={<ActionButton testID="password-reset-login" label="Giriş yap" icon="member" onPress={() => router.replace("/(auth)/login" as never)} />}
      >
        <SurfaceCard testID="password-reset-success" tone="primary">
          <Text style={styles.helper}>Yeni şifren aktif. Güvenliğin için diğer cihazlardaki oturumların da yeniden giriş yapması gerekir.</Text>
        </SurfaceCard>
      </MarketingShell>
    );
  }

  const requesting = stage === "REQUEST";
  return (
    <MarketingShell
      title="Şifreni sıfırla"
      subtitle={requesting ? "Hesabına bağlı e-posta adresini gir. Sana 30 dakika geçerli güvenli bir bağlantı göndereceğiz." : "E-postandaki bağlantıyı aç veya doğrulama kodunu girerek yeni şifreni belirle."}
      icon="settings"
      footer={
        <ActionButton
          testID={requesting ? "password-reset-request-submit" : "password-reset-confirm-submit"}
          label={requesting ? "Sıfırlama bağlantısı gönder" : "Yeni şifreyi kaydet"}
          icon={requesting ? "notifications" : "settings"}
          onPress={requesting ? requestReset : confirmReset}
          loading={loading}
        />
      }
    >
      <SurfaceCard>
        {requesting ? (
          <FormField
            inputId="password-reset-email-input"
            label="E-posta"
            value={email}
            onChangeText={setEmail}
            placeholder="ornek@mail.com"
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
          />
        ) : (
          <>
            <FormField inputId="password-reset-token-input" label="Doğrulama kodu" value={token} onChangeText={setToken} placeholder="E-postandaki kod" autoCapitalize="none" autoCorrect={false} />
            <FormField inputId="password-reset-password-input" label="Yeni şifre" value={password} onChangeText={(value) => { setPassword(value); if (isE2EMode) setRepeatPassword(value); }} placeholder="En az 8 karakter" secureTextEntry={!isE2EMode} textContentType={isE2EMode ? "oneTimeCode" : "newPassword"} autoComplete={isE2EMode ? "off" : "new-password"} />
            <FormField inputId="password-reset-repeat-input" label="Yeni şifre tekrar" value={repeatPassword} onChangeText={setRepeatPassword} placeholder="Yeni şifreni tekrar gir" secureTextEntry={!isE2EMode} textContentType={isE2EMode ? "oneTimeCode" : "newPassword"} autoComplete={isE2EMode ? "off" : "new-password"} />
            <ActionButton testID="password-reset-request-again" label="Yeni bağlantı iste" onPress={() => { setError(""); setStage("REQUEST"); }} variant="ghost" />
          </>
        )}
        {error ? <Text testID="password-reset-error" style={styles.error}>{error}</Text> : null}
        {stage === "CONFIRM" && email ? <Text testID="password-reset-request-accepted" style={styles.helper}>Hesap bu e-postayla kayıtlıysa bağlantı gönderildi. Gelen kutunu ve spam klasörünü kontrol et.</Text> : null}
      </SurfaceCard>
    </MarketingShell>
  );
}

const styles = StyleSheet.create({
  helper: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  error: {
    color: tokens.colors.danger,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
});
