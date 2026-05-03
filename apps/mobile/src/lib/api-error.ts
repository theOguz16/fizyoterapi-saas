// Bu helper modulu mobil tarafta api error ile ilgili veri donusumu, is kurali veya API erisimini toplar.
// Ekranlar ham ayrintilar yerine bu dosyadaki yardimcilari kullanarak daha yalniz kalir.
export type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class ApiClientError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const UI_ERROR_MAP: Record<string, string> = {
  NO_TOKEN: "Oturum bulunamadı. Lütfen tekrar giriş yapın.",
  INVALID_TOKEN: "Oturum doğrulanamadı. Lütfen tekrar giriş yapın.",
  INVALID_LOGIN: "E-posta veya şifre hatalı.",
  INVALID_TENANT: "Salon bulunamadı.",
  FORBIDDEN: "Bu işlem için yetkiniz yok.",
  VALIDATION_ERROR: "Gönderilen bilgiler doğrulanamadı.",
  MEMBER_AVAILABILITY_OUT_OF_RANGE: "Seçilen saat, danışanın uygunluk aralığı dışında.",
  BOOKING_CANCEL_WINDOW_CLOSED: "Bu randevu için iptal süresi doldu.",
  PACKAGE_TRAINER_ASSIGNMENT_NOT_FOUND: "Bu danışan için atanmış uygun paket yok.",
};

export function resolveApiError(payload: ApiErrorPayload | null | undefined, fallback: string) {
  const code = payload?.error?.code || "";
  if (code && UI_ERROR_MAP[code]) return UI_ERROR_MAP[code];
  if (payload?.error?.message) return payload.error.message;
  return fallback;
}
