// Bu paylasilan UI component'i mobil tasarim sistemindeki app icon parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { StyleSheet, View } from "react-native";
import { tokens } from "../tokens";
import { APP_ICON_COMPONENTS } from "./app-icon.registry";
export type { AppIconName } from "./app-icon.names";
import type { AppIconName } from "./app-icon.names";

type Props = {
  name: AppIconName;
  active?: boolean;
  size?: "sm" | "md" | "lg";
  tone?: "primary" | "success" | "warning" | "danger" | "neutral";
  variant?: "chip" | "plain";
};

const toneMap = {
  primary: { bg: "rgba(151,187,156,0.12)", border: "rgba(151,187,156,0.22)", color: tokens.colors.primaryStrong },
  success: { bg: "rgba(16,155,116,0.12)", border: "rgba(16,155,116,0.22)", color: tokens.colors.success },
  warning: { bg: "rgba(245,158,11,0.14)", border: "rgba(245,158,11,0.28)", color: tokens.colors.warning },
  danger: { bg: "rgba(225,29,72,0.12)", border: "rgba(225,29,72,0.24)", color: tokens.colors.danger },
  neutral: { bg: tokens.colors.surfaceSoft, border: tokens.colors.border, color: tokens.colors.textMuted },
} as const;

const sizeMap = {
  sm: { wrap: 28, icon: 17, radius: 10, stroke: 2.2 },
  md: { wrap: 34, icon: 21, radius: 12, stroke: 2.1 },
  lg: { wrap: 42, icon: 25, radius: 14, stroke: 2 },
} as const;

export function AppIcon({ name, active = false, size = "md", tone = "neutral", variant = "chip" }: Props) {
  const iconSize = sizeMap[size];
  const palette = active ? toneMap.primary : toneMap[tone];
  const Icon = APP_ICON_COMPONENTS[name];

  if (variant === "plain") {
    const plainColor = active ? "#FFFFFF" : palette.color;
    return (
      <View style={[styles.plainWrap, active ? styles.plainWrapActive : null]}>
        <Icon color={plainColor} size={iconSize.icon} strokeWidth={iconSize.stroke} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.wrap,
        {
          width: iconSize.wrap,
          height: iconSize.wrap,
          borderRadius: iconSize.radius,
          backgroundColor: palette.bg,
          borderColor: palette.border,
        },
        active ? styles.wrapActive : null,
      ]}
    >
      <Icon color={palette.color} size={iconSize.icon} strokeWidth={iconSize.stroke} />
    </View>
  );
}

export const Appicon = AppIcon;

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  plainWrap: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 24,
    minHeight: 24,
  },
  plainWrapActive: {
    transform: [{ scale: 1 }],
  },
  wrapActive: {
    ...tokens.shadow.focus,
  },
});
