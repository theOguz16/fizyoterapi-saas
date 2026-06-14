// Bu paylasilan UI component'i mobil tasarim sistemindeki selection chip parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { Pressable, StyleSheet, Text } from "react-native";
import { tokens } from "../tokens";

type Props = {
  label: string;
  active?: boolean;
  onPress: () => void;
  testID?: string;
};

export function SelectionChip({ label, active = false, onPress, testID }: Props) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.base, active ? styles.active : null, pressed ? styles.pressed : null]}
    >
      <Text style={[styles.label, active ? styles.labelActive : null]} maxFontSizeMultiplier={1.4}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: tokens.touch.min,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.surfaceSoft,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  active: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primaryStrong,
    ...tokens.shadow.focus,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.96,
  },
  label: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.medium,
  },
  labelActive: {
    color: "#FFFFFF",
  },
});
