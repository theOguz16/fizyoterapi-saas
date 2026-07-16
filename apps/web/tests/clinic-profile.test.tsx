import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClinicProfilePage } from "@/components/clinic-profile/clinic-profile-page";
import { ClinicImage } from "@/components/clinic-profile/clinic-image";
import { ClinicUnavailable } from "@/components/clinic-profile/unavailable";
import { buildClinicSitemapRows } from "@/app/sitemap";
import {
  buildClinicMetadata,
  buildClinicProfileViewModel,
  buildUnavailableClinicMetadata,
  buildWhatsAppUrl,
  clearClinicProfileSnapshotsForTests,
  getClinicCanonical,
  loadClinicProfile,
  type SalonPageData,
} from "@/lib/clinic-profile";

const clinic: SalonPageData = {
  id: "clinic-1",
  name: "Kadıköy Fizyo",
  slug: "kadikoy-fizyo",
  seo_title: "Kadıköy Fizyo SEO",
  seo_description: "Klinik SEO açıklaması",
  hero_title: "Hareketinize güvenle dönün",
  business_category: "Fizyoterapi Kliniği",
  service_area: ["Kadıköy", "İstanbul"],
  location: { city: "İstanbul", district: "Kadıköy", phone: "05551234567", address: "Test Sokak 1" },
  social_links: { whatsapp: "05551234567" },
  services: [{ title: "Klinik Pilates", desc: "Kişiye özel program", starting_price: "1.000 TL" }],
  business_hours: { working_days: [1, 2, 3, 4, 5], start_time: "09:00", end_time: "18:00" },
};

describe("clinic profile", () => {
  beforeEach(() => clearClinicProfileSnapshotsForTests());

  it("normalizes contact links and keeps subdomain clinic URLs stable", () => {
    expect(buildWhatsAppUrl("05551234567")).toBe("https://wa.me/905551234567");
    expect(buildWhatsAppUrl("https://wa.me/905551234567?text=ignored")).toBe("https://wa.me/905551234567");
    expect(getClinicCanonical(clinic.slug)).toBe("https://kadikoy-fizyo.fizyoflow.com");
  });

  it("builds stable SEO metadata and LocalBusiness data", () => {
    const metadata = buildClinicMetadata(clinic);
    const model = buildClinicProfileViewModel(clinic);

    expect(metadata).toMatchObject({
      title: "Kadıköy Fizyo SEO",
      description: "Klinik SEO açıklaması",
      alternates: { canonical: "https://kadikoy-fizyo.fizyoflow.com" },
    });
    expect(model.jsonLd).toMatchObject({
      "@type": "LocalBusiness",
      name: "Kadıköy Fizyo",
      telephone: "05551234567",
      areaServed: ["Kadıköy", "İstanbul"],
    });
  });

  it("renders the clinic offer, contact actions and legal links", () => {
    const html = renderToStaticMarkup(<ClinicProfilePage data={clinic} />);

    expect(html).toContain("Hareketinize güvenle dönün");
    expect(html).toContain("Klinik Pilates");
    expect(html).toContain("https://wa.me/905551234567");
    expect(html).toContain('data-track-section="final-cta"');
    expect(html).toContain("https://fizyoflow.com/kvkk");
  });

  it("serves the last successful clinic snapshot when the API is temporarily unavailable", async () => {
    const successfulFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(clinic), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const failingFetch = vi.fn<typeof fetch>().mockRejectedValue(new Error("timeout"));

    await expect(loadClinicProfile(clinic.slug, successfulFetch, 1_000)).resolves.toMatchObject({
      status: "found",
      cacheStatus: "fresh",
    });
    await expect(loadClinicProfile(clinic.slug, failingFetch, 2_000)).resolves.toMatchObject({
      status: "found",
      cacheStatus: "stale",
      data: { id: clinic.id },
    });
  });

  it("keeps a real 404 separate from temporary API failure", async () => {
    const unavailableFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response("upstream error", { status: 503 }));
    const notFoundFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response("not found", { status: 404 }));

    await expect(loadClinicProfile(clinic.slug, unavailableFetch, 1_000)).resolves.toEqual({ status: "unavailable", reason: "upstream" });
    await expect(loadClinicProfile(clinic.slug, notFoundFetch, 2_000)).resolves.toEqual({ status: "not_found" });
  });

  it("marks the unavailable fallback as noindex and keeps canonical URLs equal to sitemap URLs", () => {
    const metadata = buildUnavailableClinicMetadata(clinic.slug);
    const rows = buildClinicSitemapRows([{ slug: clinic.slug, updated_at: "2026-07-16T00:00:00.000Z" }], new Date("2026-07-16T12:00:00.000Z"));
    const html = renderToStaticMarkup(<ClinicUnavailable slug={clinic.slug} />);

    expect(metadata).toMatchObject({ robots: { index: false, follow: false } });
    expect(rows[0]?.url).toBe(getClinicCanonical(clinic.slug));
    expect(html).toContain("Sayfa kaldırılmadı");
    expect(html).toContain(getClinicCanonical(clinic.slug));
  });

  it("removes a broken remote clinic image without leaving an inaccessible placeholder", () => {
    render(<ClinicImage src="https://images.unsplash.com/missing.jpg" alt="Klinik galeri" width={1200} height={900} />);
    fireEvent.error(screen.getByRole("img", { name: "Klinik galeri" }));
    expect(screen.queryByRole("img", { name: "Klinik galeri" })).not.toBeInTheDocument();
  });
});
