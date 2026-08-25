import { normalizeApiError } from "./api-error";
import { getPasswordConfirmationMessage, getPasswordValidationMessage } from "./password-validation";

export type FieldErrors<T extends string = string> = Partial<Record<T, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRequired(value: string, label: string) {
  return value.trim() ? null : `${label} zorunludur.`;
}

export function validateEmail(value: string) {
  return EMAIL_PATTERN.test(value.trim()) ? null : "Geçerli bir e-posta adresi gir.";
}

export function validatePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? null : "Geçerli bir telefon numarası gir.";
}

export function validatePositiveNumber(value: string, label: string, options?: { allowZero?: boolean; max?: number }) {
  const numeric = Number(String(value).replace(",", "."));
  const minimumValid = options?.allowZero ? numeric >= 0 : numeric > 0;
  if (!Number.isFinite(numeric) || !minimumValid) return `${label} geçerli bir sayı olmalıdır.`;
  if (typeof options?.max === "number" && numeric > options.max) return `${label} en fazla ${options.max} olabilir.`;
  return null;
}

export type RegistrationField = "first_name" | "last_name" | "email" | "phone" | "password" | "repeat";

export function validateRegistrationFields(form: Record<RegistrationField, string>): FieldErrors<RegistrationField> {
  const errors: FieldErrors<RegistrationField> = {};
  errors.first_name = validateRequired(form.first_name, "Ad") || undefined;
  errors.last_name = validateRequired(form.last_name, "Soyad") || undefined;
  errors.email = validateEmail(form.email) || undefined;
  errors.phone = validatePhone(form.phone) || undefined;
  errors.password = getPasswordValidationMessage(form.password) || undefined;
  errors.repeat = getPasswordConfirmationMessage(form.password, form.repeat) || undefined;
  return compactFieldErrors(errors);
}

export function validateDateTimeRange(input: { startsAt: string | Date; endsAt: string | Date; now?: Date }) {
  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);
  const now = input.now || new Date();
  if (Number.isNaN(start.getTime())) return "Başlangıç tarihi geçerli değil.";
  if (Number.isNaN(end.getTime())) return "Bitiş tarihi geçerli değil.";
  if (start.getTime() < now.getTime()) return "Geçmiş bir tarih seçemezsin.";
  if (end.getTime() <= start.getTime()) return "Bitiş saati başlangıç saatinden sonra olmalıdır.";
  return null;
}

export function getApiFieldErrors<T extends string = string>(error: unknown): FieldErrors<T> {
  const fields = normalizeApiError(error).fieldErrors || {};
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
  ) as FieldErrors<T>;
}

export function firstFieldError<T extends string>(errors: FieldErrors<T>, order: readonly T[]) {
  return order.find((field) => Boolean(errors[field])) || null;
}

export function compactFieldErrors<T extends string>(errors: FieldErrors<T>) {
  return Object.fromEntries(Object.entries(errors).filter(([, value]) => Boolean(value))) as FieldErrors<T>;
}
