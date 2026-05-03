// Bu paylasilan UI component'i mobil tasarim sistemindeki empty panel parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SurfaceCard } from "./surface-card";
import { tokens } from "../tokens";
import { AppIcon, type AppIconName } from "./app-icon";

type Props = {
  title: string;
  description: string;
  icon?: ReactNode;
  iconName?: AppIconName;
  iconTone?: "primary" | "success" | "warning" | "danger" | "neutral";
};

export function EmptyPanel({ title, description, icon, iconName, iconTone = "neutral" }: Props) {
  return (
    <SurfaceCard style={styles.card}>
      {icon || iconName ? <View style={styles.icon}>{icon ? icon : <AppIcon name={iconName as AppIconName} size="lg" tone={iconTone} />}</View> : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 160,
    borderStyle: "dashed",
  },
  icon: {
    marginBottom: tokens.spacing.xs,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontWeight: "800",
    textAlign: "center",
    fontFamily: tokens.fontFamily.semibold,
  },
  description: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    textAlign: "center",
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
});
