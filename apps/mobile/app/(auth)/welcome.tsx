import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Animated, Easing, InteractionManager, StyleSheet, Text, View } from "react-native";
import { useAppFlow } from "@/providers/app-flow";
import { getPendingSalonJoinSlug } from "@/lib/local-preferences";
import { MarketingShell } from "@/theme/components/marketing-shell";
import { AnimatedEntrance } from "@/theme/components/animated-entrance";
import { SurfaceCard } from "@/theme/components/surface-card";
import { ActionButton } from "@/theme/components/action-button";
import { AppIcon } from "@/theme/components/app-icon";
import { getSignupOnboardingRole, hasCompletedSignupOnboarding } from "@/lib/local-preferences";
import { tokens } from "@/theme/tokens";
import { trackProductEvent } from "@/lib/product-analytics";

const HIGHLIGHTS = [
  { icon: "calendar" as const, title: "Seans planlama", copy: "Takvim ve rezervasyonlar tek yerde." },
  { icon: "members" as const, title: "Danışan yönetimi", copy: "Kayıt, paket ve gelişim tek akışta." },
  { icon: "trainer" as const, title: "Ekip düzeni", copy: "Program ve sorumluluklar netleşir." },
  { icon: "measurements" as const, title: "Süreç takibi", copy: "Seans, katılım ve ölçümler görünür kalır." },
  { icon: "notifications" as const, title: "Bilgilendirme", copy: "Doğru kişiye, doğru anda ulaşır." },
  { icon: "dashboard" as const, title: "Yönetim görünümü", copy: "Kliniğin tüm operasyonu tek merkezden izlenir." },
];

const LIVE_ITEMS = [
  { icon: "calendar" as const, label: "Bugünün seansları", value: "Hazır" },
  { icon: "trainer" as const, label: "Ekip programı", value: "Hazır" },
  { icon: "member" as const, label: "Danışan takibi", value: "Açık" },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { resetSignupFlow, resumeSignupFlow, setSelectedPersoma, startSignupFlow } = useAppFlow();
  const [signupOnboardingSeen, setSignupOnboardingSeen] = useState(false);
  const [isRoutingSignup, setIsRoutingSignup] = useState(false);
  const [pendingSalonSlug, setPendingSalonSlug] = useState<string | null>(null);
  const introOpacity = useState(() => new Animated.Value(0))[0];
  const introTranslate = useState(() => new Animated.Value(18))[0];
  const orbScale = useState(() => new Animated.Value(0.96))[0];
  const orbShift = useState(() => new Animated.Value(0))[0];
  const pulse = useState(() => new Animated.Value(0))[0];

  const liveRows = useMemo(() => LIVE_ITEMS, []);

  useEffect(() => {
    hasCompletedSignupOnboarding().then(setSignupOnboardingSeen).catch(() => setSignupOnboardingSeen(false));
    getSignupOnboardingRole().then((role) => role && setSelectedPersoma(role)).catch(() => null);
    getPendingSalonJoinSlug().then(setPendingSalonSlug).catch(() => setPendingSalonSlug(null));
    resetSignupFlow();
  }, [resetSignupFlow, setSelectedPersoma]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(introOpacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(introTranslate, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [introOpacity, introTranslate]);

  useEffect(() => {
    const floatingLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(orbScale, {
            toValue: 1.04,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(orbShift, {
            toValue: -8,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(orbScale, {
            toValue: 0.97,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(orbShift, {
            toValue: 6,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    floatingLoop.start();
    pulseLoop.start();

    return () => {
      floatingLoop.stop();
      pulseLoop.stop();
    };
  }, [orbScale, orbShift, pulse]);

  async function handleSignup() {
    if (isRoutingSignup) return;
    setIsRoutingSignup(true);
    void trackProductEvent(
      "clinic_signup_started",
      { screen: "welcome", source: "primary_cta" },
      { oncePerSession: true }
    );

    let nextRoute: "/(auth)/register" | "/(auth)/role-assessment" = "/(auth)/role-assessment";

    if (signupOnboardingSeen) {
      const role = await getSignupOnboardingRole();
      if (role) setSelectedPersoma(role);
      resumeSignupFlow();
      nextRoute = "/(auth)/register";
    } else {
      startSignupFlow();
    }

    InteractionManager.runAfterInteractions(() => {
      router.push(nextRoute as never);
      setIsRoutingSignup(false);
    });
  }

  return (
    <MarketingShell
      title="Klinik ve salon yönetimi, tek merkezde."
      subtitle="Seans, paket, ekip ve danışan süreçlerini tek uygulamadan yönet."
      icon="spark"
      animateContent={false}
      footer={
        <View style={styles.footer}>
          <AnimatedEntrance delay={170}>
            <ActionButton testID="welcome-signup-button" label="Kliniğini kurmaya başla" icon="spark" onPress={handleSignup} loading={isRoutingSignup} />
          </AnimatedEntrance>
          <AnimatedEntrance delay={240}>
            <ActionButton testID="welcome-login-button" label="Giriş yap" icon="member" variant="ghost" onPress={() => router.push("/(auth)/login" as never)} />
          </AnimatedEntrance>
          <AnimatedEntrance delay={300}>
            <ActionButton testID="welcome-scan-salon-qr-button" label="Salon QR okut" icon="scan" variant="ghost" onPress={() => router.push("/(auth)/scan-salon-qr" as never)} />
          </AnimatedEntrance>
          <AnimatedEntrance delay={360}>
            <ActionButton testID="welcome-invite-code-button" label="Davet koduyla katıl" icon="trainer" variant="ghost" onPress={() => router.push("/(auth)/invite-accept" as never)} />
          </AnimatedEntrance>
        </View>
      }
    >
      <Animated.View style={[styles.contentStack, { opacity: introOpacity, transform: [{ translateY: introTranslate }] }]}>
        {pendingSalonSlug ? (
          <AnimatedEntrance delay={40}>
            <SurfaceCard tone="primary" padding="compact">
              <Text style={styles.pendingSalonEyebrow}>QR ile devam ediyorsun</Text>
              <Text style={styles.pendingSalonTitle}>{pendingSalonSlug}</Text>
              <Text style={styles.pendingSalonCopy}>Giriş veya kayıt sonrasında bu salonun onboarding akışı açılacak.</Text>
            </SurfaceCard>
          </AnimatedEntrance>
        ) : null}
        <AnimatedEntrance>
          <SurfaceCard tone="primary" padding="hero" style={styles.heroCard}>
            <View style={styles.heroBackdrop}>
              <View style={styles.heroMeshTop} />
              <View style={styles.heroMeshBottom} />
              <View style={styles.heroGradientBandTop} />
              <View style={styles.heroGradientBandBottom} />
              <Animated.View
                style={[
                  styles.heroOrbLarge,
                  {
                    transform: [{ translateY: orbShift }, { scale: orbScale }],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.heroOrbSmall,
                  {
                    opacity: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.35, 0.8],
                    }),
                    transform: [
                      {
                        scale: pulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.92, 1.08],
                        }),
                      },
                    ],
                  },
                ]}
              />
            </View>

            <View style={styles.heroTopRow}>
              <View style={styles.brandPill}>
                <AppIcon name="spark" size="sm" active />
                <Text style={styles.brandPillText}>FizyoFlow</Text>
              </View>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.livePillText}>Canlı akış</Text>
              </View>
            </View>

            <Text style={styles.heroTitle}>Kliniğinin tüm operasyonunu tek yerden yönet.</Text>
            <Text style={styles.body}>Ekibini, danışanlarını, seanslarını ve paketlerini aynı güncel akışta buluştur.</Text>

            <View style={styles.previewStack}>
              <AnimatedEntrance delay={90}>
                <View style={styles.previewMainCard}>
                  <View style={styles.previewHeader}>
                    <Text style={styles.previewTitle}>Bugünün akışı</Text>
                    <View style={styles.previewPulse} />
                  </View>
                  {liveRows.map((item) => (
                    <View key={item.label} style={styles.previewRow}>
                      <View style={styles.previewRowLeft}>
                        <AppIcon name={item.icon} size="sm" tone="primary" />
                        <View style={styles.previewTextWrap}>
                          <Text style={styles.previewLabel}>{item.label}</Text>
                          <Text style={styles.previewValue}>{item.value}</Text>
                        </View>
                      </View>
                      <Text style={styles.previewMeta}>Aktif</Text>
                    </View>
                  ))}
                </View>
              </AnimatedEntrance>
            </View>
          </SurfaceCard>
        </AnimatedEntrance>

        <AnimatedEntrance delay={120}>
          <SurfaceCard padding="hero">
            <Text style={styles.sectionEyebrow}>Neler kolaylaşıyor?</Text>
            <View style={styles.highlightList}>
              {HIGHLIGHTS.map((item, index) => (
                <View key={item.title} style={[styles.highlightRow, index < HIGHLIGHTS.length - 1 ? styles.highlightRowBorder : null]}>
                  <View style={styles.highlightIconWrap}>
                    <AppIcon name={item.icon} size="sm" tone="primary" />
                  </View>
                  <View style={styles.highlightContent}>
                    <Text style={styles.highlightTitle}>{item.title}</Text>
                    <Text style={styles.body}>{item.copy}</Text>
                  </View>
                </View>
              ))}
            </View>
          </SurfaceCard>
        </AnimatedEntrance>
      </Animated.View>
    </MarketingShell>
  );
}

const styles = StyleSheet.create({
  footer: {
    gap: tokens.spacing.sm,
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
  contentStack: {
    gap: tokens.spacing.md,
  },
  heroCard: {
    overflow: "hidden",
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    paddingTop: 30,
    paddingBottom: 30,
    shadowOpacity: 0.06,
  },
  heroBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  heroMeshTop: {
    position: "absolute",
    top: 18,
    left: 18,
    right: 18,
    height: 76,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  heroMeshBottom: {
    position: "absolute",
    left: 28,
    bottom: 70,
    width: 132,
    height: 132,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  heroGradientBandTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: "rgba(255,255,255,0.24)",
  },
  heroGradientBandBottom: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    height: 96,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroOrbLarge: {
    position: "absolute",
    top: -42,
    right: -24,
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: "rgba(151,187,156,0.08)",
  },
  heroOrbSmall: {
    position: "absolute",
    bottom: 76,
    left: -18,
    width: 108,
    height: 108,
    borderRadius: 999,
    backgroundColor: "rgba(124,58,237,0.03)",
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.sm,
    marginBottom: 4,
  },
  brandPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: tokens.radius.pill,
    backgroundColor: "rgba(255,255,255,0.76)",
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.18)",
  },
  brandPillText: {
    color: tokens.colors.text,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: tokens.radius.pill,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.18)",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: tokens.colors.success,
  },
  livePillText: {
    color: tokens.colors.text,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
  },
  heroTitle: {
    color: tokens.colors.text,
    fontSize: 30,
    lineHeight: 38,
    fontFamily: tokens.fontFamily.bold,
    letterSpacing: -0.5,
  },
  previewStack: {
    marginTop: tokens.spacing.md,
    gap: 12,
  },
  previewMainCard: {
    borderRadius: tokens.radius.xl,
    padding: tokens.spacing.lg,
    backgroundColor: "rgba(255,255,255,0.86)",
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.12)",
    gap: tokens.spacing.md,
    ...tokens.shadow.soft,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewTitle: {
    color: tokens.colors.text,
    fontSize: 13,
    fontFamily: tokens.fontFamily.semibold,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  previewPulse: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: tokens.colors.success,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
    paddingVertical: 2,
  },
  previewRowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  previewTextWrap: {
    flex: 1,
    gap: 2,
  },
  previewLabel: {
    color: tokens.colors.text,
    fontSize: 14,
    fontFamily: tokens.fontFamily.semibold,
  },
  previewValue: {
    color: tokens.colors.primaryStrong,
    fontSize: 12,
    fontFamily: tokens.fontFamily.medium,
  },
  previewMeta: {
    color: tokens.colors.textMuted,
    fontSize: 11,
    fontFamily: tokens.fontFamily.medium,
    textTransform: "uppercase",
  },
  sectionEyebrow: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  highlightList: {
    gap: tokens.spacing.md,
  },
  highlightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.md,
  },
  highlightRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(151,187,156,0.16)",
  },
  highlightIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(151,187,156,0.12)",
  },
  highlightContent: {
    flex: 1,
    gap: 4,
  },
  highlightTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  body: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
});
