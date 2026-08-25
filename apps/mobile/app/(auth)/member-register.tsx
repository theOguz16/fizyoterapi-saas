import { useEffect, useRef, useState } from "react";
import { Keyboard, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getPendingSalonJoinIntent, type SalonJoinIntentSource } from "@/lib/local-preferences";
import { getUserFacingMessage } from "@/lib/user-feedback";
import { useAppFlow } from "@/providers/app-flow";
import { useSession } from "@/providers/auth-session";
import { MarketingShell } from "@/theme/components/marketing-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { FormField } from "@/theme/components/form-field";
import { ActionButton } from "@/theme/components/action-button";
import { tokens } from "@/theme/tokens";
import {
  createRegistrationLegalConsent,
  EMPTY_LEGAL_CONSENT_SELECTION,
  getLegalConsentValidationMessage,
} from "@/lib/legal-consent";
import { LegalConsentGroup } from "@/theme/components/legal-consent-group";
import { SecurePasswordField } from "@/theme/components/secure-password-field";
import { firstFieldError, getApiFieldErrors, validateRegistrationFields, type FieldErrors, type RegistrationField } from "@/lib/form-validation";

export default function ClinicMemberRegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = String(params.slug || "").trim().toLowerCase();
  const { memberBookingDraft } = useAppFlow();
  const { registerClinicMember } = useSession();
  const [joinSource, setJoinSource] = useState<SalonJoinIntentSource>("DEEPLINK");
  const [legalConsent, setLegalConsent] = useState(EMPTY_LEGAL_CONSENT_SELECTION);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    repeat: "",
  });
  const repeatPasswordRef = useRef<TextInput>(null);
  const firstNameRef = useRef<TextInput>(null);
  const submittingRef = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<RegistrationField>>({});

  useEffect(() => {
    void getPendingSalonJoinIntent().then((intent) => {
      if (intent?.slug === slug) setJoinSource(intent.source);
    });
  }, [slug]);

  async function handleRegister() {
    if (submittingRef.current) return;
    Keyboard.dismiss();
    if (!slug) {
      setError("Klinik bağlantısı bulunamadı. QR veya salon bağlantısını yeniden aç.");
      return;
    }
    const validationErrors = validateRegistrationFields(form);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError("İşaretli alanları kontrol et.");
      if (firstFieldError(validationErrors, ["first_name", "last_name", "email", "phone", "password", "repeat"]) === "first_name") firstNameRef.current?.focus();
      return;
    }
    const legalError = getLegalConsentValidationMessage(legalConsent);
    if (legalError) {
      setError(legalError);
      return;
    }

    try {
      submittingRef.current = true;
      setLoading(true);
      setError("");
      await registerClinicMember({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        tenant_slug: slug,
        join_source: joinSource,
        legal_consent: createRegistrationLegalConsent(legalConsent),
      });
      setForm((current) => ({ ...current, password: "", repeat: "" }));
      router.replace({
        pathname: memberBookingDraft.packageId
          ? "/(intake-member)/booking-summary"
          : "/(intake-member)/salons/[slug]",
        params: { slug },
      } as never);
    } catch (err) {
      setFieldErrors(getApiFieldErrors<RegistrationField>(err));
      setError(getUserFacingMessage(err, "Danışan hesabı oluşturulamadı. Bilgilerini kontrol edip tekrar dene."));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  function updateField(field: RegistrationField, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setError("");
  }

  return (
    <MarketingShell
      title="Danışan hesabını oluştur"
      subtitle="Hesabın yalnızca seçtiğin klinikteki paket ve başvuru akışına devam etmek için oluşturulur. Klinik onayı ayrıca gerekir."
      icon="member"
      footer={
        <View style={styles.footer}>
          <ActionButton
            testID="clinic-member-register-submit"
            label="Hesabı oluştur ve devam et"
            icon="member"
            onPress={handleRegister}
            loading={loading}
          />
          <ActionButton
            label="Danışan hesabımla giriş yap"
            icon="member"
            variant="ghost"
            onPress={() => router.replace("/(auth)/login" as never)}
          />
        </View>
      }
    >
      <SurfaceCard tone="primary" padding="compact">
        <Text style={styles.eyebrow}>Seçili klinik</Text>
        <Text style={styles.clinic}>{memberBookingDraft.salonName || slug || "Klinik bağlantısı eksik"}</Text>
        <Text style={styles.helper}>QR veya bağlantı hesabını otomatik üye yapmaz; paket ve saatlerin klinik onayına gönderilir.</Text>
      </SurfaceCard>
      <SurfaceCard testID="member-register-screen">
        <FormField ref={firstNameRef} inputId="member-register-first-name" errorTestID="member-register-first-name-error" required error={fieldErrors.first_name} label="Ad" value={form.first_name} onChangeText={(value) => updateField("first_name", value)} placeholder="Adın" />
        <FormField inputId="member-register-last-name" errorTestID="member-register-last-name-error" required error={fieldErrors.last_name} label="Soyad" value={form.last_name} onChangeText={(value) => updateField("last_name", value)} placeholder="Soyadın" />
        <FormField inputId="member-register-email" errorTestID="member-register-email-error" required error={fieldErrors.email} label="E-posta" value={form.email} onChangeText={(value) => updateField("email", value)} placeholder="ornek@mail.com" keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" autoComplete="email" />
        <FormField inputId="member-register-phone" errorTestID="member-register-phone-error" required error={fieldErrors.phone} label="Telefon" value={form.phone} onChangeText={(value) => updateField("phone", value)} placeholder="05xx xxx xx xx" keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" />
        <SecurePasswordField
          inputId="member-register-password"
          toggleTestID="member-register-password-toggle"
          label="Şifre"
          value={form.password}
          onChangeText={(value) => updateField("password", value)}
          placeholder="En az 8 karakter"
          intent="new"
          returnKeyType="next"
          onSubmitEditing={() => repeatPasswordRef.current?.focus()}
          showRequirement
          required
          error={fieldErrors.password}
          errorTestID="member-register-password-error"
        />
        <SecurePasswordField
          ref={repeatPasswordRef}
          inputId="member-register-repeat"
          toggleTestID="member-register-password-confirm-toggle"
          label="Şifre tekrar"
          value={form.repeat}
          onChangeText={(value) => updateField("repeat", value)}
          placeholder="Şifreni tekrar et"
          intent="confirmation"
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
          required
          error={fieldErrors.repeat || (form.repeat && form.password !== form.repeat ? "Şifreler eşleşmiyor." : undefined)}
          errorTestID="member-register-repeat-error"
        />
        <LegalConsentGroup value={legalConsent} onChange={setLegalConsent} context="CLINIC_MEMBER" />
        {error ? <Text testID="member-register-error" style={styles.error}>{error}</Text> : null}
      </SurfaceCard>
    </MarketingShell>
  );
}

const styles = StyleSheet.create({
  footer: { gap: tokens.spacing.sm },
  eyebrow: { color: tokens.colors.primaryStrong, fontSize: tokens.font.xs, fontFamily: tokens.fontFamily.bold },
  clinic: { color: tokens.colors.text, fontSize: tokens.font.lg, fontFamily: tokens.fontFamily.bold },
  helper: { color: tokens.colors.textMuted, fontSize: tokens.font.sm, lineHeight: tokens.lineHeight.normal, fontFamily: tokens.fontFamily.regular },
  error: { color: tokens.colors.danger, fontSize: tokens.font.xs, fontFamily: tokens.fontFamily.medium },
});
