import type { SalonDiscoverySummary } from "@/lib/mobile-api";
import type { SalonJoinIntent } from "@/lib/local-preferences";
import type { MemberIntentProfile } from "@/providers/app-flow";

type HighlightIcon = "location" | "spark" | "trainer" | "clock";

export type SalonFeatureItem = {
  icon: HighlightIcon;
  label: string;
  value: string;
};

export type SalonServiceHighlight = {
  title: string;
  priceLabel: string;
  description: string;
};

export type MemberSalonConnectionState =
  | { kind: "CONNECTED_LINK"; slug: string; route: string }
  | { kind: "CONNECTION_REQUIRED"; slug: null; route: null };

export type MemberClinicEntryMode = "DIRECT" | "DISCOVERY" | "UNSCOPED";

export function resolveMemberClinicEntryMode(
  intent: Pick<SalonJoinIntent, "slug" | "source"> | null | undefined,
  routeSlug?: string | null
): MemberClinicEntryMode {
  const normalizedRouteSlug = String(routeSlug || "").trim().toLowerCase();
  const normalizedIntentSlug = String(intent?.slug || "").trim().toLowerCase();
  if (!normalizedRouteSlug || normalizedIntentSlug !== normalizedRouteSlug) return "UNSCOPED";
  return intent?.source === "DISCOVERY" ? "DISCOVERY" : "DIRECT";
}

export function isDefinitiveSalonUnavailable(error: unknown) {
  const candidate = error as { status?: unknown; code?: unknown } | null;
  const status = Number(candidate?.status || 0);
  const code = String(candidate?.code || "").toUpperCase();
  return status === 404 || code === "INVALID_TENANT" || code === "SALON_NOT_FOUND";
}

export function resolveMemberSalonConnection(pendingSlug?: string | null): MemberSalonConnectionState {
  const slug = String(pendingSlug || "").trim().toLowerCase();
  if (!slug) {
    return { kind: "CONNECTION_REQUIRED", slug: null, route: null };
  }

  return {
    kind: "CONNECTED_LINK",
    slug,
    route: `/(intake-member)/salons/${slug}`,
  };
}

export function getSalonDiscoveryEmptyGuidance(hasPublishedSalons: boolean, hasActiveFilters: boolean) {
  if (!hasPublishedSalons) {
    return {
      title: "Bağlanabileceğin bir klinik görünmüyor",
      description: "Kliniğinden FizyoFlow QR kodunu, salon bağlantısını veya davet kodunu isteyerek doğrudan doğru kliniğe bağlanabilirsin.",
      action: "SCAN_QR" as const,
    };
  }

  if (hasActiveFilters) {
    return {
      title: "Bu aramayla klinik bulunamadı",
      description: "Arama ve filtreleri temizleyerek yayınlanmış diğer klinikleri inceleyebilirsin.",
      action: "CLEAR_FILTERS" as const,
    };
  }

  return {
    title: "Klinik listesi hazırlanıyor",
    description: "Kliniğinden aldığın QR kodu veya davet bağlantısıyla beklemeden devam edebilirsin.",
    action: "SCAN_QR" as const,
  };
}

function getLocationParts(salon?: SalonDiscoverySummary | null) {
  const location = salon?.location && typeof salon.location === "object" ? salon.location : null;
  const city = String(salon?.city || location?.city || "").trim();
  const district = String(salon?.district || location?.district || "").trim();
  return { city, district };
}

export function getSalonLocationLabel(salon?: SalonDiscoverySummary | null) {
  const { city, district } = getLocationParts(salon);
  return [city, district].filter(Boolean).join(" / ");
}

export function getSalonPrimaryService(salon?: SalonDiscoverySummary | null) {
  const services = Array.isArray(salon?.services) ? salon.services : [];
  return services.find((item) => String(item?.title || "").trim()) || null;
}

export function formatSalonServicePrice(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return "Fiyat bilgisi yakında";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value} TL`;
  }

  const raw = String(value).trim();
  if (!raw) {
    return "Fiyat bilgisi yakında";
  }

  return /\bTL\b/i.test(raw) ? raw : `${raw} TL`;
}

function describeService(title: string, locationLabel: string, summary?: string | null) {
  if (summary && summary.trim()) {
    return summary.trim();
  }

  const normalized = title.toLowerCase();

  if (normalized.includes("reformer") || normalized.includes("pilates")) {
    return `${locationLabel || "Bu salon"} için daha kontrollü duruş ve merkez güç akışı sunar.`;
  }

  if (normalized.includes("pt") || normalized.includes("bireysel")) {
    return "Daha yakın takip, bire bir planlama ve ölçülü ilerleme odağı taşır.";
  }

  if (normalized.includes("grup")) {
    return "Küçük grup ritmiyle daha sosyal ama hâlâ kontrollü bir ders düzeni sunar.";
  }

  if (normalized.includes("postür") || normalized.includes("postur") || normalized.includes("skolyoz")) {
    return "Duruş, omurga ve hareket kalitesini daha yakından takip eden bir akış sunar.";
  }

  return `${locationLabel || "Bu salon"} içinde uyumlu paket ve program akışını destekleyen aktif hizmetlerden biridir.`;
}

export function buildSalonFeatureItems(salon?: SalonDiscoverySummary | null, memberIntent?: MemberIntentProfile | null): SalonFeatureItem[] {
  const locationLabel = getSalonLocationLabel(salon);
  const trainerCount = salon?.trainers?.length || 0;
  const primaryService = getSalonPrimaryService(salon);
  const businessHours = salon?.business_hours;
  const workingHours =
    businessHours?.start_time && businessHours?.end_time
      ? `${businessHours.start_time} - ${businessHours.end_time}`
      : "Saat bilgisi yakında";
  const workingHoursSummary =
    businessHours?.start_time && businessHours?.end_time
      ? `${workingHours} arasında planlı ders akışı`
      : "Çalışma saatleri salon profiline eklendiğinde burada görünecek";

  return [
    {
      icon: "location",
      label: "Konum avantajı",
      value: locationLabel ? `${locationLabel} tarafında güncel salon konumu` : "Konum bilgisi hazırlanıyor",
    },
    {
      icon: "spark",
      label: "Odak alan",
      value: primaryService?.title ? `${primaryService.title} etrafında netleşen deneyim` : salon?.hero_title || "Salon profili güncelleniyor",
    },
    {
      icon: trainerCount > 0 ? "trainer" : "clock",
      label: trainerCount > 0 ? "Eğitmen yapısı" : "Çalışma düzeni",
      value:
        trainerCount > 0
          ? `${trainerCount} eğitmen profiliyle ${memberIntent?.expectation || "uygun"} akışa eşleşebilir`
          : workingHoursSummary,
    },
  ];
}

export function buildSalonServiceHighlights(salon?: SalonDiscoverySummary | null): SalonServiceHighlight[] {
  const locationLabel = getSalonLocationLabel(salon);
  const services = Array.isArray(salon?.services) ? salon.services : [];

  return services
    .filter((item) => String(item?.title || "").trim())
    .sort((a, b) => Number(b?.active_member_count || 0) - Number(a?.active_member_count || 0))
    .slice(0, 1)
    .map((item) => {
      const title = String(item?.title || "").trim();
      const activeMemberCount = Math.max(0, Number(item?.active_member_count || 0));
      const serviceSummary = typeof item?.summary === "string" ? item.summary : null;
      const popularityNote = activeMemberCount > 0 ? `${activeMemberCount} aktif paket sahibi tarafından tercih ediliyor.` : null;
      return {
        title,
        priceLabel: formatSalonServicePrice(item?.starting_price),
        description: [serviceSummary ? describeService(title, locationLabel, serviceSummary) : describeService(title, locationLabel, null), popularityNote]
          .filter(Boolean)
          .join(" "),
      };
    });
}
