// Bu paylasilan UI component'i mobil tasarim sistemindeki info pill parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../tokens";

type Props = {
  label: string;
  value: string | number;
  icon?: ReactNode;
};

export function InfoPill({ label, value, icon }: Props) {
  return (
    <View style={styles.pill}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={styles.text}>
        <Text style={styles.label}>{label}: </Text>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSoft,
    borderRadius: 999,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 8,
  },
  icon: {
    opacity: 0.9,
  },
  label: {
    color: tokens.colors.textMuted,
    fontWeight: "700",
  },
  text: {
    color: tokens.colors.text,
    fontSize: tokens.font.xs,
    flexShrink: 1,
  },
});
