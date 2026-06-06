export type BillingCycle = "monthly" | "yearly";

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
