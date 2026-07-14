import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClinicProfilePage } from "@/components/clinic-profile/clinic-profile-page";
import {
  buildClinicMetadata,
  buildClinicProfileViewModel,
  buildWhatsAppUrl,
  getClinicCanonical,
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
});
