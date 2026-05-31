import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicController } from "../controllers/public.controller";
import { AppDataSource } from "../data-source";
import { SalonProfile, ManagedGrowthStatus } from "../entities/salon-profile.entity";
import { Tenant, TenantReviewStatus, TenantSubscriptionStatus } from "../entities/tenant.entity";
import { AppError } from "../errors/AppError";
import { AuditLogService } from "../services/audit-log.service";
import { TenantLifecycleService } from "../services/tenant-lifecycle.service";
import { createMockResponse } from "./helpers/route-chain";

describe("public managed growth controller", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not resolve reserved public slugs", async () => {
    const repoSpy = vi.spyOn(AppDataSource, "getRepository");

    await expect(PublicController.getSalonPublicPage({ params: { slug: "app" } } as any, createMockResponse() as any)).rejects.toMatchObject({
      code: "SALON_NOT_FOUND",
      statusCode: 404,
    } satisfies Partial<AppError>);

    expect(repoSpy).not.toHaveBeenCalled();
  });

  it("returns safe digital brief fields for published public salons", async () => {
    const tenant = {
      id: "tenant-1",
      name: "Atlas Fizyo",
      slug: "atlasfizyo",
      is_active: true,
      is_public: true,
      review_status: TenantReviewStatus.PUBLISHED,
      subscription_status: TenantSubscriptionStatus.ACTIVE,
    } as Tenant;

    const profile = {
      tenant_id: tenant.id,
      slug: tenant.slug,
      is_published: true,
      hero_title: "Atlas Fizyo",
      hero_subtitle: "Kadıköy fizyoterapi ve klinik pilates",
      managed_growth_status: ManagedGrowthStatus.LIVE,
      service_area: ["Kadıköy", "Moda"],
      why_us: [],
      services: [],
      location: { city: "İstanbul", district: "Kadıköy", phone: "+905555555555" },
      social_links: { whatsapp: "+905555555555" },
      business_hours: {},
      digital_brief: {
        logo_url: "https://cdn.example.com/logo.png",
        gallery_urls: ["https://cdn.example.com/clinic-1.jpg"],
        working_hours_note: "Hafta içi 09:00-20:00",
        review_url: "https://g.page/r/example/review",
        campaign_note: "İlk değerlendirme için WhatsApp'tan bilgi alın.",
        target_audience: "Bel-boyun ağrısı yaşayan danışanlar",
        brand_voice: "Sakin ve güven veren",
        internal_notes: "Public response'a çıkmamalı",
        missing_items: ["Public response'a çıkmamalı"],
      },
    } as SalonProfile;

    vi.spyOn(TenantLifecycleService, "syncTenantState").mockImplementation(async (row) => row as any);
    vi.spyOn(AppDataSource, "getRepository").mockImplementation((entity: any) => {
      if (entity === SalonProfile) {
        return {
          findOne: vi.fn().mockResolvedValue(profile),
        } as any;
      }
      if (entity === Tenant) {
        return {
          findOne: vi.fn().mockResolvedValue(tenant),
        } as any;
      }
      if (typeof entity === "function" && entity.name === "SalonImage") {
        return {
          find: vi.fn().mockResolvedValue([]),
        } as any;
      }
      if (typeof entity === "function" && entity.name === "Package") {
        return {
          find: vi.fn().mockResolvedValue([]),
        } as any;
      }
      throw new Error(`Unexpected repository request: ${String(entity?.name || entity)}`);
    });

    const res = createMockResponse();
    await PublicController.getSalonPublicPage({ params: { slug: "atlasfizyo" } } as any, res as any);

    expect(res.body).toEqual(
      expect.objectContaining({
        slug: "atlasfizyo",
        managed_growth_status: "LIVE",
        digital_brief: {
          logo_url: "https://cdn.example.com/logo.png",
          gallery_urls: ["https://cdn.example.com/clinic-1.jpg"],
          working_hours_note: "Hafta içi 09:00-20:00",
          review_url: "https://g.page/r/example/review",
          campaign_note: "İlk değerlendirme için WhatsApp'tan bilgi alın.",
          target_audience: "Bel-boyun ağrısı yaşayan danışanlar",
          brand_voice: "Sakin ve güven veren",
        },
      })
    );
    expect((res.body as any).digital_brief.internal_notes).toBeUndefined();
    expect((res.body as any).digital_brief.missing_items).toBeUndefined();
  });

  it("accepts product site demo leads without tenant context", async () => {
    const auditSpy = vi.spyOn(AuditLogService, "log").mockResolvedValue(undefined as any);
    const res = createMockResponse();

    await PublicController.createDemoLead(
      {
        method: "POST",
        originalUrl: "/api/public/demo-leads",
        ip: "127.0.0.1",
        headers: { "user-agent": "vitest" },
        body: {
          full_name: "Ayşe Yılmaz",
          clinic_name: "Denge Fizyo",
          phone: "0555 111 22 33",
          city: "Kadıköy",
          note: "Demo almak istiyoruz",
          consent: true,
        },
      } as any,
      res as any
    );

    expect(res.statusCode).toBe(202);
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: null,
        event_type: "PRODUCT_SITE_DEMO_LEAD_SUBMIT",
        metadata: expect.objectContaining({
          source: "PRODUCT_SITE_DEMO",
          clinic_name: "Denge Fizyo",
          phone: "05551112233",
        }),
      })
    );
  });
});
