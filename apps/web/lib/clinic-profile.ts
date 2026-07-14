import type { Metadata } from "next";
import type { PublicClinicProfile, PublicClinicService } from "@fitnes-saas/contracts";

export type ServiceItem = PublicClinicService;
export type SalonPageData = PublicClinicProfile;

export type ClinicPageProps = {
  params: { salonSlug: string };
};

export const CLINIC_API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || "http://localhost:4949/api";
const WEB_BASE = process.env.NEXT_PUBLIC_WEB_BASE_URL || "https://fizyoflow.com";
const DEFAULT_SHARE_IMAGE = "/brand/fizyoflow-og.svg";
export const ROOT_LEGAL_BASE = "https://fizyoflow.com";
const weekdayLabels = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const schemaWeekdayLabels = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function publicClinicUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const apiOrigin = CLINIC_API_BASE.replace(/\/api\/?$/, "");
  return `${apiOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function getClinicProfile(slug: string): Promise<SalonPageData | null> {
  try {
    const response = await fetch(`${CLINIC_API_BASE}/public/salons/${slug}`, {
      next: { revalidate: 300 },
    });
    if (response.status === 404 || !response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export function getClinicCanonical(slug: string) {
  try {
    const root = new URL(WEB_BASE);
    return `${root.protocol}//${slug}.${root.hostname.replace(/^www\./, "")}`;
  } catch {
    return `https://${slug}.fizyoflow.com`;
  }
}

export function resolveClinicSeo(data: SalonPageData) {
  const location = [data.location?.district, data.location?.city].filter(Boolean).join(" ");
  const title = data.seo_title || `${data.name} | ${location ? `${location} ` : ""}Fizyoterapi ve Klinik Hizmetleri`;
  const description = data.seo_description || data.hero_subtitle || `${data.name} için fizyoterapi, klinik pilates ve hareket odaklı hizmetler. Bilgi ve randevu talebi için iletişime geçin.`;
  return { title, description };
}

export function buildClinicMetadata(data: SalonPageData): Metadata {
  const seo = resolveClinicSeo(data);
  const canonical = getClinicCanonical(data.slug);
  const image = publicClinicUrl(data.hero_image_url || data.gallery_images?.[0]?.url) || DEFAULT_SHARE_IMAGE;
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: canonical,
      siteName: "Fizyoflow",
      type: "website",
      images: [{
        url: image,
        width: image === DEFAULT_SHARE_IMAGE ? 1200 : undefined,
        height: image === DEFAULT_SHARE_IMAGE ? 630 : undefined,
        alt: `${data.name} Fizyoflow klinik vitrini`,
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: [image],
    },
  };
}

export function buildWhatsAppUrl(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.hostname.includes("wa.me")) {
      const phone = url.pathname.replace(/\D+/g, "");
      return phone.length >= 7 && phone.length <= 15 ? `https://wa.me/${phone}` : "";
    }
    if (url.hostname.includes("whatsapp.com")) {
      const phone = url.searchParams.get("phone")?.replace(/\D+/g, "") || url.pathname.replace(/\D+/g, "");
      return phone.length >= 7 && phone.length <= 15 ? `https://wa.me/${phone}` : "";
    }
  } catch {
    // Plain phone numbers continue below.
  }
  let phone = raw.replace(/\D+/g, "");
  if (phone.length === 10 && phone.startsWith("5")) phone = `90${phone}`;
  if (phone.length === 11 && phone.startsWith("0")) phone = `90${phone.slice(1)}`;
  if (phone.length < 7 || phone.length > 15) return "";
  return `https://wa.me/${phone}`;
}

export function withWhatsAppMessage(url: string, message: string) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("text", message);
    return parsed.toString();
  } catch {
    return url;
  }
}

function buildTelHref(value?: string | null) {
  const phone = String(value || "").replace(/[^\d+]/g, "");
  return phone.length >= 7 ? `tel:${phone}` : "";
}

export function slugifyClinicSource(value?: string | null) {
  return String(value || "service")
    .toLowerCase()
    .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
    .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "service";
}

function getOpenStatus(activeDays: number[], startTime?: string | null, endTime?: string | null) {
  if (!activeDays.length || !startTime || !endTime) return "";
  const parts = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const weekdayText = parts.find((part) => part.type === "weekday")?.value.toLowerCase() || "";
  const currentTime = `${parts.find((part) => part.type === "hour")?.value || "00"}:${parts.find((part) => part.type === "minute")?.value || "00"}`;
  const weekdayMap: Record<string, number> = { pzt: 1, pts: 1, sal: 2, çar: 3, car: 3, per: 4, cum: 5, cmt: 6, paz: 7 };
  const today = weekdayMap[weekdayText.slice(0, 3)] || 0;
  if (!activeDays.includes(today)) return "Bugün kapalı olabilir";
  return currentTime >= startTime && currentTime <= endTime ? "Bugün açık olabilir" : "Bugün çalışma saati dışında olabilir";
}

export function buildClinicProfileViewModel(data: SalonPageData) {
  const seo = resolveClinicSeo(data);
  const canonical = getClinicCanonical(data.slug);
  const heroImage = publicClinicUrl(data.hero_image_url || data.gallery_images?.[0]?.url);
  const phone = data.location?.phone || "";
  const whatsapp = buildWhatsAppUrl(data.social_links?.whatsapp || phone);
  const defaultWhatsAppMessage = `Merhaba, ${data.name} Fizyoflow sayfanızdan ulaşıyorum. Bilgi almak istiyorum.`;
  const whatsappWithMessage = withWhatsAppMessage(whatsapp, defaultWhatsAppMessage);
  const telHref = buildTelHref(phone);
  const mapsUrl = data.google_maps_url || data.location?.maps_embed_url || "";
  const services = (data.services || []).filter((service) => service.title).slice(0, 9);
  const gallery = Array.from(new Map([
    ...(data.gallery_images || []).map((image) => ({ id: image.id, url: image.url })),
    ...(data.digital_brief?.gallery_urls || []).map((url, index) => ({ id: `brief-${index}`, url })),
  ].filter((image) => image.url).map((image) => [image.url, image])).values()).slice(0, 6);
  const activeDays = data.business_hours?.working_days || [];
  const locationText = [data.location?.district, data.location?.city].filter(Boolean).join(", ");
  const serviceArea = data.service_area?.length ? data.service_area : [data.location?.district, data.location?.city].filter((value): value is string => Boolean(value));
  const workingHourText = activeDays.length && data.business_hours?.start_time && data.business_hours?.end_time
    ? `${activeDays.map((day) => weekdayLabels[day - 1]).filter(Boolean).join(", ")} · ${data.business_hours.start_time}-${data.business_hours.end_time}`
    : data.digital_brief?.working_hours_note || "Bilgi için iletişime geçin";
  const openStatus = getOpenStatus(activeDays, data.business_hours?.start_time, data.business_hours?.end_time);
  const trustFacts = [data.business_category || "Fizyoterapi Kliniği", locationText || "Yerel klinik vitrini", openStatus, data.managed_growth_status === "live" ? "Fizyoflow ile yayında" : "Fizyoflow vitrini"].filter(Boolean);
  const visibilityCards = [
    { title: "Google'a hazır", body: seo.title },
    { title: "Hızlı iletişim", body: whatsapp ? "WhatsApp, telefon ve form aksiyonları tek yerde." : "Telefon ve form aksiyonları tek yerde." },
    { title: "Yerel güven", body: serviceArea.length ? `${serviceArea.join(", ")} bölgesi için net klinik bilgisi.` : "Adres, hizmet ve iletişim bilgisi birlikte sunulur." },
  ];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: data.name,
    description: seo.description,
    url: canonical,
    image: heroImage || undefined,
    telephone: phone || undefined,
    address: data.location?.address ? { "@type": "PostalAddress", streetAddress: data.location.address, addressLocality: [data.location.district, data.location.city].filter(Boolean).join(", "), addressCountry: "TR" } : undefined,
    sameAs: [data.google_business_url, data.social_links?.instagram, data.social_links?.website].filter(Boolean),
    areaServed: data.service_area,
    openingHours: activeDays.length && data.business_hours?.start_time && data.business_hours?.end_time
      ? activeDays.map((day) => `${schemaWeekdayLabels[day - 1] || "Mo"} ${data.business_hours?.start_time}-${data.business_hours?.end_time}`)
      : undefined,
  };
  return { data, seo, canonical, heroImage, phone, whatsapp, whatsappWithMessage, telHref, mapsUrl, services, gallery, locationText, serviceArea, workingHourText, openStatus, trustFacts, visibilityCards, jsonLd };
}

export type ClinicProfileViewModel = ReturnType<typeof buildClinicProfileViewModel>;
