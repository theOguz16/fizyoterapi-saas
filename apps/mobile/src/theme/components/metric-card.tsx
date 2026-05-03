// Bu paylasilan UI component'i mobil tasarim sistemindeki metric card parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { StyleSheet, Text, View } from "react-native";
import { AppIcon, type AppIconName } from "./app-icon";
import { tokens } from "../tokens";

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  icon: AppIconName;
};

export function MetricCard({ label, value, hint, icon }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppIcon name={icon} size="sm" tone="primary" />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={styles.value}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
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
