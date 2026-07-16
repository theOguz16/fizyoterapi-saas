// Bu hata modulu backend'in error catalog ile ilgili ortak hata modelini veya donusumunu tanimlar.
// Farkli katmanlardan gelen hatalarin tek dilde cevap uretebilmesi icin kullanilir.
export const ERROR_CATALOG: Record<string, string> = {
  NO_TOKEN: "Oturum bulunamadı. Lütfen tekrar giriş yapın.",
  INVALID_TOKEN: "Oturum doğrulanamadı. Lütfen tekrar giriş yapın.",
  FORBIDDEN: "Bu işlem için yetkiniz bulunmuyor.",
  NO_TENANT: "Klinik bilgisine ulaşılamadı. Lütfen tekrar deneyin.",
  NO_TENANT_OR_AUTH: "Klinik veya oturum bilgisine ulaşılamadı. Lütfen tekrar giriş yapın.",
  VALIDATION_ERROR: "Gönderilen veriler doğrulanamadı.",
  WEAK_PASSWORD: "Şifre en az 8 karakter olmalıdır.",
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
  MOBILE_DEVICE_REGISTER_ERROR: "Mobil cihaz bildirimi kaydı tamamlanamadı.",
  MOBILE_DEVICE_UNREGISTER_ERROR: "Mobil cihaz bildirimi kaydı kaldırılamadı.",
  INTERNAL_ERROR: "Bir sorun oluştu. Lütfen tekrar deneyin.",
};

export function messageForCode(code: string, fallback: string) {
  return ERROR_CATALOG[code] || fallback;
}
