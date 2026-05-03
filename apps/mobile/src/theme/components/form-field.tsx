// Bu paylasilan UI component'i mobil tasarim sistemindeki form field parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { tokens } from "../tokens";

type Props = Omit<TextInputProps, "value" | "onChangeText" | "style"> & {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  helper?: string;
  error?: string;
  inputId?: string;
  testID?: string;
};

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  helper,
  error,
  inputId,
  keyboardType,
  autoCapitalize = "sentences",
  autoCorrect = false,
  textContentType,
  autoComplete,
  multiline = false,
  numberOfLines,
  testID,
  ...inputProps
}: Props) {
  return (
    <View testID={testID} style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.colors.textMuted}
        accessibilityLabel={label}
        accessibilityHint={helper || placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        textContentType={textContentType}
        autoComplete={autoComplete}
        testID={inputId}
        multiline={multiline}
        numberOfLines={numberOfLines}
        style={[styles.input, multiline ? styles.inputMultiline : null, error ? styles.inputError : null]}
        {...inputProps}
      />
      {!!error ? <Text style={styles.error}>{error}</Text> : helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.xs + 2,
  },
  label: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontWeight: "700",
    fontFamily: tokens.fontFamily.semibold,
  },
  input: {
    minHeight: 52,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceRaised,
    color: tokens.colors.text,
    paddingHorizontal: tokens.spacing.md,
    ...tokens.shadow.soft,
    fontFamily: tokens.fontFamily.regular,
  },
  inputMultiline: {
    minHeight: 112,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.md,
    textAlignVertical: "top",
  },
  inputError: {
    borderColor: tokens.colors.danger,
  },
  helper: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.regular,
  },
  error: {
    color: tokens.colors.danger,
    fontSize: tokens.font.xs,
    fontWeight: "700",
    fontFamily: tokens.fontFamily.medium,
  },
});
