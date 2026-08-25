import type { AppIconName } from "@/theme/components/app-icon";

export type RoleActionKey =
  | "SHARED_ACCOUNT_SETTINGS"
  | "SHARED_NOTIFICATION_SETTINGS"
  | "SHARED_SECURITY_SETTINGS"
  | "SHARED_ACCOUNT_ACTIONS"
  | "ADMIN_ENTRY_SCAN"
  | "ADMIN_CLINIC_QR"
  | "ADMIN_CAMPAIGNS"
  | "ADMIN_NOTIFICATIONS"
  | "ADMIN_SALON"
  | "ADMIN_SALON_PROFILE"
  | "ADMIN_WORKING_HOURS"
  | "ADMIN_PACKAGES"
  | "ADMIN_SUBSCRIPTION"
  | "ADMIN_SUBSCRIPTION_HISTORY"
  | "ADMIN_REVENUE_REPORT"
  | "TRAINER_CHECKIN"
  | "TRAINER_GROUP_CLASSES"
  | "TRAINER_REQUEST_CENTER"
  | "TRAINER_BULK_NOTIFICATION"
  | "TRAINER_PACKAGES"
  | "TRAINER_QR"
  | "MEMBER_QR"
  | "MEMBER_REFERRALS"
  | "MEMBER_CAMPAIGNS";

export type RoleActionDefinition = Readonly<{
  label: string;
  description: string;
  icon: AppIconName;
  route: string;
}>;

export const ROLE_ACTIONS: Readonly<Record<RoleActionKey, RoleActionDefinition>> = {
  SHARED_ACCOUNT_SETTINGS: {
    label: "Hesap ayarları",
    description: "Bildirim, güvenlik ve hesap işlemlerini yönet.",
    icon: "settings",
    route: "/(shared)/account-settings",
  },
  SHARED_NOTIFICATION_SETTINGS: {
    label: "Bildirim ayarları",
    description: "Ders, paket ve ölçüm bildirimlerini düzenle.",
    icon: "notifications",
    route: "/(shared)/notification-settings",
  },
  SHARED_SECURITY_SETTINGS: {
    label: "Güvenlik ve şifre",
    description: "Hızlı giriş, şifre desteği ve yasal metinleri aç.",
    icon: "shield",
    route: "/(shared)/security-settings",
  },
  SHARED_ACCOUNT_ACTIONS: {
    label: "Hesap işlemleri",
    description: "Destek, oturum ve üyelik işlemlerini yönet.",
    icon: "profile",
    route: "/(shared)/account-actions",
  },
  ADMIN_ENTRY_SCAN: {
    label: "Giriş tara",
    description: "Üyenin QR veya giriş kodunu kontrol et.",
    icon: "scan",
    route: "/(admin)/entry-scan",
  },
  ADMIN_CLINIC_QR: {
    label: "Salon QR",
    description: "Üyelerin salon bağlantısı için kullanacağı kodu aç.",
    icon: "qr",
    route: "/(admin)/clinic-qr",
  },
  ADMIN_CAMPAIGNS: {
    label: "Kampanyalar",
    description: "Üyelere kampanya veya duyuru gönder.",
    icon: "campaigns",
    route: "/(admin)/campaigns",
  },
  ADMIN_NOTIFICATIONS: {
    label: "Bildirim merkezi",
    description: "Salon bildirimlerini hazırla ve gönder.",
    icon: "notifications",
    route: "/(admin)/notifications",
  },
  ADMIN_SALON: {
    label: "Salon yönetimi",
    description: "Salon bilgileri, çalışma düzeni ve ticari ayarları yönet.",
    icon: "settings",
    route: "/(admin)/salon",
  },
  ADMIN_SALON_PROFILE: {
    label: "Salon profili",
    description: "Salon adı, adresi ve görünen profil bilgilerini düzenle.",
    icon: "clinic",
    route: "/(admin)/salon-profile",
  },
  ADMIN_WORKING_HOURS: {
    label: "Çalışma saatleri",
    description: "Takvimin kullanacağı açık ve kapalı saatleri belirle.",
    icon: "clock",
    route: "/(admin)/working-hours",
  },
  ADMIN_PACKAGES: {
    label: "Paketler",
    description: "Satışa sunulan ders ve üyelik paketlerini yönet.",
    icon: "package",
    route: "/(admin)/packages",
  },
  ADMIN_SUBSCRIPTION: {
    label: "Plan ve abonelik",
    description: "Fizyoflow planını ve ödeme durumunu görüntüle.",
    icon: "subscription",
    route: "/(admin)/subscription",
  },
  ADMIN_SUBSCRIPTION_HISTORY: {
    label: "Abonelik geçmişi",
    description: "Önceki plan ve ödeme hareketlerini incele.",
    icon: "progress",
    route: "/(admin)/subscription-history",
  },
  ADMIN_REVENUE_REPORT: {
    label: "Gelir raporu",
    description: "Detaylı gelir dökümünü ve raporları aç.",
    icon: "earnings",
    route: "/(admin)/revenue-report",
  },
  TRAINER_CHECKIN: {
    label: "QR / kod ile check-in",
    description: "Danışanın QR kodunu veya manuel giriş kodunu kullan.",
    icon: "scan",
    route: "/(trainer)/checkin",
  },
  TRAINER_GROUP_CLASSES: {
    label: "Grup dersleri",
    description: "Grup derslerini oluştur, düzenle ve katılımı takip et.",
    icon: "dumbbell",
    route: "/(trainer)/group-classes",
  },
  TRAINER_REQUEST_CENTER: {
    label: "Bekleyen talepler",
    description: "Saat değişikliği ve iptal taleplerini takip et.",
    icon: "calendar",
    route: "/(trainer)/request-center",
  },
  TRAINER_BULK_NOTIFICATION: {
    label: "Toplu bildirim",
    description: "Seçili danışanlara tek seferde bildirim gönder.",
    icon: "notifications",
    route: "/(trainer)/bulk-notification",
  },
  TRAINER_PACKAGES: {
    label: "Çalışma paketlerim",
    description: "Sana atanmış ders ve paketleri görüntüle.",
    icon: "package",
    route: "/(trainer)/packages",
  },
  TRAINER_QR: {
    label: "Eğitmen QR kodu",
    description: "Eğitmen hesabına ait QR kodunu görüntüle.",
    icon: "qr",
    route: "/(trainer)/qr",
  },
  MEMBER_QR: {
    label: "QR kodumu göster",
    description: "Salondaki giriş işlemi için üyelik QR kodunu aç.",
    icon: "qr",
    route: "/(member)/qr/fullscreen",
  },
  MEMBER_REFERRALS: {
    label: "Arkadaşını davet et",
    description: "Davet kodunu oluştur ve paylaş.",
    icon: "referral",
    route: "/(member)/referrals",
  },
  MEMBER_CAMPAIGNS: {
    label: "Kampanyalar",
    description: "Salonunun sana sunduğu güncel fırsatları gör.",
    icon: "campaigns",
    route: "/(member)/campaigns",
  },
};

export function getRoleAction(key: RoleActionKey) {
  return ROLE_ACTIONS[key];
}

export function buildRoleActionHref(key: RoleActionKey, backTo?: string) {
  const action = getRoleAction(key);
  if (!backTo) return action.route;

  return {
    pathname: action.route,
    params: { backTo },
  };
}
