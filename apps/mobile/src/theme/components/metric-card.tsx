// Bu paylasilan UI component'i mobil tasarim sistemindeki metric card parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { AppIcon, type AppIconName } from "./app-icon";
import { tokens } from "../tokens";
import { resolveResponsiveLayout } from "@/lib/accessibility";

type Props = {
  testID?: string;
  label: string;
  value: string | number;
  hint?: string;
  icon: AppIconName;
};

export function MetricCard({ testID, label, value, hint, icon }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const responsive = resolveResponsiveLayout(width, fontScale);
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${label}: ${value}${hint ? `. ${hint}` : ""}`}
      style={[styles.card, responsive.stackColumns ? styles.cardStacked : { minWidth: responsive.metricMinWidth }]}
    >
      <View style={styles.header}>
        <AppIcon name={icon} size="sm" tone="primary" />
        <Text maxFontSizeMultiplier={1.8} style={styles.label}>{label}</Text>
      </View>
      <Text maxFontSizeMultiplier={1.5} style={styles.value}>{value}</Text>
      {hint ? <Text maxFontSizeMultiplier={1.8} style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 150,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  cardStacked: { flexBasis: "100%", width: "100%", minWidth: 0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  label: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  value: {
    color: tokens.colors.text,
    fontSize: tokens.font.xxl,
    fontFamily: tokens.fontFamily.bold,
  },
  hint: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.regular,
  },
});
