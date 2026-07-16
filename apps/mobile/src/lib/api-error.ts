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
  INVALID_TENANT: "Klinik bulunamadı.",
  NO_TENANT: "Klinik bilgisine ulaşılamadı. Lütfen tekrar deneyin.",
  NO_TENANT_OR_AUTH: "Klinik veya oturum bilgisine ulaşılamadı. Lütfen tekrar giriş yapın.",
  FORBIDDEN: "Bu işlem için yetkiniz yok.",
  VALIDATION_ERROR: "Gönderilen bilgiler doğrulanamadı.",
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
  if (code) return fallback;
  if (payload?.error?.message) return payload.error.message;
  return fallback;
}
