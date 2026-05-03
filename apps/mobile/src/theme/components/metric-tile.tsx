// Bu paylasilan UI component'i mobil tasarim sistemindeki metric tile parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../tokens";
import { AppIcon, type AppIconName } from "./app-icon";

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "primary" | "success" | "warning" | "danger" | "neutral";
  icon?: ReactNode;
  iconName?: AppIconName;
};

const toneMap = {
  primary: { border: "#BFEAED", bg: "#EFFBFC", accent: tokens.colors.primaryStrong },
  success: { border: "#BCEEDC", bg: "#ECFDF5", accent: tokens.colors.success },
  warning: { border: "#FDE68A", bg: "#FFFBEB", accent: tokens.colors.warning },
  danger: { border: "#FECDD3", bg: "#FFF1F2", accent: tokens.colors.danger },
  neutral: { border: tokens.colors.border, bg: tokens.colors.surfaceRaised, accent: tokens.colors.textMuted },
} as const;

export function MetricTile({ label, value, hint, tone = "neutral", icon, iconName }: Props) {
  const palette = toneMap[tone];

  return (
    <View style={[styles.card, { borderColor: palette.border, backgroundColor: palette.bg }]}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        {icon || iconName ? (
          <View style={[styles.iconWrap, { backgroundColor: `${palette.accent}22` }]}>
            {icon ? icon : <AppIcon name={iconName as AppIconName} size="sm" tone={tone} />}
          </View>
        ) : null}
      </View>
      <Text style={styles.value}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: tokens.radius.xl,
    padding: tokens.spacing.md,
    gap: 8,
    ...tokens.shadow.soft,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  label: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontFamily: tokens.fontFamily.semibold,
  },
  value: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontWeight: "900",
    lineHeight: 24,
    fontFamily: tokens.fontFamily.bold,
  },
  hint: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.regular,
  },
  iconWrap: {
    minWidth: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});
