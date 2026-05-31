// Bu paylasilan UI component'i mobil tasarim sistemindeki surface card parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { ReactNode } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { tokens } from "../tokens";

type Props = {
  children: ReactNode;
  testID?: string;
  style?: ViewStyle;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
  padding?: "regular" | "compact" | "hero";
};

export function SurfaceCard({ children, testID, style, tone = "default", padding = "regular" }: Props) {
  return (
    <View testID={testID} style={[styles.card, paddingStyles[padding], toneStyles[tone], style]}>
      {children}
    </View>
  );
}

const toneStyles = StyleSheet.create({
  default: {},
  primary: {
    backgroundColor: "rgba(244,248,251,0.98)",
    borderColor: "rgba(151,187,156,0.18)",
    shadowColor: "#97BB9C",
    shadowOpacity: 0.08,
  },
  success: {
    backgroundColor: "#F4FBF7",
    borderColor: "rgba(16,185,129,0.2)",
  },
  warning: {
    backgroundColor: "#FFF9EF",
    borderColor: "rgba(217,119,6,0.24)",
  },
  danger: {
    backgroundColor: "#FFF5F7",
    borderColor: "rgba(225,29,72,0.2)",
  },
});

const paddingStyles = StyleSheet.create({
  regular: {
    padding: tokens.spacing.md,
  },
  compact: {
    padding: tokens.spacing.sm + 2,
  },
  hero: {
    padding: tokens.spacing.lg,
  },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.xl,
    gap: tokens.spacing.sm,
    ...tokens.shadow.soft,
  },
});
