import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Animated, Easing, Keyboard, Pressable, StyleSheet, Text, TextInput } from "react-native";
import { useAppFlow } from "@/providers/app-flow";
import { useSession } from "@/providers/auth-session";
import { MarketingShell } from "@/theme/components/marketing-shell";
import { AnimatedEntrance } from "@/theme/components/animated-entrance";
import { SurfaceCard } from "@/theme/components/surface-card";
import { FormField } from "@/theme/components/form-field";
import { ActionButton } from "@/theme/components/action-button";
import { tokens } from "@/theme/tokens";
import { getUserFacingMessage } from "@/lib/user-feedback";
import {
  createRegistrationLegalConsent,
  EMPTY_LEGAL_CONSENT_SELECTION,
  getLegalConsentValidationMessage,
} from "@/lib/legal-consent";
import { LegalConsentGroup } from "@/theme/components/legal-consent-group";
import { SecurePasswordField } from "@/theme/components/secure-password-field";
import { firstFieldError, getApiFieldErrors, validateRegistrationFields, type FieldErrors, type RegistrationField } from "@/lib/form-validation";

export default function RegisterScreen() {
  const router = useRouter();
  const { resetSignupFlow, setSelectedPersoma, signupOnboarding } = useAppFlow();
  const { register } = useSession();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    repeat: "",
  });
  const [legalConsent, setLegalConsent] = useState(EMPTY_LEGAL_CONSENT_SELECTION);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const introOpacity = useState(() => new Animated.Value(0))[0];
  const introTranslate = useState(() => new Animated.Value(20))[0];
  const repeatPasswordRef = useRef<TextInput>(null);
  const firstNameRef = useRef<TextInput>(null);
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const submittingRef = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<RegistrationField>>({});

  useEffect(() => {
    setSelectedPersoma("ADMIN");
  }, [setSelectedPersoma]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(introOpacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(introTranslate, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [introOpacity, introTranslate]);

  async function handleRegister() {
    if (submittingRef.current) return;
    Keyboard.dismiss();
    const validationErrors = validateRegistrationFields(form);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError("İşaretli alanları kontrol et.");
      const firstError = firstFieldError(validationErrors, ["first_name", "last_name", "email", "phone", "password", "repeat"]);
      if (firstError === "first_name") firstNameRef.current?.focus();
      if (firstError === "last_name") lastNameRef.current?.focus();
      if (firstError === "email") emailRef.current?.focus();
      if (firstError === "phone") phoneRef.current?.focus();
      if (firstError === "password") passwordRef.current?.focus();
      if (firstError === "repeat") repeatPasswordRef.current?.focus();
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
      await register({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        account_type: "CLINIC_ADMIN",
        onboarding_profile: {
          role: "ADMIN",
          primary_goal: signupOnboarding.primaryGoal,
          rhythm: signupOnboarding.rhythm,
          support_style: signupOnboarding.supportStyle,
        },
        legal_consent: createRegistrationLegalConsent(legalConsent),
      });
      setForm((current) => ({ ...current, password: "", repeat: "" }));
      resetSignupFlow();
    } catch (err) {
      setFieldErrors(getApiFieldErrors<RegistrationField>(err));
      setError(getUserFacingMessage(err, "Hesap oluşturulamadı. Bilgilerini kontrol edip tekrar dene."));
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
      title="Hesabını oluştur"
      subtitle="Klinik sahibi hesabını oluştur. Ardından klinik, ilk paket, çalışma saatleri ve QR adımlarını tamamla."
      icon="spark"
      animateContent={false}
      footer={<ActionButton testID="register-submit-button" label="Hesabı oluştur" icon="spark" onPress={handleRegister} loading={loading} />}
    >
      <Animated.View style={[styles.contentStack, { opacity: introOpacity, transform: [{ translateY: introTranslate }] }]}>
        <AnimatedEntrance>
          <SurfaceCard testID="owner-register-screen" tone="primary" padding="hero">
            <Text style={styles.eyebrow}>Klinik Kurulumu</Text>
            <Text style={styles.sectionTitle}>Klinik sahibi hesabı</Text>
            <Text style={styles.helper}>
              Bu hesapla klinik profilini, ekip davetlerini, paketlerini, çalışma saatlerini ve danışan süreçlerini yöneteceksin.
            </Text>
            <FormField ref={firstNameRef} inputId="register-first-name-input" errorTestID="register-first-name-error" required error={fieldErrors.first_name} label="Ad" value={form.first_name} onChangeText={(value) => updateField("first_name", value)} placeholder="Adın" />
            <FormField ref={lastNameRef} inputId="register-last-name-input" errorTestID="register-last-name-error" required error={fieldErrors.last_name} label="Soyad" value={form.last_name} onChangeText={(value) => updateField("last_name", value)} placeholder="Soyadın" />
            <FormField ref={emailRef} inputId="register-email-input" errorTestID="register-email-error" required error={fieldErrors.email} label="E-posta" value={form.email} onChangeText={(value) => updateField("email", value)} placeholder="ornek@mail.com" keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" autoComplete="email" />
            <FormField ref={phoneRef} inputId="register-phone-input" errorTestID="register-phone-error" required error={fieldErrors.phone} label="Telefon" value={form.phone} onChangeText={(value) => updateField("phone", value)} placeholder="05xx xxx xx xx" keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" />
            <SecurePasswordField
              ref={passwordRef}
              inputId="register-password-input"
              toggleTestID="owner-register-password-toggle"
              label="Şifre"
              value={form.password}
              onChangeText={(value) => updateField("password", value)}
              placeholder="Şifreni oluştur"
              intent="new"
              returnKeyType="next"
              onSubmitEditing={() => repeatPasswordRef.current?.focus()}
              showRequirement
              required
              error={fieldErrors.password}
              errorTestID="register-password-error"
            />
            <SecurePasswordField
              ref={repeatPasswordRef}
              inputId="register-repeat-input"
              toggleTestID="owner-register-password-confirm-toggle"
              label="Şifre tekrar"
              value={form.repeat}
              onChangeText={(value) => updateField("repeat", value)}
              placeholder="Şifreni tekrar et"
              intent="confirmation"
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              required
              error={fieldErrors.repeat || (form.repeat && form.password !== form.repeat ? "Şifreler eşleşmiyor." : undefined)}
              errorTestID="register-repeat-error"
            />
            <LegalConsentGroup value={legalConsent} onChange={setLegalConsent} context="CLINIC_OWNER" />
            {error ? <Text testID="register-error" style={styles.error}>{error}</Text> : null}
            <Pressable onPress={() => router.push("/(auth)/login" as never)} style={styles.footerLinkWrap}>
              <Text style={styles.footerLink}>Zaten hesabın var mı? Giriş yap</Text>
            </Pressable>
          </SurfaceCard>
        </AnimatedEntrance>
      </Animated.View>
    </MarketingShell>
  );
}

const styles = StyleSheet.create({
  contentStack: {
    gap: tokens.spacing.md,
  },
  footerLinkWrap: {
    alignItems: "center",
  },
  footerLink: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
    textAlign: "center",
  },
  eyebrow: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
    textTransform: "uppercase",
  },
  sectionTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
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
