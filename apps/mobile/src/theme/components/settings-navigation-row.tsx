import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AppIconName } from "./app-icon";
import { AppIcon } from "./app-icon";
import { tokens } from "../tokens";

type Props = {
  title: string;
  description: string;
  icon: AppIconName;
  onPress: () => void;
  testID?: string;
};

export function SettingsNavigationRow({ title, description, icon, onPress, testID }: Props) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={styles.icon}>
        <AppIcon name={icon} size="sm" tone="primary" />
      </View>
      <View style={styles.copy}>
        <Text maxFontSizeMultiplier={1.6} style={styles.title}>{title}</Text>
        <Text maxFontSizeMultiplier={2} style={styles.description}>{description}</Text>
      </View>
      <AppIcon name="arrow-right" size="sm" tone="neutral" variant="plain" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: tokens.touch.comfortable,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.border,
  },
  pressed: {
    opacity: 0.7,
  },
  icon: {
    width: tokens.touch.min,
    height: tokens.touch.min,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surfaceSoft,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  description: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: tokens.lineHeight.normal,
    fontFamily: tokens.fontFamily.regular,
  },
});
