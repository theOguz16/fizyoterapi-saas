import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react-native";
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { PASSWORD_MIN_LENGTH, resolvePasswordAutofill, type PasswordIntent } from "@/lib/password-validation";
import { tokens } from "../tokens";

type Props = Omit<
  TextInputProps,
  "autoComplete" | "importantForAutofill" | "onChangeText" | "secureTextEntry" | "style" | "textContentType" | "value"
> & {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  inputId: string;
  toggleTestID: string;
  intent: PasswordIntent;
  helper?: string;
  error?: string;
  showRequirement?: boolean;
  errorTestID?: string;
  required?: boolean;
};

export const SecurePasswordField = forwardRef<TextInput, Props>(function SecurePasswordField(
  {
    label,
    value,
    onChangeText,
    inputId,
    toggleTestID,
    intent,
    helper,
    error,
    placeholder,
    showRequirement = false,
    errorTestID,
    required = false,
    ...inputProps
  },
  forwardedRef
) {
  const inputRef = useRef<TextInput>(null);
  const shouldRestoreFocusRef = useRef(false);
  const [visible, setVisible] = useState(false);
  const activeAutofill = resolvePasswordAutofill(intent, visible);

  useImperativeHandle(forwardedRef, () => inputRef.current as TextInput);

  useEffect(() => {
    if (!shouldRestoreFocusRef.current) return;
    shouldRestoreFocusRef.current = false;
    inputRef.current?.focus();
  }, [visible]);

  function toggleVisibility() {
    shouldRestoreFocusRef.current = true;
    setVisible((current) => !current);
  }

  return (
    <View style={styles.container}>
      <Text maxFontSizeMultiplier={1.8} style={styles.label}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text>
      <View style={[styles.inputWrap, error ? styles.inputWrapError : null]}>
        <TextInput
          ref={inputRef}
          testID={inputId}
          accessibilityLabel={`${label}${required ? ", zorunlu alan" : ""}`}
          accessibilityHint={helper || placeholder}
          accessibilityValue={error ? { text: `${value}. Hata: ${error}` } : undefined}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={tokens.colors.textMuted}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          textContentType={activeAutofill.textContentType}
          autoComplete={activeAutofill.autoComplete}
          importantForAutofill={activeAutofill.importantForAutofill}
          style={styles.input}
          maxFontSizeMultiplier={2}
          {...inputProps}
        />
        <Pressable
          testID={toggleTestID}
          accessibilityRole="button"
          accessibilityLabel={visible ? `${label} alanını gizle` : `${label} alanını göster`}
          hitSlop={8}
          onPress={toggleVisibility}
          style={({ pressed }) => [styles.toggle, pressed ? styles.togglePressed : null]}
        >
          {visible ? (
            <EyeOff color={tokens.colors.textMuted} size={20} strokeWidth={2} />
          ) : (
            <Eye color={tokens.colors.textMuted} size={20} strokeWidth={2} />
          )}
        </Pressable>
      </View>
      {error ? <Text maxFontSizeMultiplier={2} testID={errorTestID || `${inputId}-error`} accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {showRequirement ? (
        <Text maxFontSizeMultiplier={2} style={[styles.requirement, value.length >= PASSWORD_MIN_LENGTH ? styles.requirementValid : null]}>
          {value.length >= PASSWORD_MIN_LENGTH ? "✓" : "○"} En az {PASSWORD_MIN_LENGTH} karakter
        </Text>
      ) : helper ? (
        <Text maxFontSizeMultiplier={2} style={styles.helper}>{helper}</Text>
      ) : null}
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
  inputWrap: {
    minHeight: 52,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceRaised,
    flexDirection: "row",
    alignItems: "center",
    ...tokens.shadow.soft,
  },
  inputWrapError: {
    borderColor: tokens.colors.danger,
  },
  input: {
    minHeight: 50,
    flex: 1,
    color: tokens.colors.text,
    paddingLeft: tokens.spacing.md,
    paddingRight: tokens.spacing.sm,
    fontFamily: tokens.fontFamily.regular,
  },
  toggle: {
    width: 48,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  togglePressed: {
    opacity: 0.65,
  },
  helper: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.regular,
  },
  requirement: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.medium,
  },
  requirementValid: {
    color: tokens.colors.success,
  },
  error: {
    color: tokens.colors.danger,
    fontSize: tokens.font.xs,
    fontWeight: "700",
    fontFamily: tokens.fontFamily.medium,
  },
});
