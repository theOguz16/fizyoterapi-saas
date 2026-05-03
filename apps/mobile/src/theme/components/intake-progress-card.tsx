import { StyleSheet, Text, View } from "react-native";
import { AppIcon, type AppIconName } from "./app-icon";
import { ProgressStepper } from "./progress-stepper";
import { SurfaceCard } from "./surface-card";
import { StatusBadge } from "./status-badge";
import { tokens } from "../tokens";

type SummaryItem = {
  label: string;
  value: string;
};

type Props = {
  step: number;
  total: number;
  title: string;
  description: string;
  icon?: AppIconName;
  eyebrow?: string;
  badgeLabel?: string;
  badgeTone?: "primary" | "success" | "warning" | "danger" | "info" | "premium" | "neutral";
  summaryItems?: SummaryItem[];
  footnote?: string;
};

export function IntakeProgressCard({
  step,
  total,
  title,
  description,
  icon = "spark",
  eyebrow = "Üyelik Akışı",
  badgeLabel,
  badgeTone = "primary",
  summaryItems = [],
  footnote,
}: Props) {
  return (
    <SurfaceCard tone="primary" padding="hero">
      <ProgressStepper step={step} total={total} label={`Adım ${step} / ${total}`} showDots={false} />
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        {badgeLabel ? <StatusBadge label={badgeLabel} tone={badgeTone} /> : null}
      </View>
      <View style={styles.helperRow}>
        <View style={styles.helperIconWrap}>
          <AppIcon name={icon} active size="sm" />
        </View>
        <Text style={styles.description}>{description}</Text>
      </View>
      {summaryItems.length > 0 ? (
        <View style={styles.summaryGrid}>
          {summaryItems.map((item) => (
            <View key={`${item.label}-${item.value}`} style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={styles.summaryValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    lineHeight: 24,
    fontFamily: tokens.fontFamily.bold,
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
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(111,146,116,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  description: {
    flex: 1,
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.medium,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    alignItems: "stretch",
  },
  summaryItem: {
    flex: 1,
    width: 0,
    minWidth: 0,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(151,187,156,0.18)",
    backgroundColor: "rgba(255,255,255,0.72)",
    paddingHorizontal: tokens.spacing.sm + 2,
    paddingVertical: tokens.spacing.sm,
    gap: 2,
  },
  summaryLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
    flexShrink: 1,
  },
  summaryValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.semibold,
    flexShrink: 1,
    flexWrap: "wrap",
  },
  footnote: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.medium,
  },
});
