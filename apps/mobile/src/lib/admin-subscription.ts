import type { AdminClinicSubscription } from "./mobile-api";

export function formatSubscriptionStatus(value?: string) {
  if (value === "TRIAL") return "Deneme aktif";
  if (value === "ACTIVE") return "Plan aktif";
  if (value === "READ_ONLY") return "Erişim kısıtlı";
  if (value === "INACTIVE") return "Plan başlamadı";
  return value || "Plan bekleniyor";
}

export function buildSubscriptionHeadline(subscription?: Pick<AdminClinicSubscription, "review_status" | "subscription_status" | "can_start_trial" | "trial_days_remaining">) {
  if (!subscription) return "Salonunu profesyonel mobil yönetim akışına taşımak için planını buradan başlat.";
  if (subscription.review_status !== "PUBLISHED") {
    return "Salon incelemesi tamamlandığında deneme ve satın alma adımı burada açılacak.";
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
    return "5 günlük denemeyi başlat, salonunu ekip ve üye yönetimiyle birlikte canlı kullan.";
  }
  return "Plan durumunu buradan takip edebilir, uygun olduğunda satın alma adımına geçebilirsin.";
}
