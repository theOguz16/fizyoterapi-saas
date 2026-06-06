import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppFlow } from "@/providers/app-flow";
import { MarketingShell } from "@/theme/components/marketing-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { FormField } from "@/theme/components/form-field";
import { ActionButton } from "@/theme/components/action-button";
import { AppIcon } from "@/theme/components/app-icon";
import { useSession } from "@/providers/auth-session";
import { getSignupOnboardingRole, hasCompletedSignupOnboarding } from "@/lib/local-preferences";
import { getPendingSalonJoinSlug } from "@/lib/local-preferences";
import { tokens } from "@/theme/tokens";
import { getUserFacingMessage } from "@/lib/user-feedback";

const TRUST_SIGNALS = [
  "Üyelik ve rezervasyon bilgileri tek hesapta toplanır",
  "Salon, eğitmen ve üye süreçleri rolüne göre düzenlenir",
  "Bildirimler, programlar ve günlük takip tek akışta ilerler",
];

export default function LoginScreen() {
  const router = useRouter();
  const { resetSignupFlow, resumeSignupFlow, setSelectedPersoma, startSignupFlow } = useAppFlow();
  const { biometricAvailable, biometricEnabled, biometricLabel, login, loginWithBiometrics } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupOnboardingSeen, setSignupOnboardingSeen] = useState(false);
  const [pendingSalonSlug, setPendingSalonSlug] = useState<string | null>(null);
  const introOpacity = useState(() => new Animated.Value(0))[0];
  const introTranslate = useState(() => new Animated.Value(20))[0];

  useEffect(() => {
    hasCompletedSignupOnboarding().then(setSignupOnboardingSeen).catch(() => setSignupOnboardingSeen(false));
    getPendingSalonJoinSlug().then(setPendingSalonSlug).catch(() => setPendingSalonSlug(null));
    resetSignupFlow();
  }, [resetSignupFlow]);

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

  async function handleLogin() {
    try {
      setLoading(true);
      setError("");
      await login({ email: email.trim().toLowerCase(), password });
    } catch (err) {
      setError(getUserFacingMessage(err, "Giriş yapılamadı. Bilgilerini kontrol edip tekrar dene."));
    } finally {
      setLoading(false);
    }
  }

  async function handleBiometricLogin() {
    try {
      setLoading(true);
      setError("");
      await loginWithBiometrics();
    } catch (err) {
      setError(getUserFacingMessage(err, "Hızlı giriş tamamlanamadı. E-posta ve şifrenle giriş yapabilirsin."));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup() {
    if (signupOnboardingSeen) {
      const role = await getSignupOnboardingRole();
      if (role) setSelectedPersoma(role);
      resumeSignupFlow();
    } else startSignupFlow();
    router.push((signupOnboardingSeen ? "/(auth)/register" : "/(auth)/role-assessment") as never);
  }

  return (
    <MarketingShell
      title="Hesabına giriş yap"
      subtitle="Derslerini, üyeliklerini ve salon süreçlerini kaldığın yerden güvenle yönet."
      icon="member"
      animateContent={false}
      footer={<ActionButton testID="login-submit-button" label="Giriş yap" icon="member" onPress={handleLogin} loading={loading} />}
    >
      <Animated.View style={[styles.contentStack, { opacity: introOpacity, transform: [{ translateY: introTranslate }] }]}>
        {pendingSalonSlug ? (
          <SurfaceCard tone="primary" padding="compact">
            <Text style={styles.pendingSalonEyebrow}>Salon seçimi korunuyor</Text>
            <Text style={styles.pendingSalonTitle}>{pendingSalonSlug}</Text>
            <Text style={styles.pendingSalonCopy}>Giriş tamamlanınca bu salonun paket ve kayıt akışına döneceksin.</Text>
          </SurfaceCard>
        ) : null}
        <SurfaceCard padding="hero">
          <FormField
            label="E-posta"
            inputId="login-identity-input"
            value={email}
            onChangeText={setEmail}
            placeholder="ornek@mail.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="username"
          />
          <FormField
            label="Şifre"
            inputId="login-password-input"
            value={password}
            onChangeText={setPassword}
            placeholder="Şifreni gir"
            secureTextEntry
            autoComplete="password"
            textContentType="password"
          />
          {biometricAvailable && biometricEnabled ? (
            <ActionButton
              testID="login-biometric-button"
              label={`${biometricLabel} ile giriş yap`}
              icon="shield"
              variant="ghost"
              onPress={handleBiometricLogin}
              loading={loading}
            />
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.linksColumn}>
            <Pressable onPress={() => router.push("/(auth)/reset-password" as never)} style={({ pressed }) => [styles.linkCard, pressed ? styles.linkCardPressed : null]}>
              <View style={styles.linkIconWrap}>
                <AppIcon name="shield" size="sm" tone="primary" />
              </View>
              <View style={styles.linkCopy}>
                <Text style={styles.linkTitle}>Şifremi unuttum</Text>
                <Text style={styles.linkCaption}>Şifreni yenilemek için doğrulama adımına geç.</Text>
              </View>
              <AppIcon name="arrow-right" size="sm" tone="neutral" variant="plain" />
            </Pressable>
            <Pressable onPress={handleSignup} style={({ pressed }) => [styles.linkCard, pressed ? styles.linkCardPressed : null]}>
              <View style={styles.linkIconWrap}>
                <AppIcon name="spark" size="sm" tone="primary" />
              </View>
              <View style={styles.linkCopy}>
                <Text style={styles.linkTitle}>Hesabın yok mu? Kayıt ol</Text>
                <Text style={styles.linkCaption}>Sana uygun kayıt akışıyla birkaç adımda hesabını oluştur.</Text>
              </View>
              <AppIcon name="arrow-right" size="sm" tone="neutral" variant="plain" />
            </Pressable>
            <Pressable onPress={() => router.push("/(auth)/scan-salon-qr" as never)} style={({ pressed }) => [styles.linkCard, pressed ? styles.linkCardPressed : null]}>
              <View style={styles.linkIconWrap}>
                <AppIcon name="scan" size="sm" tone="primary" />
              </View>
              <View style={styles.linkCopy}>
                <Text style={styles.linkTitle}>Salon QR okut</Text>
                <Text style={styles.linkCaption}>Salondaki onboarding QR kodunu okutup doğru kayıt akışına geç.</Text>
              </View>
              <AppIcon name="arrow-right" size="sm" tone="neutral" variant="plain" />
            </Pressable>
          </View>
        </SurfaceCard>

        <SurfaceCard tone="primary">
          <Text style={styles.panelTitle}>FizyoFlow hesabınla devam et</Text>
          <View style={styles.signalList}>
            {TRUST_SIGNALS.map((item) => (
              <View key={item} style={styles.signalRow}>
                <AppIcon name="spark" size="sm" tone="primary" />
                <Text style={styles.signalText}>{item}</Text>
              </View>
            ))}
          </View>
        </SurfaceCard>
      </Animated.View>
    </MarketingShell>
  );
}

const styles = StyleSheet.create({
  contentStack: {
    gap: tokens.spacing.md,
  },
  pendingSalonEyebrow: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
    textTransform: "uppercase",
  },
  pendingSalonTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.bold,
  },
  pendingSalonCopy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  panelTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  signalList: {
    gap: tokens.spacing.sm,
  },
  signalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  signalText: {
    flex: 1,
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.medium,
  },
  linksColumn: {
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  linkCard: {
    minHeight: 68,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSoft,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  linkCardPressed: {
    transform: [{ scale: 0.99 }],
  },
  linkIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(151,187,156,0.14)",
  },
  linkCopy: {
    flex: 1,
    gap: 2,
  },
  linkTitle: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  linkCaption: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.regular,
  },
  error: {
    color: tokens.colors.danger,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
});
