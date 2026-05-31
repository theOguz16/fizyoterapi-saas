import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AppIconName } from "@/theme/components/app-icon";
import { AppIcon } from "@/theme/components/app-icon";
import { AnimatedEntrance } from "@/theme/components/animated-entrance";
import { ProgressStepper } from "@/theme/components/progress-stepper";
import { SurfaceCard } from "@/theme/components/surface-card";
import { tokens } from "@/theme/tokens";

export type OnboardingOption = {
  value: string;
  label: string;
  description?: string;
  icon: AppIconName;
};

type Props = {
  step: number;
  total: number;
  icon: AppIconName;
  eyebrow: string;
  title: string;
  subtitle: string;
  helperText: string;
  options: OnboardingOption[];
  activeValue?: string;
  onSelect: (value: string) => void;
  onBack: () => void;
  animationKey: string;
  badgeLabel?: string;
  backTestId?: string;
  optionTestIdPrefix?: string;
};

function toOptionTestIdSegment(value: string) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function OnboardingQuestionStage({
  step,
  total,
  icon,
  eyebrow,
  title,
  subtitle,
  helperText,
  options,
  activeValue = "",
  onSelect,
  onBack,
  animationKey,
  badgeLabel,
  backTestId,
  optionTestIdPrefix,
}: Props) {
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentTranslate = useRef(new Animated.Value(0)).current;
  const cardGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    contentOpacity.setValue(0.18);
    contentTranslate.setValue(20);
    cardGlow.setValue(0.4);
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslate, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardGlow, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [animationKey, cardGlow, contentOpacity, contentTranslate]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Pressable testID={backTestId} onPress={onBack} style={({ pressed }) => [styles.backButton, pressed ? styles.backButtonPressed : null]}>
            <AppIcon name="arrow-left" size="sm" tone="neutral" variant="plain" />
          </Pressable>
        <View style={styles.progressWrap}>
            <ProgressStepper step={step} total={total} label={`Adım ${step} / ${total}`} showDots={false} />
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={[styles.content, { opacity: contentOpacity, transform: [{ translateY: contentTranslate }] }]}>
            <AnimatedEntrance distance={10}>
              <SurfaceCard tone="primary" padding="hero" style={styles.heroCard}>
                <View style={styles.heroTop}>
                  <View style={styles.heroHeader}>
                    <Text style={styles.eyebrow}>{eyebrow}</Text>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.subtitle}>{subtitle}</Text>
                  </View>
                  {badgeLabel ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{badgeLabel}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.helperRow}>
                  <View style={styles.helperIconWrap}>
                    <AppIcon name={icon} active size="md" />
                  </View>
                  <Text style={styles.helperText}>{helperText}</Text>
                </View>
              </SurfaceCard>
            </AnimatedEntrance>

            <View style={styles.answers}>
              {options.map((option, index) => {
                const active = activeValue === option.value;
                return (
                  <AnimatedEntrance key={option.value} delay={70 + index * 45} distance={8}>
                    <Animated.View
                      style={[
                        styles.answerWrap,
                        active
                          ? {
                              shadowOpacity: cardGlow.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, 0.18],
                              }) as unknown as number,
                            }
                          : null,
                      ]}
                    >
                      <Pressable
                        testID={optionTestIdPrefix ? `${optionTestIdPrefix}-${toOptionTestIdSegment(option.value)}` : undefined}
                        onPress={() => onSelect(option.value)}
                        style={({ pressed }) => [styles.answerCard, active ? styles.answerCardActive : null, pressed ? styles.answerPressed : null]}
                      >
                        <View style={[styles.iconWrap, active ? styles.iconWrapActive : null]}>
                          <AppIcon name={option.icon} size="md" tone={active ? "primary" : "neutral"} variant="plain" active={active} />
                        </View>
                        <View style={styles.answerCopy}>
                          <Text style={[styles.answerLabel, active ? styles.answerLabelActive : null]}>{option.label}</Text>
                          {option.description ? (
                            <Text style={[styles.answerDescription, active ? styles.answerDescriptionActive : null]}>{option.description}</Text>
                          ) : null}
                        </View>
                        {active ? <Text style={styles.answerBadge}>Seçildi</Text> : <View style={[styles.answerDot, active ? styles.answerDotActive : null]} />}
                      </Pressable>
                    </Animated.View>
                  </AnimatedEntrance>
                );
              })}
            </View>
          </Animated.View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
    gap: tokens.spacing.lg,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.md,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: tokens.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    ...tokens.shadow.soft,
  },
  backButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
  progressWrap: {
    flex: 1,
    paddingTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: tokens.spacing.xl,
  },
  content: {
    gap: tokens.spacing.lg,
  },
  heroCard: {
    gap: tokens.spacing.md,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  heroHeader: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  title: {
    color: tokens.colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontFamily: tokens.fontFamily.bold,
  },
  subtitle: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.md,
    lineHeight: 23,
    fontFamily: tokens.fontFamily.regular,
  },
  badge: {
    borderRadius: tokens.radius.pill,
    backgroundColor: "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.16)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
  },
  helperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.18)",
    backgroundColor: "rgba(255,255,255,0.72)",
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm + 2,
  },
  helperIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: "rgba(111,146,116,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  helperText: {
    flex: 1,
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: 20,
    fontFamily: tokens.fontFamily.medium,
  },
  answers: {
    gap: tokens.spacing.md,
  },
  answerWrap: {
    borderRadius: tokens.radius.xl,
    shadowColor: "rgba(111,146,116,0.26)" as any,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  answerCard: {
    minHeight: 92,
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
    ...tokens.shadow.soft,
  },
  answerCardActive: {
    backgroundColor: "#F2FAF4",
    borderColor: tokens.colors.primaryStrong,
  },
  answerPressed: {
    transform: [{ scale: 0.985 }],
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: tokens.colors.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: "rgba(111,146,116,0.14)",
  },
  answerCopy: {
    flex: 1,
    gap: 6,
  },
  answerLabel: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    lineHeight: 22,
    fontFamily: tokens.fontFamily.semibold,
  },
  answerLabelActive: {
    color: tokens.colors.primaryStrong,
  },
  answerDescription: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  answerDescriptionActive: {
    color: "#5B7560",
  },
  answerBadge: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
    backgroundColor: "rgba(111,146,116,0.12)",
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  answerDot: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: tokens.colors.borderStrong,
    backgroundColor: tokens.colors.surface,
  },
  answerDotActive: {
    borderColor: tokens.colors.primaryStrong,
    backgroundColor: tokens.colors.primary,
  },
});
