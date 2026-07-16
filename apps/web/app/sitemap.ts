import type { MetadataRoute } from "next";
import { getClinicCanonical, WEB_BASE } from "../lib/clinic-profile";
import { seoLandingPages } from "./seo-content";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || "";
const PUBLIC_SALON_STALE_TTL_MS = 24 * 60 * 60 * 1_000;

type PublicSalon = {
  slug: string;
  updated_at?: string;
};

let publicSalonSnapshot: { rows: PublicSalon[]; cachedAt: number } | null = null;

function readStalePublicSalons(now: number) {
  if (!publicSalonSnapshot || now - publicSalonSnapshot.cachedAt > PUBLIC_SALON_STALE_TTL_MS) return [];
  return publicSalonSnapshot.rows;
}

function normalizePublicSalons(payload: unknown) {
  if (!payload || typeof payload !== "object") return [];
  const rows = (payload as { data?: unknown }).data;
  if (!Array.isArray(rows)) return [];
  const unique = new Map<string, PublicSalon>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const slug = String(record.slug || "").trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) continue;
    unique.set(slug, { slug, updated_at: typeof record.updated_at === "string" ? record.updated_at : undefined });
  }
  return [...unique.values()];
}

export async function getPublicSalons(fetcher: typeof fetch = fetch, now = Date.now()): Promise<PublicSalon[]> {
  if (!API_BASE) return readStalePublicSalons(now);

  try {
    const response = await fetcher(`${API_BASE}/public/salons`, { next: { revalidate: 3600, tags: ["public-clinic-sitemap"] } });
    if (!response.ok) return readStalePublicSalons(now);
    const rows = normalizePublicSalons(await response.json());
    publicSalonSnapshot = { rows, cachedAt: now };
    return rows;
  } catch {
    return readStalePublicSalons(now);
  }
}

export function clearPublicSalonSnapshotForTests() {
  publicSalonSnapshot = null;
}

function safeLastModified(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export function buildClinicSitemapRows(salons: PublicSalon[], now: Date): MetadataRoute.Sitemap {
  return salons.map((salon) => ({
    url: getClinicCanonical(salon.slug),
    lastModified: safeLastModified(salon.updated_at, now),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
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

  const salonRows = buildClinicSitemapRows(await getPublicSalons(), now);

  return [...baseRows, ...salonRows];
}
