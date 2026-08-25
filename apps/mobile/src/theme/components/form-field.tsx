// Bu paylasilan UI component'i mobil tasarim sistemindeki form field parcasi icin standart gorunum saglar.
// Farkli ekranlarda ayni stil ve etkileşim dilini korumak icin bu katmanda tutulur.
import { forwardRef } from "react";
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
  errorTestID?: string;
  required?: boolean;
};

export const FormField = forwardRef<TextInput, Props>(function FormField({
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
  errorTestID,
  required = false,
  ...inputProps
}: Props, forwardedRef) {
  return (
    <View testID={testID} style={styles.container}>
      <Text maxFontSizeMultiplier={1.8} style={styles.label}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text>
      <TextInput
        ref={forwardedRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.colors.textMuted}
        accessibilityLabel={`${label}${required ? ", zorunlu alan" : ""}`}
        accessibilityHint={helper || placeholder}
        accessibilityState={{ disabled: Boolean(inputProps.editable === false) }}
        accessibilityValue={error ? { text: `${value}. Hata: ${error}` } : undefined}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        textContentType={textContentType}
        autoComplete={autoComplete}
        testID={inputId}
        multiline={multiline}
        numberOfLines={numberOfLines}
        maxFontSizeMultiplier={2}
        style={[styles.input, multiline ? styles.inputMultiline : null, error ? styles.inputError : null]}
        {...inputProps}
      />
      {error ? <Text maxFontSizeMultiplier={2} testID={errorTestID || (inputId ? `${inputId}-error` : undefined)} accessibilityRole="alert" style={styles.error}>{error}</Text> : helper ? <Text maxFontSizeMultiplier={2} style={styles.helper}>{helper}</Text> : null}
    </View>
  );
});

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
  required: { color: tokens.colors.danger },
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
