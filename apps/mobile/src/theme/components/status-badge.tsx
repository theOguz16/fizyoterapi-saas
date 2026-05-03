// Bu paylasilan UI component'i mobil tasarim sistemindeki status badge parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../tokens";
import { statusLabel } from "@/lib/labels";

type Props = {
  label: string;
  tone?: "primary" | "success" | "warning" | "danger" | "info" | "premium" | "neutral";
};

const palette = {
  primary: { bg: tokens.colors.primaryStrong, fg: "#FFFFFF" },
  success: { bg: "#EAF8EF", fg: tokens.colors.success },
  warning: { bg: "#FFF3D6", fg: tokens.colors.warning },
  danger: { bg: "#FEE2E2", fg: tokens.colors.danger },
  info: { bg: tokens.colors.infoSoft, fg: tokens.colors.trustBlue },
  premium: { bg: "#F3ECFF", fg: tokens.colors.premium },
  neutral: { bg: "#F3F4F6", fg: tokens.colors.textMuted },
} as const;

export function StatusBadge({ label, tone = "neutral" }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor: palette[tone].bg }]}>
      <Text style={[styles.label, { color: palette[tone].fg }]}>{statusLabel(label)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.radius.pill,
  },
  label: {
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
  },
});
