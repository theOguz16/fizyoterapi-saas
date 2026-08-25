// Bu sayfa mobil uygulamada auth akisindaki invite accept ekranini temsil eder.
// Ekranin amaci ilgili roldeki kullaniciya bu adimda gereken veri, karar veya aksiyonu sunmaktir.
import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Keyboard, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppFlow } from "@/providers/app-flow";
import { MarketingShell } from "@/theme/components/marketing-shell";
import { MetricCard } from "@/theme/components/metric-card";
import { SurfaceCard } from "@/theme/components/surface-card";
import { FormField } from "@/theme/components/form-field";
import { ActionButton } from "@/theme/components/action-button";
import { useSession } from "@/providers/auth-session";
import { tokens } from "@/theme/tokens";
import { getUserFacingMessage } from "@/lib/user-feedback";
import { invitePreviewApi } from "@/lib/mobile-api";
import {
  createRegistrationLegalConsent,
  EMPTY_LEGAL_CONSENT_SELECTION,
  getLegalConsentValidationMessage,
} from "@/lib/legal-consent";
import { LegalConsentGroup } from "@/theme/components/legal-consent-group";
import { SecurePasswordField } from "@/theme/components/secure-password-field";
import { getPasswordConfirmationMessage, getPasswordValidationMessage } from "@/lib/password-validation";
import { compactFieldErrors, getApiFieldErrors, validateEmail, validatePhone, validateRequired, type FieldErrors, type RegistrationField } from "@/lib/form-validation";

export default function InviteAcceptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const { resetSignupFlow } = useAppFlow();
  const { acceptInvite } = useSession();
  const [form, setForm] = useState({
    token: String(params.token || ""),
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    repeat: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [legalConsent, setLegalConsent] = useState(EMPTY_LEGAL_CONSENT_SELECTION);
  const normalizedToken = form.token.trim();
  const previewQuery = useQuery({
    queryKey: ["invite-preview", normalizedToken],
    queryFn: () => invitePreviewApi(normalizedToken),
    enabled: normalizedToken.length > 8,
  });
  const preview = (previewQuery.data as any)?.data || previewQuery.data || null;
  const identityHint = String(preview?.identity_hint || "");
  const inviteUsesEmail = identityHint.includes("@");
  const isDuoPartnerInvite = String(preview?.kind || "").toUpperCase() === "DUO_PARTNER";
  const repeatPasswordRef = useRef<TextInput>(null);
  const firstNameRef = useRef<TextInput>(null);
  const submittingRef = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<RegistrationField>>({});

  useEffect(() => {
    const routeToken = String(params.token || "").trim();
    if (!routeToken) return;
    setForm((current) => current.token === routeToken ? current : { ...current, token: routeToken });
  }, [params.token]);

  async function handleAccept() {
    if (submittingRef.current) return;
    Keyboard.dismiss();
    const firstName = form.first_name.trim();
    const lastName = form.last_name.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.replace(/\D/g, "");
    const passwordError = getPasswordValidationMessage(form.password);
    const confirmationError = getPasswordConfirmationMessage(form.password, form.repeat);
    const validationErrors = compactFieldErrors<RegistrationField>({
      first_name: validateRequired(firstName, "Ad") || undefined,
      last_name: validateRequired(lastName, "Soyad") || undefined,
      email: !inviteUsesEmail ? validateEmail(email) || undefined : undefined,
      phone: inviteUsesEmail ? validatePhone(phone) || undefined : undefined,
      password: passwordError || undefined,
      repeat: confirmationError || undefined,
    });
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError("İşaretli alanları kontrol et.");
      if (validationErrors.first_name) firstNameRef.current?.focus();
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
      await acceptInvite({
        token: normalizedToken,
        first_name: firstName,
        last_name: lastName,
        phone,
        email,
        password: form.password,
        legal_consent: createRegistrationLegalConsent(legalConsent),
      });
      setForm((current) => ({ ...current, password: "", repeat: "" }));
      resetSignupFlow();
      router.replace("/(auth)/login" as never);
    } catch (err) {
      setFieldErrors(getApiFieldErrors<RegistrationField>(err));
      setError(getUserFacingMessage(err, "Davet tamamlanamadı. Kodunu kontrol edip tekrar dene."));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  function updateField(field: RegistrationField | "token", value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field !== "token") setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setError("");
  }

  return (
    <MarketingShell
      title={isDuoPartnerInvite ? "Duo davetini tamamla" : "Salon davetini tamamla"}
      subtitle={isDuoPartnerInvite ? "Partner olarak ikili derse katılmak için mevcut hesabınla kabul et ya da hesabını oluştur." : "Eğitmen hesabını aktif etmek için sana iletilen davet kodunu gir ve kişisel bilgilerini tamamla."}
      icon={isDuoPartnerInvite ? "members" : "trainer"}
      footer={<ActionButton testID="invite-accept-submit" label="Daveti tamamla" icon="trainer" onPress={handleAccept} loading={loading} />}
    >
      <View style={styles.metricsRow}>
        <MetricCard label="Bağlantı" value={isDuoPartnerInvite ? "Duo partner" : "Salon daveti"} hint="Kod veya QR" icon={isDuoPartnerInvite ? "members" : "trainer"} />
        <MetricCard label="Sonuç" value={isDuoPartnerInvite ? "Ödeme onayı" : "Eğitmen hesabı"} hint={isDuoPartnerInvite ? "Kalan %50" : "Davet zorunlu"} icon="calendar" />
      </View>
      <View>
        {preview ? (
          <SurfaceCard tone="primary">
            <Text style={styles.helper}>
              {isDuoPartnerInvite
                ? `${preview.tenant_name || "Salon"} içinde ${preview.package_title || "duo paket"} partner daveti. Ödenecek pay: ${preview.amount ? `${preview.amount} TL` : "salon onayıyla netleşir"}.`
                : `${preview.tenant_name || "Salon"} daveti bulundu.`}
            </Text>
          </SurfaceCard>
        ) : null}
      </View>
      <SurfaceCard testID="trainer-invite-signup-screen">
        <FormField inputId="invite-accept-token" required label="Davet kodu" value={form.token} onChangeText={(value) => updateField("token", value)} placeholder="Davet kodunu gir" autoCapitalize="none" />
        <FormField ref={firstNameRef} inputId="invite-accept-first-name" errorTestID="invite-accept-first-name-error" required error={fieldErrors.first_name} label="Ad" value={form.first_name} onChangeText={(value) => updateField("first_name", value)} placeholder="Ad" />
        <FormField inputId="invite-accept-last-name" errorTestID="invite-accept-last-name-error" required error={fieldErrors.last_name} label="Soyad" value={form.last_name} onChangeText={(value) => updateField("last_name", value)} placeholder="Soyad" />
        <FormField
          inputId="invite-accept-email"
          label="E-posta"
          value={form.email}
          onChangeText={(value) => updateField("email", value)}
          placeholder={inviteUsesEmail ? identityHint : "ornek@mail.com"}
          autoCapitalize="none"
          keyboardType="email-address"
          required={!inviteUsesEmail}
          error={fieldErrors.email}
          errorTestID="invite-accept-email-error"
          textContentType="emailAddress"
          autoComplete="email"
        />
        <FormField
          inputId="invite-accept-phone"
          label="Telefon"
          value={form.phone}
          onChangeText={(value) => updateField("phone", value)}
          placeholder={!inviteUsesEmail && identityHint ? identityHint : "05xx xxx xx xx"}
          keyboardType="phone-pad"
          required={inviteUsesEmail}
          error={fieldErrors.phone}
          errorTestID="invite-accept-phone-error"
          textContentType="telephoneNumber"
          autoComplete="tel"
        />
        <SecurePasswordField
          inputId="invite-accept-password"
          toggleTestID="trainer-invite-password-toggle"
          label="Şifre"
          value={form.password}
          onChangeText={(value) => updateField("password", value)}
          placeholder="Şifre oluştur"
          intent="new"
          returnKeyType="next"
          onSubmitEditing={() => repeatPasswordRef.current?.focus()}
          showRequirement
          required
          error={fieldErrors.password}
          errorTestID="invite-accept-password-error"
        />
        <SecurePasswordField
          ref={repeatPasswordRef}
          inputId="invite-accept-repeat-password"
          toggleTestID="trainer-invite-password-confirm-toggle"
          label="Şifre tekrar"
          value={form.repeat}
          onChangeText={(value) => updateField("repeat", value)}
          placeholder="Şifreni tekrar et"
          intent="confirmation"
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
          required
          error={fieldErrors.repeat || (form.repeat && form.password !== form.repeat ? "Şifreler eşleşmiyor." : undefined)}
          errorTestID="invite-accept-repeat-error"
        />
        <LegalConsentGroup value={legalConsent} onChange={setLegalConsent} context="INVITE_ACCEPT" />
        {error ? <Text testID="invite-accept-error" style={styles.error}>{error}</Text> : null}
      </SurfaceCard>
      <SurfaceCard>
        <Text style={styles.helper}>{isDuoPartnerInvite ? "Davet tamamlandığında ikinci ödeme onayı salon kuyruğuna düşer. Onaydan sonra ikili ders takvimin aktifleşir." : "Davet tamamlandıktan sonra giriş yapabilir, bağlı olduğun salonun takvimine ve danışan akışına erişebilirsin."}</Text>
      </SurfaceCard>
    </MarketingShell>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
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
