// Bu paylasilan UI component'i mobil tasarim sistemindeki empty state parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { StyleSheet, Text, View } from "react-native";
import { AppIcon, type AppIconName } from "./app-icon";
import { ActionButton } from "./action-button";
import { tokens } from "../tokens";

type Props = {
  title: string;
  description: string;
  icon?: AppIconName;
  actionLabel?: string;
  actionIcon?: AppIconName;
  actionTestID?: string;
  onAction?: () => void;
};

export function EmptyState({
  title,
  description,
  icon = "spark",
  actionLabel,
  actionIcon = "arrow-right",
  actionTestID,
  onAction,
}: Props) {
  return (
    <View style={styles.card} accessibilityRole="summary" accessibilityLabel={`${title}. ${description}`}>
      <AppIcon name={icon} size="lg" />
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
    padding: tokens.spacing.xl,
    borderRadius: tokens.radius.xl,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    gap: tokens.spacing.sm,
    alignItems: "flex-start",
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.semibold,
  },
  description: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
});
