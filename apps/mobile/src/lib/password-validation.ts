export const PASSWORD_MIN_LENGTH = 8;

export type PasswordIntent = "current" | "new" | "confirmation";

export function resolvePasswordAutofill(intent: PasswordIntent, visible = false) {
  if (visible) {
    return { autoComplete: "off" as const, importantForAutofill: "no" as const, textContentType: "none" as const };
  }
  if (intent === "current") {
    return { autoComplete: "current-password" as const, importantForAutofill: "yes" as const, textContentType: "password" as const };
  }
  // iOS Strong Password overlay can cover confirmation/submit controls in E2E and real forms.
  return { autoComplete: "off" as const, importantForAutofill: "no" as const, textContentType: "none" as const };
}

export function isPasswordValid(value: string) {
  return value.length >= PASSWORD_MIN_LENGTH;
}

export function getPasswordValidationMessage(value: string) {
  if (!isPasswordValid(value)) {
    return `Şifren en az ${PASSWORD_MIN_LENGTH} karakter olmalıdır.`;
  }

  return null;
}

export function getPasswordConfirmationMessage(password: string, confirmation: string) {
  if (password !== confirmation) return "Şifreler eşleşmiyor.";
  return null;
}
