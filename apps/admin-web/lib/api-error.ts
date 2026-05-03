export type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

const UI_ERROR_MAP: Record<string, string> = {
  NO_TOKEN: "Oturum bulunamadı. Lütfen tekrar giriş yapın.",
  INVALID_TOKEN: "Oturum süreniz doldu. Lütfen tekrar giriş yapın.",
  PACKAGE_TRAINER_ASSIGNMENT_NOT_FOUND: "Bu danışan için size atanmış uygun paket yok. Önce paket ataması yapın.",
  MEMBER_PACKAGE_NOT_ACTIVE: "Danışanın aktif paketi bulunmuyor.",
  TRAINER_SKILL_MISMATCH: "Eğitmen bu ders kategorisi için yetkili değil.",
  MEMBER_AVAILABILITY_OUT_OF_RANGE: "Seçilen saat, danışanın bu hafta paylaştığı uygunluk dışında.",
};

export function resolveApiError(payload: ApiErrorPayload | null | undefined, fallback: string) {
  const code = payload?.error?.code || "";
  if (code && UI_ERROR_MAP[code]) return UI_ERROR_MAP[code];
  if (payload?.error?.message) return payload.error.message;
  return fallback;
}
