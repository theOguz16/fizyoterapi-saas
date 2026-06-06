"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { AppIcon } from "@/components/ui/app-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getApiBase } from "@/lib/api-base";
import { useRequireRole } from "@/lib/require-role";

type ManagedGrowthStatus = "PREPARING" | "WAITING_INFO" | "LIVE" | "OPTIMIZING";

type DigitalBrief = {
  logo_url?: string;
  gallery_urls?: string[];
  working_hours_note?: string;
  review_url?: string;
  campaign_note?: string;
  target_audience?: string;
  brand_voice?: string;
  missing_items?: string[];
  internal_notes?: string;
  approved_at?: string | null;
};

type SettingsPayload = {
  data: {
    profile: {
      slug: string;
      hero_title?: string;
      hero_subtitle?: string;
      hero_image_url?: string;
      about_text?: string;
      seo_title?: string | null;
      seo_description?: string | null;
      google_business_url?: string | null;
      google_maps_url?: string | null;
      business_category?: string | null;
      service_area?: string[];
      managed_growth_status?: ManagedGrowthStatus;
      is_published?: boolean;
      digital_brief?: DigitalBrief;
      social_links?: {
        instagram?: string;
        website?: string;
        whatsapp?: string;
      };
      location?: {
        city?: string;
        district?: string;
        phone?: string;
        address?: string;
        maps_embed_url?: string;
      };
    };
    growth_analytics?: {
      page_views: number;
      cta_clicks: number;
      lead_count: number;
      conversion_rate?: number;
      by_event?: Record<string, number>;
      last_30_days?: Record<string, number>;
    };
  };
};

const briefChecklist = [
  { key: "identity", label: "Klinik kimliği", hint: "Ad, URL, hero metni, logo ve kapak görseli" },
  { key: "location", label: "İletişim ve lokasyon", hint: "Adres, telefon, WhatsApp, Maps ve çalışma notu" },
  { key: "services", label: "Hizmet ve hedef kitle", hint: "Kategori, hizmet bölgeleri, danışan profili" },
  { key: "seo", label: "SEO ve yayın dili", hint: "Title, description, hakkında metni ve marka tonu" },
  { key: "growth", label: "Growth materyalleri", hint: "Galeri, yorum linki, kampanya ve paylaşım notları" },
];

const quickTemplates = [
  {
    title: "SEO açıklaması",
    value: "Klinik adı, lokasyon ve ana hizmetleri net anlatan; WhatsApp ve randevu niyetini destekleyen kısa açıklama hazırlanmalı.",
  },
  {
    title: "WhatsApp karşılama",
    value: "Merhaba, Fizyoflow vitrini üzerinden ulaştığınız için teşekkür ederiz. Size uygun hizmet ve saat bilgisi için birkaç kısa soru sorabilir miyiz?",
  },
  {
    title: "Yorum isteme",
    value: "Deneyiminizden memnun kaldıysanız Google yorumunuz bizim için çok değerli. Kısa yorumunuz yeni danışanların doğru kliniği bulmasına yardımcı olur.",
  },
];

const statusCopy: Record<ManagedGrowthStatus, { label: string; tone: "secondary" | "warning" | "success" | "default"; desc: string }> = {
  PREPARING: {
    label: "Hazırlanıyor",
    tone: "secondary",
    desc: "Fizyoflow ekibi vitrini kuruyor, metin ve görsel düzeni hazırlanıyor.",
  },
  WAITING_INFO: {
    label: "Eksik Bilgi Bekliyor",
    tone: "warning",
    desc: "Yayın için klinikten tamamlanması gereken bilgiler var.",
  },
  LIVE: {
    label: "Yayında",
    tone: "success",
    desc: "Public vitrin ziyaretçilere açık ve ölçüm akışı çalışıyor.",
  },
  OPTIMIZING: {
    label: "Optimizasyonda",
    tone: "default",
    desc: "Sayfa performansı, SEO dili ve CTA akışı iyileştiriliyor.",
  },
};

function splitComma(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinLines(value?: string[]) {
  return (value || []).join("\n");
}

function publicUrl(slug: string) {
  const cleanSlug = slug.trim().toLowerCase();
  return cleanSlug ? `https://${cleanSlug}.fizyoflow.com` : "";
}

function publicUrlLabel(slug: string) {
  return publicUrl(slug) || "URL kodu girilince public link burada oluşacak";
}

function defaultForm() {
  return {
    slug: "",
    hero_title: "",
    hero_subtitle: "",
    hero_image_url: "",
    about_text: "",
    seo_title: "",
    seo_description: "",
    google_business_url: "",
    google_maps_url: "",
    business_category: "Fizyoterapi Kliniği",
    service_area: "",
    managed_growth_status: "PREPARING" as ManagedGrowthStatus,
    is_published: false,
    location: {
      city: "",
      district: "",
      phone: "",
      address: "",
      maps_embed_url: "",
    },
    social_links: {
      instagram: "",
      website: "",
      whatsapp: "",
    },
    digital_brief: {
      logo_url: "",
      gallery_urls: "",
      working_hours_note: "",
      review_url: "",
      campaign_note: "",
      target_audience: "",
      brand_voice: "",
      missing_items: "",
      internal_notes: "",
      approved_at: "",
    },
  };
}

export default function AdminDigitalVitrinePage() {
  const apiBase = getApiBase();
  const { loading, user } = useRequireRole("ADMIN");
  const [form, setForm] = useState(defaultForm);
  const [initialSnapshot, setInitialSnapshot] = useState("");
  const [busy, setBusy] = useState(false);
  const [metrics, setMetrics] = useState<NonNullable<SettingsPayload["data"]["growth_analytics"]>>({ page_views: 0, cta_clicks: 0, lead_count: 0 });

  const currentSnapshot = useMemo(() => JSON.stringify(form), [form]);
  const isDirty = Boolean(initialSnapshot) && currentSnapshot !== initialSnapshot;
  const status = statusCopy[form.managed_growth_status];

  const completionItems = useMemo(() => {
    const identity = Boolean(form.slug && form.hero_title && form.hero_subtitle && form.digital_brief.logo_url);
    const location = Boolean(form.location.address && form.location.phone && form.social_links.whatsapp && form.google_maps_url);
    const services = Boolean(form.business_category && splitComma(form.service_area).length > 0 && form.digital_brief.target_audience);
    const seo = Boolean(form.seo_title && form.seo_description && form.about_text && form.digital_brief.brand_voice);
    const growth = Boolean(splitLines(form.digital_brief.gallery_urls).length > 0 && form.digital_brief.review_url && form.digital_brief.campaign_note);
    return { identity, location, services, seo, growth };
  }, [form]);

  const completion = useMemo(() => {
    const done = Object.values(completionItems).filter(Boolean).length;
    return Math.round((done / briefChecklist.length) * 100);
  }, [completionItems]);

  const missingChecklistLabels = useMemo(
    () => briefChecklist.filter((item) => !completionItems[item.key as keyof typeof completionItems]).map((item) => item.label),
    [completionItems]
  );

  useEffect(() => {
    if (loading || !user) return;
    loadBrief().catch(() => toast.error("Dijital vitrin brief'i yüklenemedi"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.email]);

  async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${apiBase}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        ...(init?.headers || {}),
      },
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!res.ok) throw new Error(payload.error?.message || "İşlem sırasında bir hata oluştu");
    return payload as T;
  }

  async function loadBrief() {
    const payload = await apiRequest<SettingsPayload>("/admin/settings");
    const profile = payload.data.profile;
    const brief = profile.digital_brief || {};
    const nextForm = {
      slug: profile.slug || "",
      hero_title: profile.hero_title || "",
      hero_subtitle: profile.hero_subtitle || "",
      hero_image_url: profile.hero_image_url || "",
      about_text: profile.about_text || "",
      seo_title: profile.seo_title || "",
      seo_description: profile.seo_description || "",
      google_business_url: profile.google_business_url || "",
      google_maps_url: profile.google_maps_url || "",
      business_category: profile.business_category || "Fizyoterapi Kliniği",
      service_area: (profile.service_area || []).join(", "),
      managed_growth_status: profile.managed_growth_status || "PREPARING",
      is_published: Boolean(profile.is_published),
      location: {
        city: profile.location?.city || "",
        district: profile.location?.district || "",
        phone: profile.location?.phone || "",
        address: profile.location?.address || "",
        maps_embed_url: profile.location?.maps_embed_url || "",
      },
      social_links: {
        instagram: profile.social_links?.instagram || "",
        website: profile.social_links?.website || "",
        whatsapp: profile.social_links?.whatsapp || "",
      },
      digital_brief: {
        logo_url: brief.logo_url || "",
        gallery_urls: joinLines(brief.gallery_urls),
        working_hours_note: brief.working_hours_note || "",
        review_url: brief.review_url || "",
        campaign_note: brief.campaign_note || "",
        target_audience: brief.target_audience || "",
        brand_voice: brief.brand_voice || "",
        missing_items: joinLines(brief.missing_items),
        internal_notes: brief.internal_notes || "",
        approved_at: brief.approved_at || "",
      },
    };
    setForm(nextForm);
    setMetrics(payload.data.growth_analytics || { page_views: 0, cta_clicks: 0, lead_count: 0 });
    setInitialSnapshot(JSON.stringify(nextForm));
  }

  async function saveBrief(nextStatus?: ManagedGrowthStatus, publish?: boolean) {
    try {
      setBusy(true);
      const managedStatus = nextStatus || form.managed_growth_status;
      await apiRequest("/admin/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profile: {
            slug: form.slug,
            hero_title: form.hero_title,
            hero_subtitle: form.hero_subtitle,
            hero_image_url: form.hero_image_url,
            about_text: form.about_text,
            seo_title: form.seo_title,
            seo_description: form.seo_description,
            google_business_url: form.google_business_url,
            google_maps_url: form.google_maps_url,
            business_category: form.business_category,
            service_area: splitComma(form.service_area),
            managed_growth_status: managedStatus,
            is_published: publish === undefined ? form.is_published : publish,
            location: {
              ...form.location,
            },
            social_links: {
              ...form.social_links,
            },
            digital_brief: {
              logo_url: form.digital_brief.logo_url,
              gallery_urls: splitLines(form.digital_brief.gallery_urls),
              working_hours_note: form.digital_brief.working_hours_note,
              review_url: form.digital_brief.review_url,
              campaign_note: form.digital_brief.campaign_note,
              target_audience: form.digital_brief.target_audience,
              brand_voice: form.digital_brief.brand_voice,
              missing_items: splitLines(form.digital_brief.missing_items),
              internal_notes: form.digital_brief.internal_notes,
              approved_at: managedStatus === "LIVE" ? form.digital_brief.approved_at || new Date().toISOString() : form.digital_brief.approved_at || null,
            },
          },
        }),
      });
      toast.success("Dijital vitrin brief'i kaydedildi");
      await loadBrief();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Brief kaydedilemedi");
    } finally {
      setBusy(false);
    }
  }

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setLocation<K extends keyof typeof form.location>(key: K, value: string) {
    setForm((prev) => ({ ...prev, location: { ...prev.location, [key]: value } }));
  }

  function setSocial<K extends keyof typeof form.social_links>(key: K, value: string) {
    setForm((prev) => ({ ...prev, social_links: { ...prev.social_links, [key]: value } }));
  }

  function setBrief<K extends keyof typeof form.digital_brief>(key: K, value: string) {
    setForm((prev) => ({ ...prev, digital_brief: { ...prev.digital_brief, [key]: value } }));
  }

  function applyMissingChecklist() {
    setBrief("missing_items", missingChecklistLabels.length ? missingChecklistLabels.join("\n") : "");
    toast.success(missingChecklistLabels.length ? "Eksik bilgi listesi güncellendi" : "Eksik bilgi görünmüyor");
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <p className="text-sm text-muted-foreground">Dijital vitrin briefi hazırlanıyor...</p>
      </main>
    );
  }
  if (!user) return null;

  return (
    <AppShell>
      <PageHeader
        title="Dijital Vitrin Brief'i"
        description="Klinik sahibinden alınan temel bilgileri, Fizyoflow ekibinin yayına hazır public vitrine dönüştürdüğü yönetimli akış."
        iconClassName="fa-solid fa-globe"
        actions={
          <>
            {publicUrl(form.slug) ? (
              <Button variant="outline" asChild>
                <Link href={publicUrl(form.slug)} target="_blank">Public Önizleme</Link>
              </Button>
            ) : null}
            <Button onClick={() => saveBrief()} disabled={busy}>
              {busy ? "Kaydediliyor..." : "Brief'i Kaydet"}
            </Button>
          </>
        }
      />

      {isDirty ? (
        <Card className="surface-card border-amber-200 bg-amber-50/80 xl:sticky xl:top-20 xl:z-20">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-900">Kaydedilmemiş brief değişiklikleri var</p>
              <p className="text-xs text-amber-800">Yayın dili, Maps bilgisi veya growth materyalleri henüz kaydedilmedi.</p>
            </div>
            <Button size="sm" onClick={() => saveBrief()} disabled={busy}>Şimdi Kaydet</Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-3 xl:grid-cols-[1.1fr,0.9fr]">
        <Card className="surface-card overflow-hidden">
          <CardContent className="grid gap-5 p-5 md:grid-cols-[1fr,220px] md:p-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={status.tone}>{status.label}</Badge>
                <Badge variant={form.is_published ? "success" : "secondary"}>{form.is_published ? "Public açık" : "Public kapalı"}</Badge>
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">Yayın hazırlığı {completion}%</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{status.desc}</p>
              {completion < 80 ? (
                <p className="mt-3 rounded-[var(--ui-radius-sm)] border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium leading-5 text-amber-900">
                  Yayına alma için en az %80 hazırlık önerilir. Eksik kalanlar: {missingChecklistLabels.join(", ") || "kontrol edilecek kalem yok"}.
                </p>
              ) : null}
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-sky-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-400 transition-all duration-500"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </div>
            <div className="rounded-[var(--ui-radius-md)] border border-sky-200/70 bg-white/80 p-4 shadow-[var(--ui-shadow-soft)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Public URL</p>
              <p className={`mt-2 break-all text-sm font-semibold ${publicUrl(form.slug) ? "text-slate-900" : "text-slate-500"}`}>
                {publicUrlLabel(form.slug)}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
                <span className="rounded-lg bg-sky-50 p-2 text-sky-700">{metrics.page_views} görüntülenme</span>
                <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">{metrics.cta_clicks} CTA</span>
                <span className="rounded-lg bg-amber-50 p-2 text-amber-700">{metrics.lead_count} lead</span>
                <span className="rounded-lg bg-slate-50 p-2 text-slate-700">%{metrics.conversion_rate ?? 0} dönüşüm</span>
                <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">WA {metrics.by_event?.PUBLIC_SITE_WHATSAPP_CLICK ?? 0}</span>
                <span className="rounded-lg bg-sky-50 p-2 text-sky-700">Harita {metrics.by_event?.PUBLIC_SITE_MAP_CLICK ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader>
            <CardTitle>Yayın Checklisti</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {briefChecklist.map((item) => {
              const done = Boolean(completionItems[item.key as keyof typeof completionItems]);
              return (
                <div key={item.key} className="flex gap-3 rounded-[var(--ui-radius-sm)] border border-sky-100 bg-white/80 p-3">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${done ? "bg-emerald-500 text-white" : "bg-sky-50 text-sky-600"}`}>
                    <AppIcon icon={done ? "fa-solid fa-check" : "fa-solid fa-clock"} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <p className="text-xs leading-5 text-muted-foreground">{item.hint}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr,380px]">
        <div className="grid gap-4">
          <Card className="surface-card">
            <CardHeader>
              <CardTitle>Klinik Kimliği</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <FormField label="Klinik URL Kodu" hint="Örn: atlasfizyo">
                  <Input value={form.slug} onChange={(e) => setField("slug", e.target.value)} />
                </FormField>
                <FormField label="Logo URL">
                  <Input value={form.digital_brief.logo_url} onChange={(e) => setBrief("logo_url", e.target.value)} placeholder="https://..." />
                </FormField>
              </div>
              <FormField label="Hero Başlığı">
                <Input value={form.hero_title} onChange={(e) => setField("hero_title", e.target.value)} placeholder="Atlas Fizyo" />
              </FormField>
              <FormField label="Hero Alt Başlığı">
                <Textarea
                  value={form.hero_subtitle}
                  onChange={(e) => setField("hero_subtitle", e.target.value)}
                  placeholder="Kadıköy'de fizyoterapi, klinik pilates ve sporcu rehabilitasyonu..."
                />
              </FormField>
              <FormField label="Kapak Görseli URL">
                <Input value={form.hero_image_url} onChange={(e) => setField("hero_image_url", e.target.value)} placeholder="https://..." />
              </FormField>
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader>
              <CardTitle>İletişim ve Lokasyon</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <FormField label="Şehir">
                  <Input value={form.location.city} onChange={(e) => setLocation("city", e.target.value)} placeholder="İstanbul" />
                </FormField>
                <FormField label="İlçe / Semt">
                  <Input value={form.location.district} onChange={(e) => setLocation("district", e.target.value)} placeholder="Kadıköy / Moda" />
                </FormField>
              </div>
              <FormField label="Adres">
                <Textarea value={form.location.address} onChange={(e) => setLocation("address", e.target.value)} placeholder="Mahalle, cadde, bina..." />
              </FormField>
              <div className="grid gap-3 md:grid-cols-2">
                <FormField label="Telefon">
                  <Input value={form.location.phone} onChange={(e) => setLocation("phone", e.target.value)} placeholder="+90..." />
                </FormField>
                <FormField label="WhatsApp">
                  <Input value={form.social_links.whatsapp} onChange={(e) => setSocial("whatsapp", e.target.value)} placeholder="https://wa.me/..." />
                </FormField>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <FormField label="Google Maps URL">
                  <Input value={form.google_maps_url} onChange={(e) => setField("google_maps_url", e.target.value)} placeholder="https://maps.google.com/..." />
                </FormField>
                <FormField label="Google Business URL">
                  <Input value={form.google_business_url} onChange={(e) => setField("google_business_url", e.target.value)} placeholder="https://g.page/..." />
                </FormField>
              </div>
              <FormField label="Çalışma Saatleri Notu">
                <Input
                  value={form.digital_brief.working_hours_note}
                  onChange={(e) => setBrief("working_hours_note", e.target.value)}
                  placeholder="Hafta içi 09:00-20:00, Cumartesi 10:00-16:00"
                />
              </FormField>
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader>
              <CardTitle>Hizmet, SEO ve Growth Materyalleri</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <FormField label="İşletme Kategorisi">
                  <Input value={form.business_category} onChange={(e) => setField("business_category", e.target.value)} />
                </FormField>
                <FormField label="Hizmet Bölgeleri" hint="Virgülle ayırın">
                  <Input value={form.service_area} onChange={(e) => setField("service_area", e.target.value)} placeholder="Kadıköy, Moda, Acıbadem" />
                </FormField>
              </div>
              <FormField label="Hedef Danışan Profili">
                <Textarea
                  value={form.digital_brief.target_audience}
                  onChange={(e) => setBrief("target_audience", e.target.value)}
                  placeholder="Ağrı yaşayan masa başı çalışanlar, spor sonrası dönüş arayan danışanlar..."
                />
              </FormField>
              <FormField label="Klinik Hakkında">
                <Textarea value={form.about_text} onChange={(e) => setField("about_text", e.target.value)} placeholder="Kliniğin yaklaşımı, uzmanlığı ve güven dili..." />
              </FormField>
              <div className="grid gap-3 md:grid-cols-2">
                <FormField label="SEO Başlığı">
                  <Input value={form.seo_title} onChange={(e) => setField("seo_title", e.target.value)} placeholder="Atlas Fizyo | Kadıköy Fizyoterapi" />
                </FormField>
                <FormField label="Marka Dili">
                  <Input value={form.digital_brief.brand_voice} onChange={(e) => setBrief("brand_voice", e.target.value)} placeholder="Sakin, güven veren, klinik ama sıcak" />
                </FormField>
              </div>
              <FormField label="SEO Açıklaması">
                <Textarea
                  value={form.seo_description}
                  onChange={(e) => setField("seo_description", e.target.value)}
                  placeholder="Google arama sonuçlarında görünecek doğal açıklama..."
                />
              </FormField>
              <FormField label="Galeri Görsel URL'leri" hint="Her satıra bir görsel URL girin">
                <Textarea value={form.digital_brief.gallery_urls} onChange={(e) => setBrief("gallery_urls", e.target.value)} placeholder="https://..." />
              </FormField>
              <div className="grid gap-3 md:grid-cols-2">
                <FormField label="Yorum İsteme Linki">
                  <Input value={form.digital_brief.review_url} onChange={(e) => setBrief("review_url", e.target.value)} placeholder="Google yorum linki" />
                </FormField>
                <FormField label="Instagram">
                  <Input value={form.social_links.instagram} onChange={(e) => setSocial("instagram", e.target.value)} placeholder="https://instagram.com/..." />
                </FormField>
              </div>
              <FormField label="Kampanya / Paylaşım Notu">
                <Textarea
                  value={form.digital_brief.campaign_note}
                  onChange={(e) => setBrief("campaign_note", e.target.value)}
                  placeholder="İlk değerlendirme, paket duyurusu, WhatsApp karşılama mesajı..."
                />
              </FormField>
            </CardContent>
          </Card>
        </div>

        <aside className="grid content-start gap-4 xl:sticky xl:top-24">
          <Card className="surface-card overflow-hidden">
            <div className="bg-gradient-to-br from-slate-950 via-teal-950 to-emerald-900 p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">Public Vitrin Önizlemesi</p>
              <h3 className="mt-16 text-3xl font-semibold leading-tight">{form.hero_title || "Klinik adı"}</h3>
              <p className="mt-3 text-sm leading-6 text-emerald-50/80">{form.hero_subtitle || "Klinik açıklaması girildiğinde burada görünür."}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold">{form.location.district || "İlçe"}</span>
                <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold">{form.business_category || "Kategori"}</span>
              </div>
            </div>
            <CardContent className="grid gap-3 p-4">
              <div className="rounded-[var(--ui-radius-sm)] border border-sky-100 bg-white p-3">
                <p className="text-xs font-semibold text-sky-700">SEO Başlığı</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{form.seo_title || "Henüz girilmedi"}</p>
              </div>
              <div className="rounded-[var(--ui-radius-sm)] border border-sky-100 bg-white p-3">
                <p className="text-xs font-semibold text-sky-700">Eksik Bilgi Notları</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {form.digital_brief.missing_items || "Eksik bilgi yoksa boş bırakın."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader>
              <CardTitle>Fizyoflow İç Ekibi</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-2 rounded-[var(--ui-radius-md)] border border-sky-100 bg-sky-50/70 p-3">
                <p className="text-sm font-semibold text-slate-900">Hızlı şablonlar</p>
                <div className="grid gap-2">
                  {quickTemplates.map((template) => (
                    <Button
                      key={template.title}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const next = form.digital_brief.internal_notes
                          ? `${form.digital_brief.internal_notes}\n\n${template.title}: ${template.value}`
                          : `${template.title}: ${template.value}`;
                        setBrief("internal_notes", next);
                      }}
                    >
                      {template.title} ekle
                    </Button>
                  ))}
                </div>
              </div>
              <FormField label="Vitrin Durumu">
                <Select value={form.managed_growth_status} onChange={(e) => setField("managed_growth_status", e.target.value as ManagedGrowthStatus)}>
                  <option value="PREPARING">Hazırlanıyor</option>
                  <option value="WAITING_INFO">Eksik Bilgi Bekliyor</option>
                  <option value="LIVE">Yayında</option>
                  <option value="OPTIMIZING">Optimizasyonda</option>
                </Select>
              </FormField>
              <FormField label="Eksik Bilgi Listesi" hint="Her satıra bir eksik bilgi girin">
                <Textarea value={form.digital_brief.missing_items} onChange={(e) => setBrief("missing_items", e.target.value)} />
              </FormField>
              <Button type="button" variant="outline" onClick={applyMissingChecklist}>
                Checklist Eksiklerini Doldur
              </Button>
              <FormField label="İç Not">
                <Textarea value={form.digital_brief.internal_notes} onChange={(e) => setBrief("internal_notes", e.target.value)} />
              </FormField>
              <label className="flex items-center gap-2 rounded-[var(--ui-radius-sm)] border border-sky-100 bg-white p-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(e) => setField("is_published", e.target.checked)}
                />
                Public vitrini yayına aç
              </label>
              <div className="grid gap-2">
                <Button variant="outline" onClick={() => saveBrief("WAITING_INFO", false)} disabled={busy}>
                  Eksik Bilgi Bekliyor
                </Button>
                <Button variant="outline" onClick={() => saveBrief("OPTIMIZING", form.is_published)} disabled={busy}>
                  Optimizasyona Al
                </Button>
                <Button onClick={() => saveBrief("LIVE", true)} disabled={busy || completion < 80}>
                  Yayına Al ve Onayla
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </section>
    </AppShell>
  );
}
