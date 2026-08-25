import { useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Keyboard, StyleSheet, Text, TextInput } from "react-native";
import { confirmPasswordResetApi, requestPasswordResetApi } from "@/lib/mobile-api";
import { getUserFacingMessage } from "@/lib/user-feedback";
import { MarketingShell } from "@/theme/components/marketing-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { FormField } from "@/theme/components/form-field";
import { ActionButton } from "@/theme/components/action-button";
import { tokens } from "@/theme/tokens";
import { SecurePasswordField } from "@/theme/components/secure-password-field";
import { getPasswordConfirmationMessage, getPasswordValidationMessage } from "@/lib/password-validation";
import { getApiFieldErrors, validateEmail, type FieldErrors } from "@/lib/form-validation";

type Stage = "REQUEST" | "CONFIRM" | "DONE";
type ResetField = "email" | "token" | "password" | "repeat";

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
  const repeatPasswordRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const tokenRef = useRef<TextInput>(null);
  const submittingRef = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<ResetField>>({});

  async function requestReset() {
    if (submittingRef.current) return;
    const emailError = validateEmail(email);
    if (emailError) {
      setFieldErrors({ email: emailError });
      setError("İşaretli alanı kontrol et.");
      emailRef.current?.focus();
      return;
    }
    try {
      submittingRef.current = true;
      setLoading(true);
      setError("");
      await requestPasswordResetApi(email.trim().toLowerCase());
      setStage("CONFIRM");
    } catch (err) {
      setFieldErrors(getApiFieldErrors<ResetField>(err));
      setError(getUserFacingMessage(err, "Şifre sıfırlama isteği gönderilemedi. Tekrar dene."));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  async function confirmReset() {
    if (submittingRef.current) return;
    if (!token.trim()) {
      setFieldErrors({ token: "E-postana gönderilen doğrulama kodunu gir." });
      setError("İşaretli alanı kontrol et.");
      tokenRef.current?.focus();
      return;
    }
    const passwordError = getPasswordValidationMessage(password);
    if (passwordError) {
      setFieldErrors({ password: passwordError.replace("Şifren", "Yeni şifren") });
      setError("İşaretli alanı kontrol et.");
      return;
    }
    const confirmationError = getPasswordConfirmationMessage(password, repeatPassword);
    if (confirmationError) {
      setFieldErrors({ repeat: "Yeni şifreler birbiriyle eşleşmiyor." });
      setError("İşaretli alanı kontrol et.");
      return;
    }
    try {
      submittingRef.current = true;
      setLoading(true);
      setError("");
      await confirmPasswordResetApi({ token: token.trim(), password });
      setPassword("");
      setRepeatPassword("");
      setStage("DONE");
    } catch (err) {
      setFieldErrors(getApiFieldErrors<ResetField>(err));
      setError(getUserFacingMessage(err, "Şifre değiştirilemedi. Kodunu kontrol edip tekrar dene."));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  function updateField(field: ResetField, value: string) {
    if (field === "email") setEmail(value);
    if (field === "token") setToken(value);
    if (field === "password") setPassword(value);
    if (field === "repeat") setRepeatPassword(value);
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setError("");
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
      <SurfaceCard testID={requesting ? "password-reset-request-screen" : "password-reset-confirm-screen"}>
        {requesting ? (
          <FormField
            ref={emailRef}
            inputId="password-reset-email-input"
            label="E-posta"
            value={email}
            onChangeText={(value) => updateField("email", value)}
            placeholder="ornek@mail.com"
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            required
            error={fieldErrors.email}
            errorTestID="password-reset-email-error"
          />
        ) : (
          <>
            <FormField ref={tokenRef} inputId="password-reset-token-input" errorTestID="password-reset-token-error" required error={fieldErrors.token} label="Doğrulama kodu" value={token} onChangeText={(value) => updateField("token", value)} placeholder="E-postandaki kod" autoCapitalize="none" autoCorrect={false} />
            <SecurePasswordField
              inputId="password-reset-password-input"
              toggleTestID="password-reset-password-toggle"
              label="Yeni şifre"
              value={password}
              onChangeText={(value) => updateField("password", value)}
              placeholder="En az 8 karakter"
              intent="new"
              returnKeyType="next"
              onSubmitEditing={() => repeatPasswordRef.current?.focus()}
              showRequirement
              required
              error={fieldErrors.password}
              errorTestID="password-reset-password-error"
            />
            <SecurePasswordField
              ref={repeatPasswordRef}
              inputId="password-reset-repeat-input"
              toggleTestID="password-reset-password-confirm-toggle"
              label="Yeni şifre tekrar"
              value={repeatPassword}
              onChangeText={(value) => updateField("repeat", value)}
              placeholder="Yeni şifreni tekrar gir"
              intent="confirmation"
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              required
              error={fieldErrors.repeat || (repeatPassword && password !== repeatPassword ? "Yeni şifreler birbiriyle eşleşmiyor." : undefined)}
              errorTestID="password-reset-repeat-error"
            />
            {repeatPassword && password === repeatPassword ? (
              <Text testID="password-reset-repeat-valid" style={styles.valid}>✓ Yeni şifreler eşleşiyor</Text>
            ) : null}
            <ActionButton testID="password-reset-request-again" label="Yeni bağlantı iste" onPress={() => { setError(""); setFieldErrors({}); setStage("REQUEST"); }} variant="ghost" />
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
  valid: {
    color: tokens.colors.success,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
});
