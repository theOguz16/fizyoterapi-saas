import { describe, expect, it } from "vitest";
import { resolvePasswordAutofill } from "@/lib/password-validation";
import {
  getPasswordConfirmationMessage,
  getPasswordValidationMessage,
  isPasswordValid,
} from "../../src/lib/password-validation";

describe("password validation", () => {
  it("matches the backend minimum length contract", () => {
    expect(isPasswordValid("1234567")).toBe(false);
    expect(isPasswordValid("12345678")).toBe(true);
    expect(getPasswordValidationMessage("short")).toBe("Şifren en az 8 karakter olmalıdır.");
    expect(getPasswordValidationMessage("long-enough")).toBeNull();
  });

  it("requires the confirmation value to match exactly", () => {
    expect(getPasswordConfirmationMessage("password123", "password123")).toBeNull();
    expect(getPasswordConfirmationMessage("password123", "password124")).toBe("Şifreler eşleşmiyor.");
  });
});

describe("password autofill policy", () => {
  it("keeps current-password autofill but disables the blocking iOS strong-password overlay", () => {
    expect(resolvePasswordAutofill("current")).toMatchObject({ autoComplete: "current-password", textContentType: "password" });
    expect(resolvePasswordAutofill("new")).toMatchObject({ autoComplete: "off", textContentType: "none" });
    expect(resolvePasswordAutofill("confirmation")).toMatchObject({ importantForAutofill: "no", textContentType: "none" });
    expect(resolvePasswordAutofill("current", true)).toMatchObject({ autoComplete: "off", textContentType: "none" });
  });
});
