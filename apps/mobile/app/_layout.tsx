// Bu layout genel akisindaki ekranlarin ortak navigation ve kabuk davranisini tanimlar.
// Grup icindeki sayfalar ayni stack, tab veya ust seviye yonlendirme kurallarini bu dosyadan alir.
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, TextInput, View } from "react-native";
import { useFonts } from "expo-font";
import { useQueryClient } from "@tanstack/react-query";
import { DetourProvider } from "@swmansion/react-native-detour";
import { SessionProvider, useSession } from "@/providers/auth-session";
import { AppFlowProvider, useAppFlow } from "@/providers/app-flow";
import { MobileQueryProvider } from "@/providers/query-provider";
import { DetourLinkHandler } from "@/providers/detour-link-handler";
import { useRootDeepLinkRouting } from "@/providers/root-deep-link-routing";
import { useRootNotificationRouting } from "@/providers/root-notification-routing";
import { useMemberRealtimeSync } from "@/providers/member-realtime-sync";
import { ConnectivityBanner } from "@/components/connectivity-banner";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { resolveRootNavigation } from "@/lib/navigation";
import { detourConfig, isDetourConfigured } from "@/lib/detour";
import { initMobileSentry, setSentryScreenContext, setSentryUserContext, wrapMobileRoot } from "@/lib/sentry";
import { initializeProductAnalytics } from "@/lib/product-analytics";
import { tokens } from "@/theme/tokens";

initMobileSentry();

function RootGate() {
  const { user, loading, onboardingState, availableSurfaces, pendingPostAuthScreen, refreshMe } = useSession();
  const { signupFlowState, selectedPersoma, memberBookingDraft, setMemberBookingDraft } = useAppFlow();
  const segments = useSegments();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { pendingSalonSlug, resolvePendingRoute } = useRootDeepLinkRouting({
    user,
    onboardingState,
  });

  useRootNotificationRouting({
    enabled: !loading && Boolean(user),
    role: user?.role,
    onboardingState,
  });

  useMemberRealtimeSync({
    enabled: !loading && user?.role === "MEMBER",
    queryClient,
    refreshSession: refreshMe,
  });

  useEffect(() => {
    setSentryUserContext(user);
  }, [user]);

  useEffect(() => {
    setSentryScreenContext(segments.join("/") || "index");
  }, [segments]);

  useEffect(() => {
    if (!pendingSalonSlug || !memberBookingDraft.salonSlug || pendingSalonSlug === memberBookingDraft.salonSlug) return;
    setMemberBookingDraft({ salonSlug: pendingSalonSlug, preferredSlots: [] });
  }, [memberBookingDraft.salonSlug, pendingSalonSlug, setMemberBookingDraft]);

  useEffect(() => {
    const decision = resolveRootNavigation({
      loading,
      pendingSalonSlug,
      user,
      onboardingState,
      mobileAvailable: availableSurfaces?.mobile,
      pendingPostAuthScreen,
      signupFlowState,
      selectedPersona: selectedPersoma,
      segments,
    });

    if (decision.type === "replace") {
      router.replace(decision.href as never);
    }
  }, [
    loading,
    pendingSalonSlug,
    user,
    segments,
    router,
    onboardingState,
    availableSurfaces,
    pendingPostAuthScreen,
    signupFlowState,
    selectedPersoma,
  ]);

  if (loading || pendingSalonSlug === undefined) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
      </View>
    );
  }

  return (
    <>
      {isDetourConfigured() ? (
        <DetourLinkHandler
          resolveRoute={resolvePendingRoute}
        />
      ) : null}

      <Slot />
      <ConnectivityBanner />
    </>
  );
}

function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Poppins-Light": require("../assets/fonts/Poppins-Light.ttf"),
    "Poppins-Regular": require("../assets/fonts/Poppins-Regular.ttf"),
    "Poppins-Medium": require("../assets/fonts/Poppins-Medium.ttf"),
    "Poppins-SemiBold": require("../assets/fonts/Poppins-SemiBold.ttf"),
    "Poppins-Bold": require("../assets/fonts/Poppins-Bold.ttf"),
  });

  useEffect(() => {
    void initializeProductAnalytics();
  }, []);

  const TextComponent = Text as typeof Text & { defaultProps?: Record<string, unknown> };
  const TextInputComponent = TextInput as typeof TextInput & { defaultProps?: Record<string, unknown> };

  TextComponent.defaultProps = {
    ...(TextComponent.defaultProps || {}),
    allowFontScaling: true,
    style: [TextComponent.defaultProps?.style, { fontFamily: tokens.fontFamily.regular }],
  };

  TextInputComponent.defaultProps = {
    ...(TextInputComponent.defaultProps || {}),
    allowFontScaling: true,
    style: [TextInputComponent.defaultProps?.style, { fontFamily: tokens.fontFamily.regular }],
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
      </View>
    );
  }

  const appTree = (
    <BrandedLaunchOverlay>
      <MobileQueryProvider>
        <SessionProvider>
          <AppFlowProvider>
            <AppErrorBoundary>
              <RootGate />
            </AppErrorBoundary>
          </AppFlowProvider>
        </SessionProvider>
      </MobileQueryProvider>
    </BrandedLaunchOverlay>
  );

  if (!isDetourConfigured()) {
    return appTree;
  }

  return <DetourProvider config={detourConfig}>{appTree}</DetourProvider>;
}

export default wrapMobileRoot(RootLayout);

function BrandedLaunchOverlay({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const markScale = useRef(new Animated.Value(0.88)).current;
  const markOpacity = useRef(new Animated.Value(0)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(markOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(markScale, {
          toValue: 1,
          damping: 13,
          stiffness: 120,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(wordOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(520),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 240,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
    });
  }, [markOpacity, markScale, overlayOpacity, wordOpacity]);

  return (
    <View style={styles.rootWrap}>
      {children}
      {visible ? (
        <Animated.View pointerEvents="none" style={[styles.brandOverlay, { opacity: overlayOpacity }]}>
          <Animated.Image
            source={require("../assets/brand/fizyoflow-mark.png")}
            style={[styles.brandMark, { opacity: markOpacity, transform: [{ scale: markScale }] }]}
          />
          <Animated.Text style={[styles.brandWordmark, { opacity: wordOpacity }]}>FIZYOFLOW</Animated.Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rootWrap: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.background,
  },
  brandOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7FAF6",
  },
  brandMark: {
    width: 104,
    height: 104,
    resizeMode: "contain",
  },
  brandWordmark: {
    marginTop: 18,
    color: "#5F8F6D",
    fontFamily: tokens.fontFamily.bold,
    fontSize: 22,
    letterSpacing: 6,
  },
});
