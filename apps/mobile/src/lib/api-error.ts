// Bu helper modulu mobil tarafta api error ile ilgili veri donusumu, is kurali veya API erisimini toplar.
// Ekranlar ham ayrintilar yerine bu dosyadaki yardimcilari kullanarak daha yalniz kalir.
export type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string | string[]>;
  };
};

export type AppErrorKind =
  | "offline"
  | "timeout"
  | "unauthorized"
  | "forbidden"
  | "not-found"
  | "validation"
  | "conflict"
  | "rate-limit"
  | "server"
  | "unknown";

export type NormalizedAppError = {
  kind: AppErrorKind;
  title: string;
  message: string;
  retryable: boolean;
  status?: number;
  code?: string;
  fieldErrors?: Record<string, string | string[]>;
};

export class ApiClientError extends Error {
  status: number;
  code?: string;
  payload?: ApiErrorPayload;

  constructor(message: string, status: number, code?: string, payload?: ApiErrorPayload) {
    super(message);
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

const UI_ERROR_MAP: Record<string, string> = {
  NO_TOKEN: "Oturum bulunamadı. Lütfen tekrar giriş yapın.",
  INVALID_TOKEN: "Oturum doğrulanamadı. Lütfen tekrar giriş yapın.",
  INVALID_LOGIN: "E-posta veya şifre hatalı.",
  RESET_TOKEN_REQUIRED: "E-postana gönderilen doğrulama kodunu gir.",
  RESET_TOKEN_INVALID: "Doğrulama kodu geçersiz, kullanılmış veya süresi dolmuş.",
  WEAK_PASSWORD: "Yeni şifren en az 8 karakter olmalıdır.",
  PASSWORD_RESET_RATE_LIMITED: "Çok fazla şifre sıfırlama isteği yapıldı. Lütfen kısa bir süre sonra tekrar dene.",
  SESSION_REVOKED: "Şifren değiştiği için oturumun kapatıldı. Yeni şifrenle tekrar giriş yap.",
  INVALID_TENANT: "Klinik bulunamadı.",
  SALON_NOT_FOUND: "Salon bulunamadı",
  NO_TENANT: "Klinik bilgisine ulaşılamadı. Lütfen tekrar deneyin.",
  NO_TENANT_OR_AUTH: "Klinik veya oturum bilgisine ulaşılamadı. Lütfen tekrar giriş yapın.",
  FORBIDDEN: "Bu işlem için yetkiniz yok.",
  VALIDATION_ERROR: "Gönderilen bilgiler doğrulanamadı.",
  CLINIC_ALREADY_ACTIVE: "Aktif bir klinik bağlamın olduğu için yeni klinik oluşturamazsın.",
  PENDING_APPLICATION_EXISTS: "Mevcut klinik başvurunu tamamlamadan yeni klinik oluşturamazsın.",
  CLINIC_ALREADY_PUBLISHED: "Bu hesap için zaten yayınlanmış bir klinik bulunuyor.",
  RESERVED_SLUG: "Bu klinik adı sistem URL'si için kullanılamaz. Farklı bir ad deneyin.",
  MEMBER_AVAILABILITY_OUT_OF_RANGE: "Seçilen saat, danışanın uygunluk aralığı dışında.",
  BOOKING_CANCEL_WINDOW_CLOSED: "Bu randevu için iptal süresi doldu.",
  MEMBER_AVAILABILITY_CREATE_ERROR: "Danışan müsaitlik planı kaydedilemedi.",
  MEMBER_MEASUREMENTS_CREATE_ERROR: "Danışan ölçüm kaydı oluşturulamadı.",
  MEMBER_MEASUREMENTS_LIST_ERROR: "Danışan ölçüm geçmişi getirilemedi.",
  MEMBER_MEASUREMENTS_TREND_ERROR: "Danışan ölçüm değişimi getirilemedi.",
  TRAINER_BOOKING_CREATE_ERROR: "Randevu talebi oluşturulamadı.",
  TRAINER_BOOKING_STATUS_ERROR: "Randevu durumu güncellenemedi.",
  PACKAGE_TRAINER_ASSIGNMENT_NOT_FOUND: "Bu paket için uygun eğitmen ataması bulunamadı.",
  MEMBER_PACKAGE_NOT_ACTIVE: "Danışanın bu paket için aktif kullanım hakkı bulunmuyor.",
  TRAINER_SKILL_MISMATCH: "Eğitmen bu ders kategorisi için yetkili değil.",
  TRAINER_BOOKING_FORM_OPTIONS_ERROR: "Randevu form seçenekleri getirilemedi.",
  MOBILE_DEVICE_REGISTER_ERROR: "Bildirim ayarı kaydedilemedi.",
  MOBILE_DEVICE_UNREGISTER_ERROR: "Bildirim ayarı kaldırılamadı.",
  INTERNAL_ERROR: "Bir sorun oluştu. Lütfen tekrar deneyin.",
};

export function resolveApiError(payload: ApiErrorPayload | null | undefined, fallback: string) {
  const code = payload?.error?.code || "";
  if (code && UI_ERROR_MAP[code]) return UI_ERROR_MAP[code];
  if (code === "REQUEST_TIMEOUT") return "İstek zaman aşımına uğradı. Lütfen tekrar deneyin.";
  if (code) return fallback;
  if (payload?.error?.message) return payload.error.message;
  return fallback;
}

export function resolveHttpStatusMessage(status: number, fallback: string) {
  if (status === 400) return "Gönderilen bilgiler geçerli değil. Alanları kontrol edip tekrar deneyin.";
  if (status === 401) return "Oturumun sona ermiş olabilir. Lütfen tekrar giriş yapın.";
  if (status === 403) return "Bu işlem için yetkiniz yok.";
  if (status === 404) return "İşlem yapılacak kayıt bulunamadı veya artık erişilebilir değil.";
  if (status === 408 || status === 504) return "İstek zaman aşımına uğradı. Lütfen tekrar deneyin.";
  if (status === 409) return "Bu işlem zaten yapılmış veya mevcut durumla çakışıyor. Ekranı yenileyip tekrar deneyin.";
  if (status === 422) return "Gönderilen bilgiler doğrulanamadı. Alanları kontrol edip tekrar deneyin.";
  if (status === 429) return "Çok hızlı işlem yaptın. Kısa bir süre bekleyip tekrar dene.";
  if (status >= 500) return "Sunucuda geçici bir sorun oluştu. Lütfen biraz sonra tekrar deneyin.";
  return fallback;
}

const ERROR_COPY: Record<AppErrorKind, Pick<NormalizedAppError, "title" | "message" | "retryable">> = {
  offline: {
    title: "İnternet bağlantısı yok",
    message: "Son kayıtlı verileri gösteriyoruz. Bağlantını kontrol edip tekrar deneyebilirsin.",
    retryable: true,
  },
  timeout: {
    title: "İstek zaman aşımına uğradı",
    message: "Sunucu beklenenden geç yanıt verdi. Lütfen tekrar dene.",
    retryable: true,
  },
  unauthorized: {
    title: "Oturumun sona erdi",
    message: "Devam etmek için tekrar giriş yapman gerekiyor.",
    retryable: false,
  },
  forbidden: {
    title: "Bu işlem için yetkin yok",
    message: "Bu içeriğe erişmek için gerekli yetkiye sahip değilsin.",
    retryable: false,
  },
  "not-found": {
    title: "Kayıt bulunamadı",
    message: "Aradığın kayıt silinmiş veya artık erişilebilir olmayabilir.",
    retryable: false,
  },
  validation: {
    title: "Bilgileri kontrol et",
    message: "Bazı alanlar doğrulanamadı. İşaretli alanları kontrol edip tekrar dene.",
    retryable: false,
  },
  conflict: {
    title: "İşlem çakıştı",
    message: "Kayıt başka bir işlemle değişmiş olabilir. Ekranı yenileyip tekrar dene.",
    retryable: true,
  },
  "rate-limit": {
    title: "Biraz yavaşlayalım",
    message: "Kısa sürede çok fazla istek gönderildi. Biraz bekleyip tekrar dene.",
    retryable: true,
  },
  server: {
    title: "Geçici bir sorun oluştu",
    message: "Sunucu şu anda yanıt veremiyor. Biraz sonra tekrar dene.",
    retryable: true,
  },
  unknown: {
    title: "Bir sorun oluştu",
    message: "İşlem tamamlanamadı. Lütfen tekrar dene.",
    retryable: true,
  },
};

function errorKind(status: number, code?: string): AppErrorKind {
  if (status === 0 || code === "NETWORK_REQUEST_FAILED") return "offline";
  if (status === 408 || status === 504 || code === "REQUEST_TIMEOUT") return "timeout";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 400 || status === 422 || code === "VALIDATION_ERROR") return "validation";
  if (status === 409) return "conflict";
  if (status === 429) return "rate-limit";
  if (status >= 500) return "server";
  return "unknown";
}

/** Converts transport/API errors into safe, consistent copy for every screen. */
export function normalizeApiError(error: unknown, fallbackMessage?: string): NormalizedAppError {
  const candidate = error && typeof error === "object" ? error as {
    status?: unknown;
    code?: unknown;
    payload?: ApiErrorPayload;
    response?: { status?: unknown; data?: ApiErrorPayload };
  } : null;
  const statusValue = candidate?.status ?? candidate?.response?.status;
  const status = typeof statusValue === "number" ? statusValue : undefined;
  const codeValue = candidate?.code ?? candidate?.payload?.error?.code ?? candidate?.response?.data?.error?.code;
  const code = typeof codeValue === "string" ? codeValue : undefined;
  const kind = errorKind(status ?? -1, code);
  const copy = ERROR_COPY[kind];
  const payload = candidate?.payload ?? candidate?.response?.data;
  const mappedMessage = code && UI_ERROR_MAP[code];

  return {
    kind,
    title: copy.title,
    message: mappedMessage || (kind === "unknown" && fallbackMessage ? fallbackMessage : copy.message),
    retryable: copy.retryable,
    status,
    code,
    fieldErrors: payload?.error?.fields,
  };
}

export function shouldRetryQuery(failureCount: number, error: unknown) {
  const normalized = normalizeApiError(error);
  if (!normalized.retryable || normalized.kind === "offline") return false;
  if (normalized.kind === "rate-limit") return failureCount < 1;
  return failureCount < 2;
}

export function queryRetryDelay(attemptIndex: number) {
  return Math.min(8_000, 750 * 2 ** Math.max(0, attemptIndex));
}
