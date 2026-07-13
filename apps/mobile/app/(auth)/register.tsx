import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppFlow } from "@/providers/app-flow";
import { useSession } from "@/providers/auth-session";
import { MarketingShell } from "@/theme/components/marketing-shell";
import { AnimatedEntrance } from "@/theme/components/animated-entrance";
import { SurfaceCard } from "@/theme/components/surface-card";
import { FormField } from "@/theme/components/form-field";
import { ActionButton } from "@/theme/components/action-button";
import { tokens } from "@/theme/tokens";
import { getUserFacingMessage } from "@/lib/user-feedback";

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
  const [agreed, setAgreed] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const introOpacity = useState(() => new Animated.Value(0))[0];
  const introTranslate = useState(() => new Animated.Value(20))[0];

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
        account_type: "CLINIC_ADMIN",
        onboarding_profile: {
          role: "ADMIN",
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
      subtitle="Klinik sahibi hesabını oluştur. Klinik kurulumu ve plan ayarları girişten hemen sonra devam edecek."
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
      <Animated.View style={[styles.contentStack, { opacity: introOpacity, transform: [{ translateY: introTranslate }] }]}>
        <AnimatedEntrance>
          <SurfaceCard tone="primary" padding="hero">
            <Text style={styles.eyebrow}>Klinik Kurulumu</Text>
            <Text style={styles.sectionTitle}>Klinik sahibi hesabı</Text>
            <Text style={styles.helper}>
              Bu hesapla klinik profilini, ekip davetlerini, paketlerini, çalışma saatlerini ve danışan süreçlerini yöneteceksin.
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
