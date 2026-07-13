export type BillingCycle = "monthly" | "yearly";

export type SubscriptionValueProof = {
  key: "packages" | "calendar" | "team" | "qr" | "clients" | "reports";
  icon: "package" | "calendar" | "trainer" | "qr" | "clients" | "earnings";
  title: string;
  description: string;
};

export const SUBSCRIPTION_VALUE_PROOFS: readonly SubscriptionValueProof[] = [
  {
    key: "packages",
    icon: "package",
    title: "Paket ve hizmet yönetimi",
    description: "Paketlerini oluştur, satış ve kullanım haklarını tek yerden takip et.",
  },
  {
    key: "calendar",
    icon: "calendar",
    title: "Takvim ve seans planlama",
    description: "Randevuları, grup derslerini, katılımı ve check-in akışını düzenle.",
  },
  {
    key: "team",
    icon: "trainer",
    title: "Ekip yönetimi",
    description: "Uzmanları davet et, çalışma düzenini ve danışan atamalarını yönet.",
  },
  {
    key: "qr",
    icon: "qr",
    title: "QR ve davet akışı",
    description: "Danışanlarını klinik QR'ı veya davet bağlantısıyla doğru kliniğe bağla.",
  },
  {
    key: "clients",
    icon: "clients",
    title: "Danışan takibi",
    description: "Profilleri, paket durumlarını ve seans geçmişini düzenli tut.",
  },
  {
    key: "reports",
    icon: "earnings",
    title: "Gelir ve seans görünümü",
    description: "Operasyonunu gelir, seans ve kullanım verileriyle takip et.",
  },
];

export const SUBSCRIPTION_PRICING: Record<
  BillingCycle,
  {
    label: string;
    shortLabel: string;
    price: string;
    comparePrice: string;
    discount: string;
    badge: string;
    period: string;
    description: string;
    bullets: string[];
  }
> = {
  monthly: {
    label: "Aylık plan",
    shortLabel: "Aylık",
    price: "₺349.99",
    comparePrice: "₺699.99",
    discount: "Lansman fiyatı",
    badge: "Esnek başlangıç",
    period: "/ ay",
    description: "Aylık ödeme ile salonunu yayına al, operasyonunu tek panelden yönet.",
    bullets: ["Operasyon paneli", "Ekip ve üye akışı", "Temel kampanya modülleri"],
  },
  yearly: {
    label: "Yıllık plan",
    shortLabel: "Yıllık",
    price: "₺3,499.90",
    comparePrice: "₺4,199.88",
    discount: "2 ay avantajlı",
    badge: "En avantajlı seçim",
    period: "/ yıl",
    description: "Daha düşük toplam maliyetle salon yönetimini yıl boyunca kesintisiz sürdür.",
    bullets: ["2 ay avantajlı fiyatlama", "Öncelikli onboarding desteği", "Gelişmiş rapor ve otomasyon alanı"],
  },
};
