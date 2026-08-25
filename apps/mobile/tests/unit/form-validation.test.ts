import { describe, expect, it } from "vitest";
import { ApiClientError } from "@/lib/api-error";
import {
  firstFieldError,
  getApiFieldErrors,
  validateDateTimeRange,
  validateEmail,
  validatePhone,
  validatePositiveNumber,
  validateRegistrationFields,
} from "@/lib/form-validation";

describe("form validation", () => {
  it("returns field-level registration errors in focus order", () => {
    const errors = validateRegistrationFields({ first_name: "", last_name: "", email: "bad", phone: "12", password: "short", repeat: "different" });
    expect(errors).toMatchObject({ first_name: expect.any(String), email: expect.any(String), phone: expect.any(String), password: expect.any(String), repeat: expect.any(String) });
    expect(firstFieldError(errors, ["first_name", "last_name", "email", "phone", "password", "repeat"])).toBe("first_name");
  });

  it("accepts normalized identity and positive numeric inputs", () => {
    expect(validateEmail(" user@example.com ")).toBeNull();
    expect(validatePhone("+90 (555) 111 22 33")).toBeNull();
    expect(validatePositiveNumber("12,5", "Fiyat")).toBeNull();
    expect(validatePositiveNumber("101", "Komisyon", { max: 100 })).toContain("100");
  });

  it("rejects past and reversed date-time ranges", () => {
    const now = new Date("2026-08-12T10:00:00.000Z");
    expect(validateDateTimeRange({ startsAt: "2026-08-12T09:00:00.000Z", endsAt: "2026-08-12T11:00:00.000Z", now })).toContain("Geçmiş");
    expect(validateDateTimeRange({ startsAt: "2026-08-12T12:00:00.000Z", endsAt: "2026-08-12T11:00:00.000Z", now })).toContain("Bitiş");
    expect(validateDateTimeRange({ startsAt: "2026-08-12T12:00:00.000Z", endsAt: "2026-08-12T13:00:00.000Z", now })).toBeNull();
  });

  it("maps API validation metadata back to fields", () => {
    const error = new ApiClientError("invalid", 422, "VALIDATION_ERROR", { error: { fields: { email: ["Bu e-posta kullanılıyor."] } } });
    expect(getApiFieldErrors(error)).toEqual({ email: "Bu e-posta kullanılıyor." });
  });
});
