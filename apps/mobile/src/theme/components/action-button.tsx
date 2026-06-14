// Bu paylasilan UI component'i mobil tasarim sistemindeki action button parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { tokens } from "../tokens";
import { AppIcon, type AppIconName } from "./app-icon";

type Props = {
  label: string;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "ghost" | "danger";
  icon?: AppIconName;
  fullWidth?: boolean;
};

export function ActionButton({
  label,
  onPress,
  testID,
  disabled = false,
  loading = false,
  variant = "primary",
  icon,
  fullWidth = true,
}: Props) {
  const locked = disabled || loading;
  const labelColor = variant === "ghost" ? tokens.colors.text : "#fff";
  const iconTone = variant === "danger" ? "danger" : variant === "ghost" ? "neutral" : "primary";

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: locked, busy: loading }}
      hitSlop={4}
      onPress={onPress}
      disabled={locked}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" && styles.primary,
        variant === "ghost" && styles.ghost,
        variant === "danger" && styles.danger,
        variant === "ghost" && pressed && !locked && styles.ghostPressed,
        variant === "primary" && pressed && !locked && styles.primaryPressed,
        fullWidth ? styles.fullWidth : null,
        locked && styles.disabled,
        pressed && !locked && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <>
          {icon ? (
            <AppIcon
              name={icon}
              size="sm"
              tone={iconTone}
              variant="plain"
              active={variant !== "ghost"}
            />
          ) : null}
          <Text style={[styles.label, { color: labelColor }]} maxFontSizeMultiplier={1.5}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: tokens.touch.comfortable,
    borderRadius: tokens.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm + 1,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    alignSelf: "flex-start",
  },
  fullWidth: { alignSelf: "stretch" },
  primary: {
    backgroundColor: tokens.colors.primaryStrong,
    ...tokens.shadow.focus,
  },
  ghost: {
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  ghostPressed: {
    borderColor: tokens.colors.borderStrong,
    backgroundColor: "#F7FBF8",
  },
  danger: {
    backgroundColor: tokens.colors.danger,
  },
  primaryPressed: {
    shadowOpacity: 0.2,
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    transform: [{ scale: 0.985 }, { translateY: 1 }],
  },
  label: {
    flexShrink: 1,
    fontSize: tokens.font.sm,
    fontWeight: "800",
    fontFamily: tokens.fontFamily.semibold,
    textAlign: "center",
    lineHeight: tokens.lineHeight.normal,
  },
});
