// Bu component mobil uygulamada tekrar kullanilan screen shell arayuz parcasi icin ortak kabuk saglar.
// Sayfalar ayni davranisi tekrar yazmamak icin bu bileseni kullanir.
import { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, ChevronLeft } from "lucide-react-native";
import { AppIcon, type AppIconName } from "@/theme/components/app-icon";
import { SurfaceCard } from "@/theme/components/surface-card";
import { tokens } from "@/theme/tokens";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  eyebrow?: string;
  rightAction?: ReactNode;
  icon?: AppIconName;
  backLabel?: string;
  footer?: ReactNode;
};

export function ScreenShell({ title, subtitle, children, refreshing = false, onRefresh, eyebrow = "FIZYOFLOW", rightAction, icon = "spark", backLabel = "Geri", footer }: Props) {
  const router = useRouter();
  const canGoBack = typeof router.canGoBack === "function" ? router.canGoBack() : false;
  const BackIcon = Platform.OS === "ios" ? ChevronLeft : ArrowLeft;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.primary} /> : undefined}
        >
          <View style={styles.headerRow}>
            {canGoBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={backLabel}
                style={({ pressed }) => [styles.navChip, pressed ? styles.navChipPressed : null]}
                onPress={() => router.back()}
              >
                <BackIcon color={tokens.colors.text} size={Platform.OS === "ios" ? 20 : 18} strokeWidth={2.4} />
              </Pressable>
            ) : (
              <View style={styles.navSpacer} />
            )}
            {rightAction ? <View>{rightAction}</View> : <View style={styles.navSpacer} />}
          </View>
          <SurfaceCard style={styles.hero} padding="hero">
            <View style={styles.heroGlowPrimary} />
            <View style={styles.heroGlowSecondary} />
            <View style={styles.heroBadge}>
              <AppIcon name={icon} size="lg" active />
              <Text style={styles.eyebrow}>{eyebrow}</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </SurfaceCard>
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
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
  content: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
    paddingBottom: tokens.spacing.xxl * 3,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  navChip: {
    width: tokens.touch.min,
    height: tokens.touch.min,
    borderRadius: 999,
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
  navSpacer: {
    width: tokens.touch.min,
    height: tokens.touch.min,
  },
  hero: {
    overflow: "hidden",
    gap: 10,
    ...tokens.shadow.float,
  },
  heroGlowPrimary: {
    position: "absolute",
    right: -44,
    top: -30,
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: "rgba(151,187,156,0.16)",
  },
  heroGlowSecondary: {
    position: "absolute",
    left: -36,
    bottom: -72,
    width: 190,
    height: 140,
    borderRadius: 999,
    backgroundColor: "rgba(199,218,201,0.12)",
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  eyebrow: {
    color: tokens.colors.primary,
    fontSize: tokens.font.xs,
    fontWeight: "800",
    letterSpacing: 1.2,
    fontFamily: tokens.fontFamily.bold,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.xxl,
    fontWeight: "800",
    fontFamily: tokens.fontFamily.bold,
  },
  subtitle: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    maxWidth: "95%",
    fontFamily: tokens.fontFamily.regular,
  },
  footer: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.md,
    backgroundColor: "rgba(242,250,250,0.96)",
  },
});
