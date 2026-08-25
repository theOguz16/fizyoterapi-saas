import { Pressable, StyleSheet, Text, View } from "react-native";
import type { HomePriorityItem } from "@/lib/home-priority";
import { AppIcon } from "./app-icon";
import { StatusBadge } from "./status-badge";
import { SurfaceCard } from "./surface-card";
import { tokens } from "../tokens";

type Props = {
  item: HomePriorityItem;
  primary?: boolean;
  onPress?: () => void;
};

const badgeTone = {
  primary: "info",
  success: "success",
  warning: "warning",
  danger: "danger",
} as const;

export function HomePriorityCard({ item, primary = false, onPress }: Props) {
  const content = (
    <SurfaceCard tone={item.tone} padding={primary ? "hero" : "regular"} style={styles.card}>
      <View style={styles.header}>
        <AppIcon name={item.icon} size={primary ? "lg" : "md"} tone={item.tone} />
        <View style={styles.copy}>
          <Text style={[styles.title, primary ? styles.primaryTitle : null]}>{item.title}</Text>
          <Text style={styles.description}>{item.description}</Text>
        </View>
        {item.value !== undefined ? (
          <StatusBadge label={String(item.value)} tone={badgeTone[item.tone]} />
        ) : null}
      </View>
      {onPress ? (
        <View style={styles.actionHint}>
          <Text style={styles.actionText}>Aç</Text>
          <AppIcon name="arrow-right" size="sm" tone="primary" variant="plain" />
        </View>
      ) : null}
    </SurfaceCard>
  );

  if (!onPress) {
    return <View testID={item.testID}>{content}</View>;
  }

  return (
    <Pressable
      testID={item.testID}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.description}`}
      onPress={onPress}
      style={({ pressed }) => [pressed ? styles.pressed : null]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 96,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.semibold,
  },
  primaryTitle: {
    fontSize: tokens.font.lg,
  },
  description: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
  actionHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: tokens.spacing.xs,
  },
  actionText: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.99 }],
  },
});
