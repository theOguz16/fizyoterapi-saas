// Bu paylasilan UI component'i mobil tasarim sistemindeki schedule card parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBadge } from "./status-badge";
import { tokens } from "../tokens";

type Props = {
  testID?: string;
  title: string;
  subtitle: string;
  timeLabel: string;
  badge?: { label: string; tone?: "success" | "warning" | "danger" | "info" | "premium" | "neutral" };
  onPress?: () => void;
};

export function ScheduleCard({ testID, title, subtitle, timeLabel, badge, onPress }: Props) {
  const content = (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.time}>{timeLabel}</Text>
        {badge ? <StatusBadge label={badge.label} tone={badge.tone} /> : null}
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );

  if (!onPress) return content;
  return <Pressable testID={testID} onPress={onPress}>{content}</Pressable>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.spacing.md,
    gap: tokens.spacing.xs + 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  time: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.bold,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  subtitle: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.regular,
  },
});
