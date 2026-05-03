// Bu layout genel akisindaki ekranlarin ortak navigation ve kabuk davranisini tanimlar.
// Grup icindeki sayfalar ayni stack, tab veya ust seviye yonlendirme kurallarini bu dosyadan alir.
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, TextInput, View } from "react-native";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { useQueryClient } from "@tanstack/react-query";
import { DetourProvider } from "@swmansion/react-native-detour";
import { SessionProvider, useSession } from "@/providers/auth-session";
import { AppFlowProvider, useAppFlow } from "@/providers/app-flow";
import { MobileQueryProvider } from "@/providers/query-provider";
import { DetourLinkHandler } from "@/providers/detour-link-handler";
import { resolveRoleGroup, resolveRoleHome } from "@/lib/navigation";
import { resolveNotificationResponseHref } from "@/lib/push";
import { subscribeToMemberRealtime } from "@/lib/member-realtime";
import { getPendingSalonJoinSlug, setPendingSalonJoinSlug } from "@/lib/local-preferences";
import { extractSalonSlugFromQrPayload } from "@/lib/salon-qr";
import { detourConfig, isDetourConfigured } from "@/lib/detour";
import { tokens } from "@/theme/tokens";

function RootGate() {
  const { user, loading, onboardingState, availableSurfaces, pendingPostAuthScreen, refreshMe } = useSession();
  const { signupFlowState, selectedPersoma } = useAppFlow();
  const segments = useSegments();
  const router = useRouter();
  const queryClient = useQueryClient();
  const lastHandledNotificationIdRef = useRef<string | null>(null);
  const [pendingSalonSlug, setPendingSalonSlug] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    void getPendingSalonJoinSlug().then((slug) => {
      setPendingSalonSlug(slug);
    });
  }, []);

  useEffect(() => {
    async function handleIncomingUrl(rawUrl: string | null | undefined) {
      const internalHref = resolveInternalHrefFromIncomingUrl(rawUrl);

      if (internalHref) {
        router.replace(internalHref as never);
        return;
      }

      const slug = extractSalonSlugFromQrPayload(String(rawUrl || ""));
      if (!slug) return;

      await setPendingSalonJoinSlug(slug);
      setPendingSalonSlug(slug);

      const nextRoute = resolvePendingSalonHome({
        pendingSalonSlug: slug,
        user,
        onboardingState,
      });

      if (nextRoute) {
        router.replace(nextRoute as never);
      }
    }

    void Linking.getInitialURL().then((url) => {
      if (url) void handleIncomingUrl(url);
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleIncomingUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, [onboardingState, router, user]);

  useEffect(() => {
    if (loading || pendingSalonSlug === undefined) return;

    const currentGroup = segments[0];
    const currentRoute = segments.join("/");
    const inE2EResetRoute = currentRoute === "e2e-reset";
    const inE2ELoginRoute = currentRoute === "e2e-login";
    const inAuthGroup = currentGroup === "(auth)";
    const inIntakeGroup = currentGroup === "(intake-member)";
    const authLeaf = segments.at(1);
    const allowedUnauthedGroups = inAuthGroup || inE2ELoginRoute;

    const pendingSalonHome = resolvePendingSalonHome({
      pendingSalonSlug,
      user,
      onboardingState,
    });

    const allowedSignupLeaves =
      signupFlowState === "assessment"
        ? ["role-assessment"]
        : selectedPersoma === "ADMIN"
          ? ["owner-plan", "register"]
          : selectedPersoma === "TRAINER"
            ? ["invite-accept"]
            : ["register"];

    if (inE2EResetRoute || inE2ELoginRoute) {
      return;
    }

    if (!user && !allowedUnauthedGroups && !inIntakeGroup) {
      router.replace("/(auth)/welcome");
      return;
    }

    if (!user) {
      if (signupFlowState !== "idle" && !allowedSignupLeaves.includes(authLeaf || "")) {
        const fallbackRoute = `/(auth)/${allowedSignupLeaves[0]}`;
        router.replace(fallbackRoute as never);
      }

      return;
    }

    if (availableSurfaces?.mobile === false) {
      router.replace("/(auth)/welcome");
      return;
    }

    const expectedGroup = resolveRoleGroup(user.role as "TRAINER" | "MEMBER" | "ADMIN", onboardingState, user);
    const nextHome =
      pendingSalonHome || resolveRoleHome(user.role as "TRAINER" | "MEMBER" | "ADMIN", onboardingState, user);

    const allowMemberPurchaseFlow =
      user.role === "MEMBER" &&
      currentGroup === "(intake-member)" &&
      onboardingState === "ACTIVE_SALON" &&
      !pendingSalonHome;

    if (inAuthGroup && pendingPostAuthScreen === "NOTIFICATION_PERMISSION" && authLeaf !== "notification-permission") {
      router.replace("/(auth)/notification-permission" as never);
      return;
    }

    if (inAuthGroup && pendingPostAuthScreen === "NOTIFICATION_PERMISSION") {
      return;
    }

    if (inAuthGroup && authLeaf !== "notification-permission") {
      router.replace(nextHome as never);
      return;
    }

    if (currentGroup && currentGroup !== expectedGroup && !allowMemberPurchaseFlow) {
      router.replace(nextHome as never);
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

  useEffect(() => {
    if (loading || !user) return;

    const userRole = user.role;

    function openNotificationRoute(response: Notifications.NotificationResponse | null | undefined) {
      const identifier = response?.notification?.request?.identifier || null;

      if (!response || !identifier || lastHandledNotificationIdRef.current === identifier) {
        return;
      }

      const href = resolveNotificationResponseHref(response, {
        role: userRole,
        onboardingState,
      });

      if (!href) return;

      lastHandledNotificationIdRef.current = identifier;
      router.push(href as never);
    }

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      openNotificationRoute(response);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openNotificationRoute(response);
    });

    return () => {
      subscription.remove();
    };
  }, [loading, onboardingState, router, user]);

  useEffect(() => {
    if (loading || !user || user.role !== "MEMBER") return;

    return subscribeToMemberRealtime((payload) => {
      const type = String(payload.data?.type || "").toLowerCase();
      const entity = String(payload.data?.entity || "").toLowerCase();

      if (payload.event !== "connected" && type !== "calendar_sync" && entity !== "calendar") return;

      if (type === "calendar_sync" || entity === "calendar") {
        void refreshMe().catch(() => null);
      }

      void queryClient.invalidateQueries({ queryKey: ["member-bookings-calendar"] });
      void queryClient.invalidateQueries({ queryKey: ["member-availability-calendar"] });
      void queryClient.invalidateQueries({ queryKey: ["member-home-calendar"] });
      void queryClient.invalidateQueries({ queryKey: ["member-home"] });
      void queryClient.invalidateQueries({ queryKey: ["member-availability"] });
    });
  }, [loading, queryClient, refreshMe, user]);

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
          onPendingSalonSlug={setPendingSalonSlug}
          resolveRoute={(slug) =>
            resolvePendingSalonHome({
              pendingSalonSlug: slug,
              user,
              onboardingState,
            })
          }
        />
      ) : null}

      <Slot />
    </>
  );
}

function normalizeSlugValue(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function resolveUserActiveSalonSlug(user: { tenantSlug?: string | null } | null | undefined) {
  return normalizeSlugValue(user?.tenantSlug);
}

function resolvePendingSalonHome(input: {
  pendingSalonSlug: string | null | undefined;
  user: { role?: string | null; tenantSlug?: string | null } | null | undefined;
  onboardingState?: string | null;
}) {
  const pendingSlug = normalizeSlugValue(input.pendingSalonSlug);
  if (!pendingSlug) return null;

  if (!input.user) {
    return `/(intake-member)/salons/${pendingSlug}`;
  }

  if (input.user.role !== "MEMBER") {
    return null;
  }

  if (input.onboardingState !== "ACTIVE_SALON") {
    return `/(intake-member)/salons/${pendingSlug}`;
  }

  const activeSalonSlug = resolveUserActiveSalonSlug(input.user);

  if (!activeSalonSlug) {
    return "/(member)/home";
  }

  if (activeSalonSlug === pendingSlug) {
    return "/(member)/home";
  }

  return "/(member)/home";
}

function resolveInternalHrefFromIncomingUrl(rawUrl: string | null | undefined) {
  const normalized = String(rawUrl || "").trim();
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    if (url.protocol !== "clinerva:") return null;

    const host = String(url.hostname || "").trim().toLowerCase();
    const pathname = String(url.pathname || "").trim();

    // Salon onboarding linkleri internal route gibi açılmasın.
    // Bunları extractSalonSlugFromQrPayload yakalayıp pending salon akışına sokacak.
    if (host === "join" || pathname.startsWith("/join/")) return null;
    if (host === "salons" || pathname.startsWith("/salons/")) return null;

    const routePath = pathname && pathname !== "/" ? pathname : host ? `/${host}` : "";
    if (!routePath) return null;

    return `${routePath}${url.search}` || null;
  } catch {
    return null;
  }
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Poppins-Light": require("../assets/fonts/Poppins-Light.ttf"),
    "Poppins-Regular": require("../assets/fonts/Poppins-Regular.ttf"),
    "Poppins-Medium": require("../assets/fonts/Poppins-Medium.ttf"),
    "Poppins-SemiBold": require("../assets/fonts/Poppins-SemiBold.ttf"),
    "Poppins-Bold": require("../assets/fonts/Poppins-Bold.ttf"),
  });

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
    <MobileQueryProvider>
      <SessionProvider>
        <AppFlowProvider>
          <RootGate />
        </AppFlowProvider>
      </SessionProvider>
    </MobileQueryProvider>
  );

  if (!isDetourConfigured()) {
    return appTree;
  }

  return <DetourProvider config={detourConfig}>{appTree}</DetourProvider>;
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.background,
  },
});