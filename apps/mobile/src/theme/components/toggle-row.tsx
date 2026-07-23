// Bu paylasilan UI component'i mobil tasarim sistemindeki toggle row parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { StyleSheet, Switch, Text, View } from "react-native";
import { tokens } from "../tokens";

type Props = {
  testID?: string;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

export function ToggleRow({ testID, label, description, value, onValueChange, disabled = false }: Props) {
  return (
    <View style={[styles.row, disabled ? styles.rowDisabled : null]}>
      <View style={styles.textWrap}>
        <Text style={[styles.label, disabled ? styles.textDisabled : null]}>{label}</Text>
        <Text style={[styles.description, disabled ? styles.textDisabled : null]}>{description}</Text>
      </View>
      <Switch
        testID={testID}
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityHint={description}
        accessibilityState={{ checked: value, disabled }}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: "#CBD5E1", true: `${tokens.colors.primary}66` }}
        thumbColor={value ? tokens.colors.primary : "#fff"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surfaceSoft,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  rowDisabled: {
    opacity: 0.58,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontWeight: "700",
  },
  description: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 18,
  },
  textDisabled: {
    color: tokens.colors.textMuted,
  },
});
