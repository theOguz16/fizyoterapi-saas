// Bu paylasilan UI component'i mobil tasarim sistemindeki app shell parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { ReactNode, useEffect, useRef } from "react";
import { useLocalSearchParams, useRouter, useSegments } from "expo-router";
import { ArrowLeft, ChevronLeft } from "lucide-react-native";
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { resolveBackNavigation, resolveContextualBackHref } from "@/lib/navigation";
import { AppIcon, type AppIconName } from "./app-icon";
import { tokens } from "../tokens";

type Props = {
  title: string;
  subtitle?: string;
  icon?: AppIconName;
  children: ReactNode;
  rightAction?: ReactNode;
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  showBackButton?: boolean;
  backLabel?: string;
  backHref?: string;
  onBack?: () => void;
};

export function AppShell({
  title,
  subtitle,
  icon = "spark",
  children,
  rightAction,
  footer,
  refreshing = false,
  onRefresh,
  showBackButton = true,
  backLabel = "Geri",
  backHref,
  onBack,
}: Props) {
  const router = useRouter();
  const segments = useSegments();
  const params = useLocalSearchParams<{ backTo?: string | string[] }>();
  const canGoBack = typeof router.canGoBack === "function" ? router.canGoBack() : false;
  const BackIcon = Platform.OS === "ios" ? ChevronLeft : ArrowLeft;
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroTranslate = useRef(new Animated.Value(14)).current;
  const bodyOpacity = useRef(new Animated.Value(0)).current;
  const bodyTranslate = useRef(new Animated.Value(18)).current;
  const isTabRootRoute = isPrimaryTabRootRoute(segments);
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;
  const contextualBackHref = backHref || backTo || resolveContextualBackHref(segments);
  const shouldShowBackButton = showBackButton && !isTabRootRoute && (canGoBack || Boolean(onBack) || Boolean(contextualBackHref));

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(heroOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(heroTranslate, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(bodyOpacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bodyTranslate, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [bodyOpacity, bodyTranslate, heroOpacity, heroTranslate]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0} style={styles.flex}>
        {shouldShowBackButton ? (
          <View style={styles.topNavigation}>
            <Pressable
              testID="app-shell-back-button"
              accessibilityRole="button"
              accessibilityLabel={backLabel}
              style={({ pressed }) => [styles.navChip, styles.navChipElevated, pressed ? styles.navChipPressed : null]}
              onPress={() => {
                if (onBack) {
                  onBack();
                  return;
                }
                const nextAction = resolveBackNavigation(canGoBack, contextualBackHref);
                if (nextAction.type === "back") {
                  router.back();
                  return;
                }
                if (typeof router.replace === "function") {
                  router.replace(nextAction.href as never);
                  return;
                }
                router.back();
              }}
            >
              <BackIcon color={tokens.colors.text} size={Platform.OS === "ios" ? 20 : 18} strokeWidth={2.4} />
            </Pressable>
          </View>
        ) : null}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.primary} /> : undefined}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Animated.View style={{ opacity: heroOpacity, transform: [{ translateY: heroTranslate }] }}>
            <View style={styles.hero}>
              <View style={styles.heroGlowA} />
              <View style={styles.heroGlowB} />
              <View style={styles.heroHeader}>
                <View style={styles.heroIdentity}>
                  <AppIcon name={icon} active size="lg" />
                  <Text style={styles.eyebrow}>FIZYOFLOW</Text>
                </View>
                {rightAction ? <View>{rightAction}</View> : <View style={styles.navSpacer} />}
              </View>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          </Animated.View>
          <Animated.View style={[styles.bodyContent, { opacity: bodyOpacity, transform: [{ translateY: bodyTranslate }] }]}>
            {children}
          </Animated.View>
        </ScrollView>
        {footer ? (
          <Animated.View style={[styles.footer, { opacity: bodyOpacity, transform: [{ translateY: bodyTranslate }] }]}>
            {footer}
          </Animated.View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  scroll: {
    flex: 1,
  },
  topNavigation: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.xs,
    paddingBottom: tokens.spacing.sm,
    backgroundColor: "rgba(248,250,251,0.96)",
  },
  content: {
    padding: tokens.spacing.lg,
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.xxl * 3,
    gap: tokens.spacing.md,
  },
  hero: {
    overflow: "hidden",
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.sm,
    ...tokens.shadow.float,
  },
  bodyContent: {
    gap: tokens.spacing.md,
  },
  heroGlowA: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    right: -40,
    top: -60,
    backgroundColor: "rgba(151,187,156,0.16)",
  },
  heroGlowB: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 999,
    left: -30,
    bottom: -60,
    backgroundColor: "rgba(199,218,201,0.14)",
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  navChip: {
    width: tokens.touch.min,
    height: tokens.touch.min,
    borderRadius: tokens.radius.pill,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.14)",
    alignItems: "center",
    justifyContent: "center",
    ...tokens.shadow.soft,
  },
  navChipPressed: {
    transform: [{ scale: 0.98 }],
  },
  navChipElevated: {
    alignSelf: "flex-start",
  },
  navSpacer: {
    width: tokens.touch.min,
    height: tokens.touch.min,
  },
  heroIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  eyebrow: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
    letterSpacing: 1,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.display,
    lineHeight: 34,
    fontFamily: tokens.fontFamily.bold,
  },
  subtitle: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  footer: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    backgroundColor: "rgba(248,250,251,0.98)",
    borderTopWidth: 1,
    borderTopColor: "rgba(151,187,156,0.08)",
  },
});

function isPrimaryTabRootRoute(segments: string[]) {
  if (segments.length !== 2) return false;

  const [group, screen] = segments;

  if (group === "(member)") {
    return ["home", "calendar", "package", "measurements", "profile"].includes(screen);
  }

  if (group === "(trainer)") {
    return ["home", "clients", "calendar", "earnings", "profile"].includes(screen);
  }

  if (group === "(admin)") {
    return ["dashboard", "calendar", "approvals", "members", "profile"].includes(screen);
  }

  return false;
}
