import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppFlow } from "@/providers/app-flow";
import { useSession } from "@/providers/auth-session";
import { getSignupOnboardingRole } from "@/lib/local-preferences";
import { getPendingSalonJoinSlug } from "@/lib/local-preferences";
import { MarketingShell } from "@/theme/components/marketing-shell";
import { AnimatedEntrance } from "@/theme/components/animated-entrance";
import { SurfaceCard } from "@/theme/components/surface-card";
import { FormField } from "@/theme/components/form-field";
import { ActionButton } from "@/theme/components/action-button";
import { tokens } from "@/theme/tokens";
import { getUserFacingMessage } from "@/lib/user-feedback";

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const { selectedPersoma, resetSignupFlow, setSelectedPersoma, signupOnboarding } = useAppFlow();
  const { register } = useSession();
  const [personaResolved, setPersonaResolved] = useState(Boolean(selectedPersoma));
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    repeat: "",
  });
  const [agreed, setAgreed] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingSalonSlug, setPendingSalonSlug] = useState<string | null>(null);
  const introOpacity = useState(() => new Animated.Value(0))[0];
  const introTranslate = useState(() => new Animated.Value(20))[0];

  useEffect(() => {
    getPendingSalonJoinSlug().then(setPendingSalonSlug).catch(() => setPendingSalonSlug(null));
    const roleFromParams = typeof params.role === "string" ? params.role.toUpperCase() : "";
    if (roleFromParams === "MEMBER" || roleFromParams === "TRAINER" || roleFromParams === "ADMIN") {
      setSelectedPersoma(roleFromParams);
      setPersonaResolved(true);
      return;
    }

    if (selectedPersoma) {
      setPersonaResolved(true);
      return;
    }
    getSignupOnboardingRole()
      .then((role) => {
        if (role) {
          setSelectedPersoma(role);
        }
      })
      .catch(() => null)
      .finally(() => setPersonaResolved(true));
  }, [params.role, selectedPersoma, setSelectedPersoma]);

  useEffect(() => {
    if (!personaResolved) return;
    if (!selectedPersoma) {
      router.replace("/(auth)/role-assessment" as never);
    }
  }, [personaResolved, router, selectedPersoma]);

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
    let nextPersona = selectedPersoma;
    if (!nextPersona) {
      nextPersona = await getSignupOnboardingRole().catch(() => null);
      if (nextPersona) {
        setSelectedPersoma(nextPersona);
      }
    }

    if (!nextPersona) {
      router.replace("/(auth)/role-assessment" as never);
      return;
    }
    if (nextPersona === "TRAINER") {
      router.replace("/(auth)/invite-accept" as never);
      return;
    }
    if (form.password !== form.repeat) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    if (!agreed) {
      setError("KVKK ve kullanım koşullarını onaylamalısın.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await register({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        account_type: nextPersona === "ADMIN" ? "CLINIC_ADMIN" : "MEMBER",
        onboarding_profile: {
          role: nextPersona,
          primary_goal: signupOnboarding.primaryGoal,
          rhythm: signupOnboarding.rhythm,
          support_style: signupOnboarding.supportStyle,
        },
      });
      resetSignupFlow();
    } catch (err) {
      setError(getUserFacingMessage(err, "Hesap oluşturulamadı. Bilgilerini kontrol edip tekrar dene."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <MarketingShell
      title="Hesabını oluştur"
      subtitle={
        selectedPersoma === "ADMIN"
          ? "Yönetici hesabını oluştur. Salon kurulumu ve plan ayarları girişten hemen sonra devam edecek."
          : "Bilgilerini tamamlayarak hesabını oluştur ve sana uygun akışla devam et."
      }
      icon="spark"
      animateContent={false}
      footer={
        <View style={styles.footer}>
          <ActionButton testID="register-submit-button" label="Hesabı oluştur" icon="spark" onPress={handleRegister} loading={loading} />
          <Pressable onPress={() => router.push("/(auth)/login" as never)} style={styles.footerLinkWrap}>
            <Text style={styles.footerLink}>Zaten hesabın var mı? Giriş yap</Text>
          </Pressable>
        </View>
      }
    >
      {!personaResolved ? null : (
      <Animated.View style={[styles.contentStack, { opacity: introOpacity, transform: [{ translateY: introTranslate }] }]}>
        {pendingSalonSlug ? (
          <SurfaceCard tone="primary" padding="compact">
            <Text style={styles.eyebrow}>QR ile secilen salon</Text>
            <Text style={styles.sectionTitle}>{pendingSalonSlug}</Text>
            <Text style={styles.helper}>Kayit bittiginde bu salonun onboarding akisina devam edeceksin.</Text>
          </SurfaceCard>
        ) : null}
        <AnimatedEntrance>
          <SurfaceCard tone="primary" padding="hero">
            <Text style={styles.eyebrow}>{selectedPersoma === "ADMIN" ? "Salon Kurulumu" : "Hızlı Başlangıç"}</Text>
            <Text style={styles.sectionTitle}>{selectedPersoma === "ADMIN" ? "Salon sahibi hesabı" : "Kişisel hesap bilgileri"}</Text>
            <Text style={styles.helper}>
              {selectedPersoma === "ADMIN"
                ? "Bu hesapla salon profilini, ekip davetlerini, paketlerini, çalışma saatlerini ve üyelik süreçlerini yöneteceksin."
                : "Hesabın oluşturulduktan sonra rolüne uygun ekranlar otomatik olarak açılacak."}
            </Text>
            <FormField inputId="register-first-name-input" label="Ad" value={form.first_name} onChangeText={(value) => setForm((prev) => ({ ...prev, first_name: value }))} placeholder="Adın" />
            <FormField inputId="register-last-name-input" label="Soyad" value={form.last_name} onChangeText={(value) => setForm((prev) => ({ ...prev, last_name: value }))} placeholder="Soyadın" />
            <FormField inputId="register-email-input" label="E-posta" value={form.email} onChangeText={(value) => setForm((prev) => ({ ...prev, email: value }))} placeholder="ornek@mail.com" keyboardType="email-address" autoCapitalize="none" />
            <FormField inputId="register-phone-input" label="Telefon" value={form.phone} onChangeText={(value) => setForm((prev) => ({ ...prev, phone: value }))} placeholder="05xx xxx xx xx" keyboardType="phone-pad" />
            <FormField inputId="register-password-input" label="Şifre" value={form.password} onChangeText={(value) => setForm((prev) => ({ ...prev, password: value }))} placeholder="Şifreni oluştur" secureTextEntry />
            <FormField inputId="register-repeat-input" label="Şifre tekrar" value={form.repeat} onChangeText={(value) => setForm((prev) => ({ ...prev, repeat: value }))} placeholder="Şifreni tekrar et" secureTextEntry />
            <Pressable onPress={() => setAgreed((prev) => !prev)} style={({ pressed }) => [styles.checkboxRow, pressed ? styles.checkboxPressed : null]}>
              <View style={[styles.checkboxBox, agreed ? styles.checkboxBoxActive : null]}>
                <Text style={styles.checkboxMark}>{agreed ? "✓" : ""}</Text>
              </View>
              <Text style={styles.checkbox}>KVKK ve kullanım koşullarını kabul ediyorum</Text>
            </Pressable>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </SurfaceCard>
        </AnimatedEntrance>
      </Animated.View>
      )}
    </MarketingShell>
  );
}

const styles = StyleSheet.create({
  contentStack: {
    gap: tokens.spacing.md,
  },
  footer: {
    gap: tokens.spacing.sm,
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
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  checkboxPressed: {
    opacity: 0.92,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: tokens.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxBoxActive: {
    backgroundColor: tokens.colors.primaryStrong,
    borderColor: tokens.colors.primaryStrong,
  },
  checkboxMark: {
    color: "#FFFFFF",
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
  },
  helper: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  checkbox: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.medium,
    flex: 1,
  },
  error: {
    color: tokens.colors.danger,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
});
