import type { MetadataRoute } from "next";
import { seoLandingPages } from "./seo-content";

const WEB_BASE = (process.env.NEXT_PUBLIC_WEB_BASE_URL || "https://fizyoflow.com").replace(/\/$/, "");
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || "";

type PublicSalon = {
  slug: string;
  updated_at?: string;
};

async function getPublicSalons(): Promise<PublicSalon[]> {
  if (!API_BASE) return [];

  try {
    const response = await fetch(`${API_BASE}/public/salons`, { next: { revalidate: 3600 } });
    if (!response.ok) return [];
    const payload = (await response.json()) as { data?: PublicSalon[] };
    return Array.isArray(payload.data) ? payload.data : [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const seoPages = Object.values(seoLandingPages);
  const baseRows: MetadataRoute.Sitemap = [
    {
      url: WEB_BASE,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...seoPages.map((page) => ({
      url: `${WEB_BASE}/${page.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.85,
    })),
    {
      url: `${WEB_BASE}/ornek-klinik`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...["gizlilik-politikasi", "privacy-policy", "hesap-silme", "kvkk", "cerez-politikasi", "kullanim-sartlari"].map((path) => ({
      url: `${WEB_BASE}/${path}`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];

  const host = new URL(WEB_BASE).hostname.replace(/^www\./, "");
  const protocol = new URL(WEB_BASE).protocol;
  const salonRows = (await getPublicSalons()).map((salon) => ({
    url: `${protocol}//${salon.slug}.${host}`,
    lastModified: salon.updated_at ? new Date(salon.updated_at) : now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...baseRows, ...salonRows];
}
