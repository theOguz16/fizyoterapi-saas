// Bu paylasilan UI component'i mobil tasarim sistemindeki segmented switch parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from "react-native";
import { tokens } from "../tokens";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Option = {
  label: string;
  value: string;
};

type Props = {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  testID?: string;
};

export function SegmentedSwitch({ value, options, onChange, testID }: Props) {
  function handleChange(nextValue: string) {
    if (nextValue === value) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onChange(nextValue);
  }

  return (
    <View testID={testID} style={styles.wrap}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={testID ? `${testID}-${option.value}` : undefined}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            hitSlop={4}
            onPress={() => handleChange(option.value)}
            style={({ pressed }) => [styles.item, selected ? styles.selected : null, pressed ? styles.pressed : null]}
          >
            <Text style={[styles.label, selected ? styles.selectedLabel : null]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 999,
    backgroundColor: "#EDF5FB",
    padding: 4,
    gap: 4,
    ...tokens.shadow.soft,
  },
  item: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: tokens.spacing.sm,
  },
  selected: {
    backgroundColor: tokens.colors.primary,
    ...tokens.shadow.focus,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  label: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    fontWeight: "800",
    fontFamily: tokens.fontFamily.semibold,
  },
  selectedLabel: {
    color: "#fff",
    fontFamily: tokens.fontFamily.bold,
  },
});
