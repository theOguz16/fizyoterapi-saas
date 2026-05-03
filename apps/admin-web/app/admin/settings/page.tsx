"use client";
/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRequireRole } from "@/lib/require-role";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { AppIcon } from "@/components/ui/app-icon";
import { getApiBase } from "@/lib/api-base";

type Role = "ADMIN" | "TRAINER" | "MEMBER";
type SessionData = {
  accessToken: string;
  user: {
    role: Role;
    tenantSlug: string;
    email: string;
  };
};

type NotificationType = "PACKAGE_ENDING" | "MEASUREMENT_DUE" | "SESSION_REMINDER";
type TemplateMode = "INSTANT" | "SCHEDULED";
type TemplateCadence = "DAILY" | "WEEKLY" | "EVERY_3_DAYS";
type LessonPackageType = "GROUP" | "PT" | "SCOLIOSIS" | "REFORMER" | "MANUAL" | "OTHER";

type LessonCatalogItem = {
  code: string;
  title: string;
  description: string;
  active: boolean;
  starting_price: string;
  trainer_commission_rate: string;
  capacity_label: string;
  package_type: LessonPackageType;
};

type SettingsPayload = {
  data: {
    profile: {
      slug: string;
      hero_title?: string;
      hero_subtitle?: string;
      about_text?: string;
      theme: string;
      primary_color: string;
      services?: Array<{
        type?: string;
        title?: string;
        desc?: string;
        starting_price?: string;
        active?: boolean;
        trainer_commission_rate?: string | number;
        capacity_label?: string;
        package_type?: LessonPackageType;
      }>;
      business_hours?: {
        timezone?: string;
        working_days?: number[];
        start_time?: string;
        end_time?: string;
        lunch_break_start?: string;
        lunch_break_end?: string;
        slot_minutes?: number;
      };
      location?: {
        address?: string;
        maps_embed_url?: string;
        campaigns?: {
          referral_campaigns?: Array<{
            id?: string;
            required_referrals?: number;
            reward_type?: string;
            reward_value?: number;
            reward_label?: string;
            is_active?: boolean;
          }>;
          loyalty_campaigns?: Array<{
            id?: string;
            min_lessons?: number;
            reward_type?: string;
            reward_value?: number;
            reward_label?: string;
            is_active?: boolean;
          }>;
          cancellation_policy?: {
            min_hours_before_start?: number;
            refund_policy?: string;
          };
        };
        campaign_audit?: Array<{
          id?: string;
          action?: string;
          summary?: string;
          actor_id?: string | null;
          created_at?: string;
        }>;
      };
      is_published: boolean;
    };
    notification_templates: Array<{
      id: string;
      type: NotificationType;
      title: string;
      body: string;
      settings?: {
        mode?: TemplateMode;
        cadence?: TemplateCadence;
        next_run_at?: string | null;
      };
      is_active: boolean;
    }>;
  };
};

type ReferralCampaign = {
  id: string;
  required_referrals: number;
  reward_type: string;
  reward_value: number;
  reward_label: string;
  is_active: boolean;
};

type LoyaltyCampaign = {
  id: string;
  min_lessons: number;
  reward_type: string;
  reward_value: number;
  reward_label: string;
  is_active: boolean;
};

function defaultCampaigns() {
  return {
    referral_campaigns: [
      {
        id: "ref-default-2",
        required_referrals: 2,
        reward_type: "GROUP_CLASS_CREDIT",
        reward_value: 1,
        reward_label: "2 kişi getirene 1 grup dersi",
        is_active: true,
      },
    ] as ReferralCampaign[],
    loyalty_campaigns: [] as LoyaltyCampaign[],
    cancellation_policy: {
      min_hours_before_start: 3,
      refund_policy: "NO_REFUND",
    },
  };
}

function notificationTypeLabel(type: NotificationType) {
  if (type === "PACKAGE_ENDING") return "Paket Bitiş Uyarısı";
  if (type === "MEASUREMENT_DUE") return "Ölçüm Hatırlatması";
  return "Seans Hatırlatması";
}

function lessonPackageTypeLabel(type: LessonPackageType) {
  if (type === "GROUP") return "Grup";
  if (type === "PT") return "PT";
  if (type === "SCOLIOSIS") return "Skolyoz";
  if (type === "REFORMER") return "Reformer";
  if (type === "MANUAL") return "Manuel";
  return "Diğer";
}

function formatTry(value: string | number) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Belirtilmedi";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatRate(value: string | number) {
  const rate = Number(value);
  if (!Number.isFinite(rate)) return "%0";
  return `%${rate % 1 === 0 ? rate.toFixed(0) : rate.toFixed(2)}`;
}

const LESSON_SCENARIOS: Array<Omit<LessonCatalogItem, "active"> & { default_active?: boolean }> = [
  { code: "GRUP", title: "Grup Dersi", description: "Genel kondisyon ve grup egzersizi", starting_price: "200", trainer_commission_rate: "25", capacity_label: "4-8 kişi", package_type: "GROUP", default_active: true },
  { code: "PT", title: "Kişisel Antrenman (PT)", description: "Birebir kişiye özel egzersiz", starting_price: "500", trainer_commission_rate: "25", capacity_label: "1 kişi", package_type: "PT", default_active: true },
  { code: "SKOLYOZ", title: "Skolyoz Takibi", description: "Skolyoz odaklı düzeltici program", starting_price: "500", trainer_commission_rate: "30", capacity_label: "1 kişi", package_type: "SCOLIOSIS", default_active: true },
  { code: "PILATES", title: "Klinik Pilates", description: "Postür, core ve nefes odaklı çalışma", starting_price: "700", trainer_commission_rate: "25", capacity_label: "1-2 kişi", package_type: "OTHER" },
  { code: "REFORMER", title: "Reformer Pilates", description: "Reformer cihazı ile kontrollü antrenman", starting_price: "700", trainer_commission_rate: "25", capacity_label: "1-2 kişi", package_type: "REFORMER" },
  { code: "MANUEL_TERAPI", title: "Manuel Terapi", description: "Eklem ve yumuşak doku odaklı manuel teknikler", starting_price: "900", trainer_commission_rate: "30", capacity_label: "1 kişi", package_type: "MANUAL" },
  { code: "NOROLOJIK_REHAB", title: "Nörolojik Rehabilitasyon", description: "Nörolojik vakalar için fonksiyonel rehabilitasyon", starting_price: "1100", trainer_commission_rate: "35", capacity_label: "1 kişi", package_type: "OTHER" },
  { code: "ORTOPEDIK_REHAB", title: "Ortopedik Rehabilitasyon", description: "Ameliyat/yaralanma sonrası toparlanma süreci", starting_price: "950", trainer_commission_rate: "30", capacity_label: "1 kişi", package_type: "OTHER" },
  { code: "SPORCU_REHAB", title: "Sporcu Sağlığı", description: "Performans artırma ve sakatlık sonrası dönüş", starting_price: "1000", trainer_commission_rate: "30", capacity_label: "1 kişi", package_type: "OTHER" },
  { code: "GEBE_PILATESI", title: "Gebe Pilatesi", description: "Gebelik dönemine özel güvenli egzersiz", starting_price: "750", trainer_commission_rate: "25", capacity_label: "1-3 kişi", package_type: "OTHER" },
  { code: "PEDIATRIK_FIZYO", title: "Pediatrik Fizyoterapi", description: "Çocuk ve ergen dönemine özel fizyoterapi", starting_price: "1000", trainer_commission_rate: "35", capacity_label: "1 kişi", package_type: "OTHER" },
  { code: "POSTUR_DENGE", title: "Postür ve Denge", description: "Duruş bozukluğu ve denge geliştirme seansları", starting_price: "650", trainer_commission_rate: "25", capacity_label: "1-4 kişi", package_type: "OTHER" },
  { code: "BEL_BOYUN", title: "Bel-Boyun Programı", description: "Bel/boyun ağrısı için hedefli seans paketi", starting_price: "800", trainer_commission_rate: "30", capacity_label: "1 kişi", package_type: "OTHER" },
  { code: "LENF_DRENAJ", title: "Lenf Drenaj", description: "Ödem ve dolaşım için manuel drenaj seansları", starting_price: "900", trainer_commission_rate: "30", capacity_label: "1 kişi", package_type: "MANUAL" },
];

const WEEKDAY_OPTIONS = [
  { value: 1, label: "Pzt" },
  { value: 2, label: "Sal" },
  { value: 3, label: "Çar" },
  { value: 4, label: "Per" },
  { value: 5, label: "Cum" },
  { value: 6, label: "Cmt" },
  { value: 7, label: "Paz" },
];

function hasConfiguredBusinessHours(value: SettingsPayload["data"]["profile"]["business_hours"] | null | undefined) {
  if (!value) return false;
  if (typeof value.start_time === "string" && value.start_time.trim()) return true;
  if (typeof value.end_time === "string" && value.end_time.trim()) return true;
  if (typeof value.lunch_break_start === "string" && value.lunch_break_start.trim()) return true;
  if (typeof value.lunch_break_end === "string" && value.lunch_break_end.trim()) return true;
  return Array.isArray(value.working_days) && value.working_days.length > 0;
}

function normalizeLessonCatalog(rawServices: SettingsPayload["data"]["profile"]["services"]): LessonCatalogItem[] {
  const mapped = new Map<string, LessonCatalogItem>();

  for (const scenario of LESSON_SCENARIOS) {
    mapped.set(scenario.code, {
      code: scenario.code,
      title: scenario.title,
      description: scenario.description,
      active: Boolean(scenario.default_active),
      starting_price: scenario.starting_price,
      trainer_commission_rate: scenario.trainer_commission_rate,
      capacity_label: scenario.capacity_label,
      package_type: scenario.package_type,
    });
  }

  for (const service of rawServices || []) {
    const code = String(service?.type || "").trim() || String(service?.title || "").trim().toUpperCase().replace(/\s+/g, "_");
    if (!code) continue;
    const base = mapped.get(code);
    mapped.set(code, {
      code,
      title: String(service?.title || base?.title || code),
      description: String(service?.desc || base?.description || ""),
      active: service?.active === undefined ? base?.active ?? true : Boolean(service.active),
      starting_price: String(service?.starting_price || base?.starting_price || "0"),
      trainer_commission_rate: String(service?.trainer_commission_rate ?? base?.trainer_commission_rate ?? "25"),
      capacity_label: String(service?.capacity_label || base?.capacity_label || "1 kişi"),
      package_type: (service?.package_type as LessonPackageType) || base?.package_type || "OTHER",
    });
  }

  return Array.from(mapped.values()).sort((a, b) => a.title.localeCompare(b.title, "tr"));
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const apiBase = getApiBase();
  const [status, setStatus] = useState<"loading" | "ready" | "unauthorized">("loading");
  const [session, setSession] = useState<SessionData | null>(null);
  const [busy, setBusy] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState("");
  const [showAllCatalogSummary, setShowAllCatalogSummary] = useState(false);

  const [profile, setProfile] = useState({
    slug: "",
    hero_title: "",
    hero_subtitle: "",
    about_text: "",
    theme: "minimal",
    primary_color: "#111827",
    services: normalizeLessonCatalog(undefined),
    business_hours: {
      timezone: "Europe/Istanbul",
      working_days: [] as number[],
      start_time: "",
      end_time: "",
      lunch_break_start: "",
      lunch_break_end: "",
      slot_minutes: 60,
    },
    location: {
      address: "",
      maps_embed_url: "",
      campaigns: defaultCampaigns(),
      campaign_audit: [] as Array<{
        id: string;
        action: string;
        summary: string;
        actor_id?: string | null;
        created_at: string;
      }>,
    },
    is_published: false,
  });
  const [templates, setTemplates] = useState<SettingsPayload["data"]["notification_templates"]>([]);

  const { loading: roleLoading, user: authUser } = useRequireRole("ADMIN");

  useEffect(() => {
    if (roleLoading) {
      setStatus("loading");
      return;
    }
    if (!authUser) {
      setStatus("unauthorized");
      return;
    }

    setSession({
      accessToken: "__cookie_session__",
      user: {
        role: authUser.role,
        tenantSlug: authUser.tenantSlug,
        email: authUser.email,
      },
    });
    setStatus("ready");
  }, [authUser, roleLoading]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (status !== "ready" || !session?.accessToken) return;
    loadSettings().catch(() => toast.error("Ayarlar yüklenemedi"));
  }, [status, session?.accessToken]);

  async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${apiBase}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        ...(init?.headers || {}),
      },
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!res.ok) throw new Error(payload.error?.message || "Request failed");
    return payload as T;
  }

  async function loadSettings() {
    const payload = await apiRequest<SettingsPayload>("/admin/settings");
    const services = normalizeLessonCatalog(payload.data.profile.services);
    const hasBusinessHours = hasConfiguredBusinessHours(payload.data.profile.business_hours);
    const nextProfile = {
      slug: payload.data.profile.slug || "",
      hero_title: payload.data.profile.hero_title || "",
      hero_subtitle: payload.data.profile.hero_subtitle || "",
      about_text: payload.data.profile.about_text || "",
      theme: payload.data.profile.theme || "minimal",
      primary_color: payload.data.profile.primary_color || "#111827",
      services,
      business_hours: {
        timezone: payload.data.profile.business_hours?.timezone || "Europe/Istanbul",
        working_days: hasBusinessHours ? payload.data.profile.business_hours?.working_days || [] : [],
        start_time: hasBusinessHours ? payload.data.profile.business_hours?.start_time || "" : "",
        end_time: hasBusinessHours ? payload.data.profile.business_hours?.end_time || "" : "",
        lunch_break_start: hasBusinessHours ? payload.data.profile.business_hours?.lunch_break_start || "" : "",
        lunch_break_end: hasBusinessHours ? payload.data.profile.business_hours?.lunch_break_end || "" : "",
        slot_minutes: payload.data.profile.business_hours?.slot_minutes || 60,
      },
      location: {
        address: payload.data.profile.location?.address || "",
        maps_embed_url: payload.data.profile.location?.maps_embed_url || "",
        campaigns: {
          ...defaultCampaigns(),
          ...(payload.data.profile.location?.campaigns || {}),
          referral_campaigns:
            payload.data.profile.location?.campaigns?.referral_campaigns?.map((row, index) => ({
              id: row.id || `ref-${index + 1}`,
              required_referrals: Math.max(1, Number(row.required_referrals) || 1),
              reward_type: row.reward_type || "GROUP_CLASS_CREDIT",
              reward_value: Math.max(0, Number(row.reward_value) || 0),
              reward_label: row.reward_label || "Ödül",
              is_active: row.is_active === undefined ? true : Boolean(row.is_active),
            })) || defaultCampaigns().referral_campaigns,
          loyalty_campaigns:
            payload.data.profile.location?.campaigns?.loyalty_campaigns?.map((row, index) => ({
              id: row.id || `loy-${index + 1}`,
              min_lessons: Math.max(1, Number(row.min_lessons) || 1),
              reward_type: row.reward_type || "GROUP_CLASS_CREDIT",
              reward_value: Math.max(0, Number(row.reward_value) || 0),
              reward_label: row.reward_label || "Ödül",
              is_active: row.is_active === undefined ? true : Boolean(row.is_active),
            })) || defaultCampaigns().loyalty_campaigns,
          cancellation_policy: {
            min_hours_before_start: Math.max(
              1,
              Number(payload.data.profile.location?.campaigns?.cancellation_policy?.min_hours_before_start) || 3
            ),
            refund_policy: payload.data.profile.location?.campaigns?.cancellation_policy?.refund_policy || "NO_REFUND",
          },
        },
        campaign_audit:
          payload.data.profile.location?.campaign_audit?.map((row, index) => ({
            id: row.id || `audit-${index + 1}`,
            action: row.action || "CAMPAIGN_RULES_UPDATED",
            summary: row.summary || "Kampanya kuralları güncellendi",
            actor_id: row.actor_id || null,
            created_at: row.created_at || new Date().toISOString(),
          })) || [],
      },
      is_published: Boolean(payload.data.profile.is_published),
    };
    const nextTemplates = payload.data.notification_templates || [];
    setProfile(nextProfile);
    setTemplates(nextTemplates);
    setInitialSnapshot(
      JSON.stringify({
        profile: nextProfile,
        templates: nextTemplates,
      })
    );
  }

  async function saveSettings() {
    try {
      setBusy(true);
      await apiRequest("/admin/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profile: {
            ...profile,
            services: profile.services.map((service) => ({
              type: service.code,
              title: service.title,
              desc: service.description,
              starting_price: service.starting_price,
              active: service.active,
              trainer_commission_rate: service.trainer_commission_rate,
              capacity_label: service.capacity_label,
              package_type: service.package_type,
            })),
          },
          notification_templates: templates.map((tpl) => ({
            type: tpl.type,
            title: tpl.title,
            body: tpl.body,
            settings: tpl.settings ?? { mode: "INSTANT", cadence: "DAILY", next_run_at: null },
            is_active: tpl.is_active,
          })),
        }),
      });
      toast.success("Ayarlar kaydedildi");
      await loadSettings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ayarlar kaydedilemedi");
    } finally {
      setBusy(false);
    }
  }

  async function triggerTemplate(type: NotificationType) {
    try {
      await apiRequest("/admin/settings/notifications/trigger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type }),
      });
      toast.success("Bildirim tetiklendi (mock push)");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bildirim tetiklenemedi");
    }
  }

  function addReferralCampaign() {
    setProfile((prev) => ({
      ...prev,
      location: {
        ...prev.location,
        campaigns: {
          ...prev.location.campaigns,
          referral_campaigns: [
            ...(prev.location.campaigns.referral_campaigns || []),
            {
              id: `ref-${Date.now()}`,
              required_referrals: 2,
              reward_type: "GROUP_CLASS_CREDIT",
              reward_value: 1,
              reward_label: "Yeni referans ödülü",
              is_active: true,
            },
          ],
        },
      },
    }));
  }

  function addLoyaltyCampaign() {
    setProfile((prev) => ({
      ...prev,
      location: {
        ...prev.location,
        campaigns: {
          ...prev.location.campaigns,
          loyalty_campaigns: [
            ...(prev.location.campaigns.loyalty_campaigns || []),
            {
              id: `loy-${Date.now()}`,
              min_lessons: 50,
              reward_type: "GROUP_CLASS_CREDIT",
              reward_value: 1,
              reward_label: "Sadakat ödülü",
              is_active: true,
            },
          ],
        },
      },
    }));
  }

  const activeServices = useMemo(
    () => profile.services.filter((service) => service.active),
    [profile.services]
  );

  const uniqueActiveServices = useMemo(() => {
    const map = new Map<string, LessonCatalogItem>();
    for (const service of activeServices) {
      const key = [
        service.title.trim().toLocaleLowerCase("tr"),
        service.capacity_label.trim().toLocaleLowerCase("tr"),
        service.package_type,
      ].join("|");
      if (!map.has(key)) {
        map.set(key, service);
      }
    }
    return Array.from(map.values());
  }, [activeServices]);

  const visibleSummaryServices = useMemo(
    () => (showAllCatalogSummary ? uniqueActiveServices : uniqueActiveServices.slice(0, 8)),
    [showAllCatalogSummary, uniqueActiveServices]
  );

  const hiddenServiceCount = Math.max(0, uniqueActiveServices.length - visibleSummaryServices.length);
  const campaignAuditRows = useMemo(
    () =>
      [...(profile.location.campaign_audit || [])]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 12),
    [profile.location.campaign_audit]
  );
  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        profile,
        templates,
      }),
    [profile, templates]
  );
  const isDirty = Boolean(initialSnapshot) && currentSnapshot !== initialSnapshot;

  if (status === "loading") {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <p className="text-sm text-muted-foreground">Oturum kontrol ediliyor...</p>
      </main>
    );
  }
  if (status === "unauthorized") return null;

  return (
    <AppShell>
      <PageHeader
        title="Klinik Profil ve Bildirim Ayarları"
        description="Son kullanıcıda görünen metinleri ve klinik iletişim dilini kurumsal olarak yönetin."
        actions={
          <ActionButton action="save" onClick={saveSettings} disabled={busy}>
            {busy ? "Kaydediliyor..." : "Ayarları Kaydet"}
          </ActionButton>
        }
      />

      {isDirty ? (
        <Card className="surface-card border-amber-200 bg-amber-50/80 xl:sticky xl:top-20 xl:z-20">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-900">Kaydedilmemiş değişiklikler var</p>
              <p className="text-xs text-amber-800">
                Klinik profili, kampanyalar veya bildirim şablonlarında yaptığınız değişiklikler henüz kaydedilmedi.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton
                action="refresh"
                variant="outline"
                onClick={() => loadSettings().catch(() => toast.error("Ayarlar yüklenemedi"))}
              >
                Geri Al
              </ActionButton>
              <ActionButton action="save" onClick={saveSettings} disabled={busy}>
                {busy ? "Kaydediliyor..." : "Şimdi Kaydet"}
              </ActionButton>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Aktif Ders" value={activeServices.length} tone="sky" icon={<i className="fa-solid fa-book-medical" aria-hidden="true" />} />
        <MetricCard label="Tekil Özet" value={uniqueActiveServices.length} tone="emerald" icon={<i className="fa-solid fa-layer-group" aria-hidden="true" />} />
        <MetricCard label="Referans Kampanyası" value={profile.location.campaigns.referral_campaigns.length} tone="amber" icon={<i className="fa-solid fa-user-group" aria-hidden="true" />} />
        <MetricCard label="Bildirim Şablonu" value={templates.length} tone="slate" icon={<i className="fa-solid fa-bell" aria-hidden="true" />} />
      </section>

      <Card className="surface-card">
        <CardContent className="grid gap-3 p-5 lg:grid-cols-[1.4fr,1fr]">
          <div className="section-band">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Bölüm Kısayolları</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href="#settings-clinic-profile" className="interactive rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-medium text-sky-700">Klinik Profili</a>
              <a href="#settings-working-hours" className="interactive rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-medium text-sky-700">Çalışma Saatleri</a>
              <a href="#settings-lesson-catalog" className="interactive rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-medium text-sky-700">Ders Kataloğu</a>
              <a href="#settings-campaigns" className="interactive rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-medium text-sky-700">Kampanyalar</a>
              <a href="#settings-notifications" className="interactive rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-medium text-sky-700">Bildirimler</a>
              <a href="#settings-audit" className="interactive rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-medium text-sky-700">Audit</a>
            </div>
          </div>
          <div className="section-band">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Canlı Özet</p>
            <div className="mt-3 grid gap-2 text-sm">
              <div className="detail-pill">
                <AppIcon icon="fa-solid fa-globe" className="text-sky-600" />
                <span>Yayın durumu: {profile.is_published ? "Açık" : "Kapalı"}</span>
              </div>
              <div className="detail-pill">
                <AppIcon icon="fa-solid fa-calendar-days" className="text-sky-600" />
                <span>Çalışma günü: {(profile.business_hours.working_days || []).length || 0} gün</span>
              </div>
              <div className="detail-pill">
                <AppIcon icon="fa-solid fa-ban" className="text-sky-600" />
                <span>Planlama için minimum süre: {profile.location.campaigns.cancellation_policy.min_hours_before_start} saat</span>
              </div>
              <div className="detail-pill">
                <AppIcon icon="fa-solid fa-boxes-stacked" className="text-sky-600" />
                <span className="inline-flex items-center gap-2">Katalog akışı: <Link href="/admin/package-trainers" className="accent-text-link">Paket ekranına git</Link></span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="settings-clinic-profile" className="surface-card">
        <CardHeader>
          <CardTitle>Klinik Profili</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <FormField label="Klinik URL Kodu" hint="Kısa ve okunabilir bir URL kodu kullanın">
            <Input
              placeholder="Klinik URL kodu"
              value={profile.slug}
              onChange={(e) => setProfile((p) => ({ ...p, slug: e.target.value }))}
            />
          </FormField>
          <FormField label="Hero Başlığı">
            <Input
              placeholder="Ana vitrinde görünecek başlığı girin"
              value={profile.hero_title}
              onChange={(e) => setProfile((p) => ({ ...p, hero_title: e.target.value }))}
            />
          </FormField>
          <FormField label="Hero Alt Başlığı">
            <Input
              placeholder="Kliniği kısa bir cümleyle özetleyin"
              value={profile.hero_subtitle}
              onChange={(e) => setProfile((p) => ({ ...p, hero_subtitle: e.target.value }))}
            />
          </FormField>
          <FormField label="Klinik Hakkında">
            <Textarea
              placeholder="Klinik hakkında detaylı açıklama. Hizmet yaklaşımı, ekip yapısı ve güven vurgusu ekleyin."
              value={profile.about_text}
              onChange={(e) => setProfile((p) => ({ ...p, about_text: e.target.value }))}
            />
          </FormField>
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="Tema">
              <Input
                placeholder="Tema adını girin"
                value={profile.theme}
                onChange={(e) => setProfile((p) => ({ ...p, theme: e.target.value }))}
              />
            </FormField>
            <FormField label="Ana Renk">
              <Input
                placeholder="Ana renk (#0EA5E9)"
                value={profile.primary_color}
                onChange={(e) => setProfile((p) => ({ ...p, primary_color: e.target.value }))}
              />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={profile.is_published} onChange={(e) => setProfile((p) => ({ ...p, is_published: e.target.checked }))} />
            Profili yayınla (son kullanıcıya aç)
          </label>
        </CardContent>
      </Card>

      <Card id="settings-working-hours" className="surface-card">
        <CardHeader>
          <CardTitle>Çalışma Saatleri ve Seans Aralığı</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Saat dilimi (Europe/Istanbul)"
              value={profile.business_hours.timezone}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  business_hours: { ...p.business_hours, timezone: e.target.value },
                }))
              }
            />
            <Input
              type="number"
              min={15}
              max={180}
              step={15}
              placeholder="Ders süresi (dk)"
              value={profile.business_hours.slot_minutes}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  business_hours: { ...p.business_hours, slot_minutes: Number(e.target.value) || 60 },
                }))
              }
            />
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Input
              type="time"
              value={profile.business_hours.start_time}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  business_hours: { ...p.business_hours, start_time: e.target.value },
                }))
              }
            />
            <Input
              type="time"
              value={profile.business_hours.end_time}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  business_hours: { ...p.business_hours, end_time: e.target.value },
                }))
              }
            />
            <Input
              type="time"
              value={profile.business_hours.lunch_break_start}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  business_hours: { ...p.business_hours, lunch_break_start: e.target.value },
                }))
              }
            />
            <Input
              type="time"
              value={profile.business_hours.lunch_break_end}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  business_hours: { ...p.business_hours, lunch_break_end: e.target.value },
                }))
              }
            />
          </div>
          <div className="section-band grid gap-2">
            <p className="text-xs text-muted-foreground">Çalışma günleri</p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((day) => {
                const selected = (profile.business_hours.working_days || []).includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    className={`interactive rounded-lg border px-3 py-1.5 text-sm ${
                      selected
                        ? "border-sky-400 bg-sky-50 text-sky-700"
                        : "border-border bg-white text-muted-foreground"
                    }`}
                    onClick={() =>
                      setProfile((p) => {
                        const current = p.business_hours.working_days || [];
                        const next = current.includes(day.value)
                          ? current.filter((item) => item !== day.value)
                          : [...current, day.value];
                        return {
                          ...p,
                          business_hours: {
                            ...p.business_hours,
                            working_days: next.sort((a, b) => a - b),
                          },
                        };
                      })
                    }
                  >
                    {day.label}
                  </button>
                );
              })}
              <ActionButton
                action="refresh"
                type="button"
                variant="outline"
                onClick={() =>
                  setProfile((p) => ({
                    ...p,
                    business_hours: {
                      ...p.business_hours,
                      working_days: [1, 2, 3, 4, 5, 6, 7],
                    },
                  }))
                }
              >
                Haftanın Tamamı
              </ActionButton>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Bu ayarlar eğitmen takviminde görünen slotları belirler. Hazır saat önerisi göstermiyoruz; çalışma düzeninizi doğrudan girin.
          </p>
        </CardContent>
      </Card>

      <Card id="settings-lesson-catalog" className="surface-card">
        <CardHeader>
          <CardTitle>Ders ve Paket Özeti</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Ders tanımı, paket üretimi ve eğitmen yetkisi artık tek akışta yönetiliyor. Bu bölüm yalnızca özet görünümü verir.
          </p>
          <div className="rounded-2xl border border-sky-200/70 bg-gradient-to-r from-sky-50 to-emerald-50 p-4 shadow-[0_12px_32px_-20px_rgba(16,185,129,0.45)]">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white/70 bg-white/90 p-3">
                <p className="text-xs text-muted-foreground">Toplam Ders Tanımı</p>
                <p className="text-xl font-semibold">{profile.services.length}</p>
              </div>
              <div className="rounded-xl border border-white/70 bg-white/90 p-3">
                <p className="text-xs text-muted-foreground">Aktif Satılabilir Ders</p>
                <p className="text-xl font-semibold">{activeServices.length}</p>
              </div>
              <div className="rounded-xl border border-white/70 bg-white/90 p-3">
                <p className="text-xs text-muted-foreground">Özet Kartta Gösterilen</p>
                <p className="text-xl font-semibold">{uniqueActiveServices.length}</p>
              </div>
            </div>

            <div className="mt-4 section-band">
              <p className="text-sm font-medium text-slate-900">Bu alanda işlem yapılmaz.</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Ders ekleme, paket üretme ve eğitmen yetkilendirme işlemleri tek noktadan yönetilsin diye ayrı ekrana taşındı.
              </p>
            </div>
          </div>
          <ActionButton type="button" action="view" variant="outline" onClick={() => router.push("/admin/package-trainers")}>
            Ders ve Paket Akışını Yönet
          </ActionButton>
        </CardContent>
      </Card>

      <Card id="settings-campaigns" className="surface-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Kampanya Yönetimi</CardTitle>
          <div className="flex gap-2">
            <ActionButton type="button" action="create" size="sm" variant="outline" onClick={addReferralCampaign}>
              Referans Kampanyası Ekle
            </ActionButton>
            <ActionButton type="button" action="create" size="sm" variant="outline" onClick={addLoyaltyCampaign}>
              Sadakat Kampanyası Ekle
            </ActionButton>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <article className="rounded-xl border border-border bg-background p-3">
            <p className="text-sm font-medium">Referans Kampanyaları</p>
            <p className="text-xs text-muted-foreground">
              Örn: 2 kişi üye getiren kullanıcıya 1 grup dersi hediyesi.
            </p>
            <div className="mt-3 grid gap-3">
              {(profile.location.campaigns.referral_campaigns || []).map((campaign, index) => (
                <div key={campaign.id} className="list-row grid gap-2 rounded-2xl p-3 md:grid-cols-5">
                  <Input
                    type="number"
                    min={1}
                    placeholder="Referans sayısı"
                    value={campaign.required_referrals}
                    onChange={(e) =>
                      setProfile((prev) => {
                        const list = [...(prev.location.campaigns.referral_campaigns || [])];
                        list[index] = { ...list[index], required_referrals: Math.max(1, Number(e.target.value) || 1) };
                        return {
                          ...prev,
                          location: { ...prev.location, campaigns: { ...prev.location.campaigns, referral_campaigns: list } },
                        };
                      })
                    }
                  />
                  <Select
                    value={campaign.reward_type}
                    onChange={(e) =>
                      setProfile((prev) => {
                        const list = [...(prev.location.campaigns.referral_campaigns || [])];
                        list[index] = { ...list[index], reward_type: e.target.value };
                        return {
                          ...prev,
                          location: { ...prev.location, campaigns: { ...prev.location.campaigns, referral_campaigns: list } },
                        };
                      })
                    }
                  >
                    <option value="GROUP_CLASS_CREDIT">Grup Dersi Hediyesi</option>
                    <option value="MANUAL_THERAPY_SESSION">Manuel Terapi Seansı</option>
                    <option value="DISCOUNT_PERCENT">% İndirim</option>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Ödül değeri"
                    value={campaign.reward_value}
                    onChange={(e) =>
                      setProfile((prev) => {
                        const list = [...(prev.location.campaigns.referral_campaigns || [])];
                        list[index] = { ...list[index], reward_value: Math.max(0, Number(e.target.value) || 0) };
                        return {
                          ...prev,
                          location: { ...prev.location, campaigns: { ...prev.location.campaigns, referral_campaigns: list } },
                        };
                      })
                    }
                  />
                  <Input
                    placeholder="Ödül etiketi"
                    value={campaign.reward_label}
                    onChange={(e) =>
                      setProfile((prev) => {
                        const list = [...(prev.location.campaigns.referral_campaigns || [])];
                        list[index] = { ...list[index], reward_label: e.target.value };
                        return {
                          ...prev,
                          location: { ...prev.location, campaigns: { ...prev.location.campaigns, referral_campaigns: list } },
                        };
                      })
                    }
                  />
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={campaign.is_active}
                      onChange={(e) =>
                        setProfile((prev) => {
                          const list = [...(prev.location.campaigns.referral_campaigns || [])];
                          list[index] = { ...list[index], is_active: e.target.checked };
                          return {
                            ...prev,
                            location: { ...prev.location, campaigns: { ...prev.location.campaigns, referral_campaigns: list } },
                          };
                        })
                      }
                    />
                    Aktif
                  </label>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-background p-3">
            <p className="text-sm font-medium">Sadakat Kampanyaları</p>
            <p className="text-xs text-muted-foreground">
              Örn: 50+ ders tamamlayan üyeye ödül tanımlayın.
            </p>
            <div className="mt-3 grid gap-3">
              {(profile.location.campaigns.loyalty_campaigns || []).map((campaign, index) => (
                <div key={campaign.id} className="list-row grid gap-2 rounded-2xl p-3 md:grid-cols-5">
                  <Input
                    type="number"
                    min={1}
                    placeholder="Min ders"
                    value={campaign.min_lessons}
                    onChange={(e) =>
                      setProfile((prev) => {
                        const list = [...(prev.location.campaigns.loyalty_campaigns || [])];
                        list[index] = { ...list[index], min_lessons: Math.max(1, Number(e.target.value) || 1) };
                        return {
                          ...prev,
                          location: { ...prev.location, campaigns: { ...prev.location.campaigns, loyalty_campaigns: list } },
                        };
                      })
                    }
                  />
                  <Select
                    value={campaign.reward_type}
                    onChange={(e) =>
                      setProfile((prev) => {
                        const list = [...(prev.location.campaigns.loyalty_campaigns || [])];
                        list[index] = { ...list[index], reward_type: e.target.value };
                        return {
                          ...prev,
                          location: { ...prev.location, campaigns: { ...prev.location.campaigns, loyalty_campaigns: list } },
                        };
                      })
                    }
                  >
                    <option value="GROUP_CLASS_CREDIT">Grup Dersi Hediyesi</option>
                    <option value="MANUAL_THERAPY_SESSION">Manuel Terapi Seansı</option>
                    <option value="DISCOUNT_PERCENT">% İndirim</option>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Ödül değeri"
                    value={campaign.reward_value}
                    onChange={(e) =>
                      setProfile((prev) => {
                        const list = [...(prev.location.campaigns.loyalty_campaigns || [])];
                        list[index] = { ...list[index], reward_value: Math.max(0, Number(e.target.value) || 0) };
                        return {
                          ...prev,
                          location: { ...prev.location, campaigns: { ...prev.location.campaigns, loyalty_campaigns: list } },
                        };
                      })
                    }
                  />
                  <Input
                    placeholder="Ödül etiketi"
                    value={campaign.reward_label}
                    onChange={(e) =>
                      setProfile((prev) => {
                        const list = [...(prev.location.campaigns.loyalty_campaigns || [])];
                        list[index] = { ...list[index], reward_label: e.target.value };
                        return {
                          ...prev,
                          location: { ...prev.location, campaigns: { ...prev.location.campaigns, loyalty_campaigns: list } },
                        };
                      })
                    }
                  />
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={campaign.is_active}
                      onChange={(e) =>
                        setProfile((prev) => {
                          const list = [...(prev.location.campaigns.loyalty_campaigns || [])];
                          list[index] = { ...list[index], is_active: e.target.checked };
                          return {
                            ...prev,
                            location: { ...prev.location, campaigns: { ...prev.location.campaigns, loyalty_campaigns: list } },
                          };
                        })
                      }
                    />
                    Aktif
                  </label>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-background p-3">
            <p className="text-sm font-medium">Planlama ve İptal Politikası</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <Input
                type="number"
                min={1}
                value={profile.location.campaigns.cancellation_policy.min_hours_before_start}
                onChange={(e) =>
                  setProfile((prev) => ({
                    ...prev,
                    location: {
                      ...prev.location,
                      campaigns: {
                        ...prev.location.campaigns,
                        cancellation_policy: {
                          ...prev.location.campaigns.cancellation_policy,
                          min_hours_before_start: Math.max(1, Number(e.target.value) || 1),
                        },
                      },
                    },
                  }))
                }
                placeholder="Planlama için minimum saat"
              />
              <Select
                value={profile.location.campaigns.cancellation_policy.refund_policy}
                onChange={(e) =>
                  setProfile((prev) => ({
                    ...prev,
                    location: {
                      ...prev.location,
                      campaigns: {
                        ...prev.location.campaigns,
                        cancellation_policy: {
                          ...prev.location.campaigns.cancellation_policy,
                          refund_policy: e.target.value,
                        },
                      },
                    },
                  }))
                }
              >
                <option value="NO_REFUND">Ücret iadesi yok</option>
                <option value="POLICY_DEFINED">İade klinik politikasına bağlı</option>
              </Select>
            </div>
          </article>
        </CardContent>
      </Card>

      <Card id="settings-notifications" className="surface-card">
        <CardHeader>
          <CardTitle>Bildirim Şablonları</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {templates.length === 0 ? (
            <EmptyState
              icon={<i className="fa-solid fa-bell-slash" aria-hidden="true" />}
              title="Bildirim şablonu bulunmuyor"
              description="Hatırlatma ve lifecycle mesajları tanımlandığında bu alanda düzenlenebilir."
            />
          ) : templates.map((tpl) => (
            <article key={tpl.id} className="list-row rounded-2xl px-4 py-4">
              <div className="flex items-center justify-between gap-2">
                <strong>{notificationTypeLabel(tpl.type)}</strong>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={tpl.is_active}
                    onChange={(e) =>
                      setTemplates((prev) => prev.map((row) => (row.id === tpl.id ? { ...row, is_active: e.target.checked } : row)))
                    }
                  />
                  Aktif
                </label>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Şablon kodu: {tpl.type}</p>
              <Input
                className="mt-3"
                placeholder="Bildirim başlığı (kısa ve yönlendirici)"
                value={tpl.title}
                onChange={(e) => setTemplates((prev) => prev.map((row) => (row.id === tpl.id ? { ...row, title: e.target.value } : row)))}
              />
              <Textarea
                className="mt-3"
                placeholder="Bildirim içeriği (kullanıcıya ne yapması gerektiğini net söyleyin)"
                value={tpl.body}
                onChange={(e) => setTemplates((prev) => prev.map((row) => (row.id === tpl.id ? { ...row, body: e.target.value } : row)))}
              />
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <Select
                  value={tpl.settings?.mode || "INSTANT"}
                  onChange={(e) =>
                    setTemplates((prev) =>
                      prev.map((row) =>
                        row.id === tpl.id
                          ? {
                              ...row,
                              settings: {
                                ...(row.settings || {}),
                                mode: e.target.value as TemplateMode,
                              },
                            }
                          : row
                      )
                    )
                  }
                >
                  <option value="INSTANT">Hemen Gönder</option>
                  <option value="SCHEDULED">Planlı Gönderim</option>
                </Select>
                <Select
                  value={tpl.settings?.cadence || "DAILY"}
                  onChange={(e) =>
                    setTemplates((prev) =>
                      prev.map((row) =>
                        row.id === tpl.id
                          ? {
                              ...row,
                              settings: {
                                ...(row.settings || {}),
                                cadence: e.target.value as TemplateCadence,
                              },
                            }
                          : row
                      )
                    )
                  }
                >
                  <option value="DAILY">Her Gün</option>
                  <option value="WEEKLY">Her Hafta</option>
                  <option value="EVERY_3_DAYS">3 Günde Bir</option>
                </Select>
                <ActionButton type="button" action="notify" variant="outline" onClick={() => triggerTemplate(tpl.type)}>
                  Hemen Tetikle
                </ActionButton>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>

      <Card id="settings-audit" className="surface-card">
        <CardHeader>
          <CardTitle>Kampanya Değişiklik Geçmişi</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {campaignAuditRows.length === 0 ? (
            <EmptyState
              icon={<i className="fa-solid fa-clock-rotate-left" aria-hidden="true" />}
              title="Henüz kampanya değişikliği kaydı bulunmuyor"
              description="Kampanya kuralları değiştikçe audit kayıtları bu alanda listelenir."
            />
          ) : (
            campaignAuditRows.map((entry) => (
              <article key={entry.id} className="list-row text-sm">
                <div className="flex items-center justify-between gap-2">
                  <strong>{entry.summary}</strong>
                  <Badge variant="secondary">{entry.action}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(entry.created_at).toLocaleString("tr-TR")}
                  {entry.actor_id ? ` • İşleyen: ${entry.actor_id}` : ""}
                </p>
              </article>
            ))
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
