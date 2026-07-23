import type { AdminClinicSubscription } from "./mobile-api";

export const CLINIC_TRIAL_DAYS = 21;

export function formatSubscriptionStatus(value?: string) {
  if (value === "TRIAL") return "Deneme aktif";
  if (value === "ACTIVE") return "Plan aktif";
  if (value === "READ_ONLY") return "Erişim kısıtlı";
  if (value === "INACTIVE") return "Plan başlamadı";
  return value || "Plan bekleniyor";
}

export function buildSubscriptionHeadline(
  subscription?: Pick<AdminClinicSubscription, "review_status" | "subscription_status" | "can_start_trial" | "trial_days_remaining"> &
    Partial<Pick<AdminClinicSubscription, "has_billing_issue" | "will_renew">>
) {
  if (!subscription) return "Salonunu profesyonel mobil yönetim akışına taşımak için planını buradan başlat.";
  if (subscription.has_billing_issue) {
    return "Ödeme yöntemin doğrulanamadı. Mevcut dönem sonuna kadar erişimin sürer; kesinti yaşamamak için mağaza ödeme bilgilerini güncelle.";
  }
  if (subscription.subscription_status === "ACTIVE" && subscription.will_renew === false) {
    return "Planın mevcut dönem sonuna kadar aktif. Otomatik yenileme kapalı olduğu için dönem sonunda erişim kısıtlanır.";
  }
  if (subscription.subscription_status === "TRIAL") {
    return `FizyoFlow Pro denemen aktif. Kalan süre: ${subscription.trial_days_remaining || 0} gün.`;
  }
  if (subscription.subscription_status === "ACTIVE") {
    return "FizyoFlow Pro aktif. Salon, eğitmen ve üye akışların kesintisiz çalışıyor.";
  }
  if (subscription.subscription_status === "READ_ONLY") {
    return "Deneme süren bitti. Satın alma ile salon akışlarını tekrar tam erişime açabilirsin.";
  }
  if (subscription.can_start_trial) {
    return `${CLINIC_TRIAL_DAYS} günlük denemeyi başlat, salonunu ekip ve üye yönetimiyle birlikte canlı kullanıma aç.`;
  }
  return "Plan durumunu buradan takip edebilir, uygun olduğunda satın alma adımına geçebilirsin.";
}
