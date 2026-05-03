// Bu paylasilan UI component'i mobil tasarim sistemindeki marketing shell parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { ReactNode, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { ArrowLeft, ChevronLeft } from "lucide-react-native";
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppIcon, type AppIconName } from "./app-icon";
import { tokens } from "../tokens";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  icon?: AppIconName;
  footer?: ReactNode;
  showBackButton?: boolean;
  backHref?: string;
  onBack?: () => void;
  animateContent?: boolean;
};

export function MarketingShell({
  title,
  subtitle,
  children,
  icon = "spark",
  footer,
  showBackButton = true,
  backHref,
  onBack,
  animateContent = true,
}: Props) {
  const router = useRouter();
  const canGoBack = typeof router.canGoBack === "function" ? router.canGoBack() : false;
  const BackIcon = Platform.OS === "ios" ? ChevronLeft : ArrowLeft;
  const heroOpacity = useRef(new Animated.Value(animateContent ? 0 : 1)).current;
  const heroTranslate = useRef(new Animated.Value(animateContent ? 14 : 0)).current;
  const bodyOpacity = useRef(new Animated.Value(animateContent ? 0 : 1)).current;
  const bodyTranslate = useRef(new Animated.Value(animateContent ? 18 : 0)).current;

  useEffect(() => {
    if (!animateContent) {
      heroOpacity.setValue(1);
      heroTranslate.setValue(0);
      bodyOpacity.setValue(1);
      bodyTranslate.setValue(0);
      return;
    }
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
  }, [animateContent, bodyOpacity, bodyTranslate, heroOpacity, heroTranslate]);

  const shouldShowBackButton = showBackButton && (canGoBack || Boolean(backHref) || Boolean(onBack));

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {shouldShowBackButton ? (
          <View style={styles.topNavigation}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Geri"
              style={({ pressed }) => [styles.navChip, pressed ? styles.navChipPressed : null]}
              onPress={() => {
                if (onBack) {
                  onBack();
                  return;
                }
                if (backHref && typeof router.replace === "function") {
                  router.replace(backHref as never);
                  return;
                }
                router.back();
              }}
            >
              <BackIcon color={tokens.colors.text} size={Platform.OS === "ios" ? 20 : 18} strokeWidth={2.4} />
            </Pressable>
          </View>
        ) : null}
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: heroOpacity, transform: [{ translateY: heroTranslate }] }}>
            <View style={styles.hero}>
              <View style={styles.heroGlowTop} />
              <View style={styles.heroGlowBottom} />
              <AppIcon name={icon} active size="lg" />
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
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  topNavigation: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.xs,
    paddingBottom: tokens.spacing.sm,
  },
  content: {
    padding: tokens.spacing.lg,
    paddingBottom: tokens.spacing.xxl * 2,
    gap: tokens.spacing.md,
  },
  hero: {
    borderRadius: tokens.radius.xl,
    padding: tokens.spacing.xl,
    gap: tokens.spacing.sm,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    overflow: "hidden",
    ...tokens.shadow.float,
  },
  bodyContent: {
    gap: tokens.spacing.md,
  },
  navChip: {
    width: tokens.touch.min,
    height: tokens.touch.min,
    borderRadius: tokens.radius.pill,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.14)",
    alignItems: "center",
    justifyContent: "center",
    ...tokens.shadow.soft,
  },
  navChipPressed: {
    transform: [{ scale: 0.98 }],
  },
  heroGlowTop: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: "rgba(151,187,156,0.16)",
  },
  heroGlowBottom: {
    position: "absolute",
    bottom: -80,
    left: -20,
    width: 200,
    height: 160,
    borderRadius: 999,
    backgroundColor: "rgba(124,58,237,0.08)",
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
    paddingBottom: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    backgroundColor: "rgba(248,250,251,0.94)",
    borderTopWidth: 1,
    borderTopColor: "rgba(151,187,156,0.18)",
  },
});
