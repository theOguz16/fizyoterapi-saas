import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
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

const isE2EMode = process.env.EXPO_PUBLIC_E2E_MODE === "1";

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

  useEffect(() => {
    void getPendingSalonJoinIntent().then((intent) => {
      if (intent?.slug === slug) setJoinSource(intent.source);
    });
  }, [slug]);

  async function handleRegister() {
    if (!slug) {
      setError("Klinik bağlantısı bulunamadı. QR veya salon bağlantısını yeniden aç.");
      return;
    }
    if (form.password !== form.repeat) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    const legalError = getLegalConsentValidationMessage(legalConsent);
    if (legalError) {
      setError(legalError);
      return;
    }

    try {
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
      router.replace({
        pathname: memberBookingDraft.packageId
          ? "/(intake-member)/booking-summary"
          : "/(intake-member)/salons/[slug]",
        params: { slug },
      } as never);
    } catch (err) {
      setError(getUserFacingMessage(err, "Danışan hesabı oluşturulamadı. Bilgilerini kontrol edip tekrar dene."));
    } finally {
      setLoading(false);
    }
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
      <SurfaceCard>
        <FormField inputId="member-register-first-name" label="Ad" value={form.first_name} onChangeText={(value) => setForm((prev) => ({ ...prev, first_name: value }))} placeholder="Adın" />
        <FormField inputId="member-register-last-name" label="Soyad" value={form.last_name} onChangeText={(value) => setForm((prev) => ({ ...prev, last_name: value }))} placeholder="Soyadın" />
        <FormField inputId="member-register-email" label="E-posta" value={form.email} onChangeText={(value) => setForm((prev) => ({ ...prev, email: value }))} placeholder="ornek@mail.com" keyboardType="email-address" autoCapitalize="none" />
        <FormField inputId="member-register-phone" label="Telefon" value={form.phone} onChangeText={(value) => setForm((prev) => ({ ...prev, phone: value }))} placeholder="05xx xxx xx xx" keyboardType="phone-pad" />
        <FormField inputId="member-register-password" label="Şifre" value={form.password} onChangeText={(value) => setForm((prev) => ({ ...prev, password: value, ...(isE2EMode ? { repeat: value } : {}) }))} placeholder="En az 8 karakter" secureTextEntry={!isE2EMode} textContentType={isE2EMode ? "oneTimeCode" : "newPassword"} autoComplete={isE2EMode ? "off" : "new-password"} />
        <FormField inputId="member-register-repeat" label="Şifre tekrar" value={form.repeat} onChangeText={(value) => setForm((prev) => ({ ...prev, repeat: value }))} placeholder="Şifreni tekrar et" secureTextEntry={!isE2EMode} textContentType={isE2EMode ? "oneTimeCode" : "newPassword"} autoComplete={isE2EMode ? "off" : "new-password"} />
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
