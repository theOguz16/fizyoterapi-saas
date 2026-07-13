// Bu paylasilan UI component'i mobil tasarim sistemindeki empty panel parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { tokens } from "../tokens";
import { AppIcon, type AppIconName } from "./app-icon";
import { ActionButton } from "./action-button";

type Props = {
  title: string;
  description: string;
  icon?: ReactNode;
  iconName?: AppIconName;
  iconTone?: "primary" | "success" | "warning" | "danger" | "neutral";
  actionLabel?: string;
  actionIcon?: AppIconName;
  actionTestID?: string;
  onAction?: () => void;
};

export function EmptyPanel({
  title,
  description,
  icon,
  iconName,
  iconTone = "neutral",
  actionLabel,
  actionIcon = "arrow-right",
  actionTestID,
  onAction,
}: Props) {
  return (
    <View style={styles.card} accessibilityRole="summary" accessibilityLabel={`${title}. ${description}`}>
      {icon || iconName ? <View style={styles.icon}>{icon ? icon : <AppIcon name={iconName as AppIconName} size="lg" tone={iconTone} />}</View> : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction ? (
        <ActionButton testID={actionTestID} label={actionLabel} icon={actionIcon} onPress={onAction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 160,
    width: "100%",
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surfaceSoft,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.sm,
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
