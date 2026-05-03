import { StyleSheet, Text, View } from "react-native";
import { SurfaceCard } from "./surface-card";
import { AppIcon } from "./app-icon";
import { tokens } from "../tokens";
import type { SignupOnboardingSummary } from "@/lib/signup-onboarding";

type Props = {
  summary: SignupOnboardingSummary;
  compact?: boolean;
};

export function OnboardingSummaryCard({ summary, compact = false }: Props) {
  return (
    <SurfaceCard tone="primary" padding={compact ? "regular" : "hero"}>
      <Text style={styles.title}>{summary.title}</Text>
      <Text style={styles.subtitle}>{summary.subtitle}</Text>
      <View style={styles.pillars}>
        {summary.pillars.map((pillar) => (
          <View key={pillar.label} style={styles.pillarCard}>
            <View style={styles.pillarHeader}>
              <AppIcon name={pillar.icon} size="sm" tone="primary" />
              <Text style={styles.pillarLabel}>{pillar.label}</Text>
            </View>
            <Text style={styles.pillarValue}>{pillar.value}</Text>
            <Text style={styles.pillarDescription}>{pillar.description}</Text>
          </View>
        ))}
      </View>
      <View style={styles.recommendationBox}>
        <Text style={styles.recommendationLabel}>Derlenmiş içgörü</Text>
        <Text style={styles.recommendationText}>{summary.recommendation}</Text>
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
  },
  subtitle: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  pillars: {
    gap: tokens.spacing.sm,
  },
  pillarCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.18)",
    backgroundColor: "rgba(255,255,255,0.78)",
    padding: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  pillarHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  pillarLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  pillarValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    lineHeight: 22,
    fontFamily: tokens.fontFamily.semibold,
  },
  pillarDescription: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  recommendationBox: {
    borderRadius: tokens.radius.lg,
    backgroundColor: "rgba(111,146,116,0.10)",
    padding: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  recommendationLabel: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
    textTransform: "uppercase",
  },
  recommendationText: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.medium,
  },
});
