import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppIcon } from "@/theme/components/app-icon";
import { ActionButton } from "@/theme/components/action-button";
import { SUBSCRIPTION_PRICING, SUBSCRIPTION_VALUE_PROOFS, type BillingCycle } from "@/lib/subscription-pricing";
import { CLINIC_TRIAL_DAYS } from "@/lib/admin-subscription";
import { tokens } from "@/theme/tokens";

export default function OwnerPlanScreen() {
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const heroOpacity = useState(() => new Animated.Value(0))[0];
  const heroTranslate = useState(() => new Animated.Value(18))[0];
  const cardOpacity = useState(() => new Animated.Value(0))[0];
  const cardTranslate = useState(() => new Animated.Value(24))[0];
  const currentPlan = SUBSCRIPTION_PRICING[billingCycle];

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(heroOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(heroTranslate, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslate, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [cardOpacity, cardTranslate, heroOpacity, heroTranslate]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        <Animated.View style={{ opacity: heroOpacity, transform: [{ translateY: heroTranslate }] }}>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>Klinik ve salon sahipleri için</Text>
            <Text style={styles.title}>Yönetim sistemini ücretsiz dene, hazır olduğunda planını etkinleştir.</Text>
            <Text style={styles.subtitle}>
              {CLINIC_TRIAL_DAYS} gün ücretsiz deneme ile kliniğini kurabilir; ekip, danışan, paket ve rezervasyon yönetimini tek akışta deneyebilirsin.
            </Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.contentStack, { opacity: cardOpacity, transform: [{ translateY: cardTranslate }] }]}>
          <View style={styles.journeyCard}>
            <Text style={styles.journeyTitle}>Başlangıç sırası</Text>
            {[
              ["1", "Klinik bilgileri", "Yönetim hesabını oluştur ve kliniğinin temel bilgilerini tamamla."],
              ["2", "Ücretsiz deneme veya ödeme", `Önce ${CLINIC_TRIAL_DAYS} günlük denemeyi başlat ya da planını doğrudan etkinleştir.`],
              ["3", "Kullanıma başla", "Kliniğin açılır; ekip, danışan, paket ve rezervasyon yönetimine geçersin."],
            ].map(([step, title, description]) => (
              <View key={step} style={styles.journeyRow}>
                <View style={styles.journeyStep}>
                  <Text style={styles.journeyStepText}>{step}</Text>
                </View>
                <View style={styles.journeyCopyWrap}>
                  <Text style={styles.journeyRowTitle}>{title}</Text>
                  <Text style={styles.journeyCopy}>{description}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.valueCard} testID="owner-plan-value-proof">
            <View style={styles.valueHeader}>
              <Text style={styles.valueEyebrow}>TEK PLAN, TEK OPERASYON</Text>
              <Text style={styles.valueTitle}>Bu planla neleri yönetirsin?</Text>
              <Text style={styles.valueIntro}>Kliniğinin günlük işlerini ayrı araçlara bölmeden aynı yönetim akışında tutarsın.</Text>
            </View>
            <View style={styles.valueList}>
              {SUBSCRIPTION_VALUE_PROOFS.map((item) => (
                <View key={item.key} style={styles.valueRow}>
                  <AppIcon name={item.icon} size="sm" tone="primary" />
                  <View style={styles.valueCopyWrap}>
                    <Text style={styles.valueRowTitle}>{item.title}</Text>
                    <Text style={styles.valueDescription}>{item.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.switchRow}>
            <BillingChip label="Aylık" active={billingCycle === "monthly"} onPress={() => setBillingCycle("monthly")} />
            <BillingChip label="Yıllık" active={billingCycle === "yearly"} onPress={() => setBillingCycle("yearly")} />
          </View>

          <View style={[styles.planCard, billingCycle === "yearly" ? styles.planCardFeatured : styles.planCardSecondary]}>
            {billingCycle === "yearly" ? (
              <View style={styles.featuredRibbon}>
                <Text style={styles.featuredRibbonText}>Önerilen plan</Text>
              </View>
            ) : null}
            <View style={styles.planHeader}>
              <View style={styles.planTitleWrap}>
                <Text style={styles.planTitle}>{currentPlan.label}</Text>
                <Text style={styles.planBadge}>{currentPlan.badge}</Text>
              </View>
              <View style={styles.priceWrap}>
                <Text style={styles.comparePrice}>{currentPlan.comparePrice}</Text>
                <Text style={styles.price}>{currentPlan.price}</Text>
                <Text style={styles.priceHint}>{currentPlan.period}</Text>
              </View>
            </View>

            <View style={styles.discountRow}>
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>{currentPlan.discount}</Text>
              </View>
              <Text style={styles.discountCaption}>Eski fiyat üzerinden sınırlı süreli lansman avantajı</Text>
            </View>

            <Text style={styles.planCopy}>{currentPlan.description}</Text>

            <View style={styles.bulletList}>
              {currentPlan.bullets.map((item) => (
                <View key={item} style={styles.bulletRow}>
                  <AppIcon name="spark" size="sm" tone="primary" />
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>

            <View style={styles.trialCard}>
              <Text style={styles.trialTitle}>Deneme süresi</Text>
              <Text style={styles.trialCopy}>
                {CLINIC_TRIAL_DAYS} günlük denemede klinik kurulumunu tamamlayabilir, ekibini davet edebilir ve ilk rezervasyon akışını deneyebilirsin.
              </Text>
            </View>
          </View>

          <View style={styles.footer}>
            <ActionButton testID="owner-plan-start-trial" label="Deneme için hesap oluştur" icon="subscription" onPress={() => router.push("/(auth)/register" as never)} />
          </View>
        </Animated.View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function BillingChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.billingChip, active ? styles.billingChipActive : null]}>
      <Text style={active ? styles.billingChipTextActive : styles.billingChipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
    gap: tokens.spacing.lg,
  },
  hero: {
    gap: tokens.spacing.sm,
  },
  eyebrow: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
    textTransform: "uppercase",
  },
  title: {
    color: tokens.colors.text,
    fontSize: 30,
    lineHeight: 38,
    fontFamily: tokens.fontFamily.bold,
  },
  subtitle: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.md,
    lineHeight: 24,
    fontFamily: tokens.fontFamily.regular,
  },
  switchRow: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  contentStack: {
    gap: tokens.spacing.md,
  },
  journeyCard: {
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
  },
  journeyTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  journeyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  journeyStep: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.primarySoft,
  },
  journeyStepText: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.bold,
  },
  journeyCopyWrap: {
    flex: 1,
    gap: 2,
  },
  journeyRowTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  journeyCopy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  valueCard: {
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(111,146,116,0.24)",
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
  },
  valueHeader: {
    gap: tokens.spacing.xs,
  },
  valueEyebrow: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
  },
  valueTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
  },
  valueIntro: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  valueList: {
    gap: tokens.spacing.md,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  valueCopyWrap: {
    flex: 1,
    gap: 2,
  },
  valueRowTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  valueDescription: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.compact,
    fontFamily: tokens.fontFamily.regular,
  },
  billingChip: {
    flex: 1,
    minHeight: 48,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
  },
  billingChipActive: {
    backgroundColor: tokens.colors.primaryStrong,
    borderColor: tokens.colors.primaryStrong,
  },
  billingChipText: {
    color: tokens.colors.text,
  },
  billingChipTextActive: {
    color: "#FFFFFF",
  },
  planCard: {
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
    ...tokens.shadow.float,
  },
  planCardFeatured: {
    borderColor: "rgba(111,146,116,0.34)",
    backgroundColor: "rgba(111,146,116,0.08)",
  },
  planCardSecondary: {
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  featuredRibbon: {
    alignSelf: "flex-start",
    marginBottom: tokens.spacing.xs,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.primaryStrong,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 6,
  },
  featuredRibbonText: {
    color: "#FFFFFF",
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
  },
  planTitleWrap: {
    flex: 1,
    gap: 4,
  },
  planTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.xl,
    fontFamily: tokens.fontFamily.bold,
  },
  planBadge: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
  },
  priceWrap: {
    alignItems: "flex-end",
    gap: 2,
  },
  comparePrice: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.medium,
    textDecorationLine: "line-through",
  },
  price: {
    color: tokens.colors.text,
    fontSize: 30,
    fontFamily: tokens.fontFamily.bold,
  },
  priceHint: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  planCopy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  discountRow: {
    gap: tokens.spacing.xs,
  },
  discountBadge: {
    alignSelf: "flex-start",
    borderRadius: tokens.radius.pill,
    backgroundColor: "rgba(111,146,116,0.14)",
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 6,
  },
  discountText: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
  },
  discountCaption: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.regular,
  },
  bulletList: {
    gap: tokens.spacing.sm,
  },
  bulletRow: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    alignItems: "center",
  },
  bulletText: {
    flex: 1,
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.medium,
  },
  trialCard: {
    borderRadius: tokens.radius.lg,
    backgroundColor: "rgba(111,146,116,0.08)",
    padding: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  trialTitle: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.bold,
  },
  trialCopy: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  footer: {
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.md,
  },
});
