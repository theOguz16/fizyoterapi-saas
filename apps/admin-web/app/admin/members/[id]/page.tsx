"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Box, CalendarClock, Mail, Phone, ShieldX, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useRequireRole } from "@/lib/require-role";
import { httpRequest } from "@/lib/http-client";

const MeasurementTrendChart = dynamic(
  () => import("./MeasurementTrendChart").then((mod) => mod.MeasurementTrendChart),
  { ssr: false }
);

type MemberDetail = {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  created_at?: string;
  is_active?: boolean;
};

type MemberPackage = {
  id: string;
  package_id: string;
  remaining_credits: number;
  is_active: boolean;
  starts_at?: string;
  expires_at?: string;
  is_expired?: boolean;
  package_title?: string | null;
  package_type?: string | null;
  package_total_credits?: number | null;
  package_duration_days?: number | null;
  package_price?: number | null;
  trainer_summary?: string | null;
  assigned_trainers?: Array<{
    id: string;
    full_name: string;
    email: string;
  }>;
};

type MeasurementItem = {
  id: string;
  measured_at: string;
  height_cm: string | number | null;
  weight_kg: string | number | null;
  fat_percent: string | number | null;
  muscle_kg: string | number | null;
};

type MeasurementTrend = {
  labels: string[];
  weight_kg: Array<number | null>;
  fat_percent: Array<number | null>;
  muscle_kg: Array<number | null>;
  height_cm: Array<number | null>;
};

type MeasurementChartRow = {
  dateText: string;
  weight_kg: number | null;
  fat_percent: number | null;
  muscle_kg: number | null;
  height_cm: number | null;
};

type ActivityItem = {
  title: string;
  date: string;
  tone: "secondary" | "success" | "outline";
  description: string;
};

function MemberDetailRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="detail-pill w-full items-start gap-3 px-4 py-3">
      <span className="shrink-0 rounded-2xl bg-sky-50 p-2 text-sky-600">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</span>
        <span className="break-all text-sm font-medium text-slate-900">{value}</span>
      </span>
    </div>
  );
}

export default function AdminMemberProfilePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { loading: authLoading, user } = useRequireRole("ADMIN");
  const status: "loading" | "ready" | "unauthorized" = authLoading ? "loading" : user ? "ready" : "unauthorized";
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [packages, setPackages] = useState<MemberPackage[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementItem[]>([]);
  const [measurementTrend, setMeasurementTrend] = useState<MeasurementTrend | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [pendingAction, setPendingAction] = useState<"remove" | "toggle-status" | null>(null);

  useEffect(() => {
    if (status !== "ready") return;
    Promise.all([
      httpRequest<{ data: MemberDetail }>(`/admin/members/${params.id}`),
      httpRequest<{ data?: MemberPackage[] }>(`/admin/members/${params.id}/packages`),
      httpRequest<{ data?: MeasurementItem[] }>(`/admin/members/${params.id}/measurements`),
      httpRequest<{ data: MeasurementTrend }>(`/admin/measurements/trend?memberId=${params.id}`),
    ])
      .then(([detailPayload, packagePayload, measurementsPayload, trendPayload]) => {
        setDetail(detailPayload.data);
        setPackages(packagePayload.data || []);
        setMeasurements(measurementsPayload.data || []);
        setMeasurementTrend(trendPayload.data);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Üye profili yüklenemedi";
        toast.error(message);
        if (message.toLowerCase().includes("bulunamadı")) {
          router.replace("/dashboard");
        }
      });
  }, [params.id, router, status]);

  if (status === "loading") {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <p className="text-sm text-muted-foreground">Oturum kontrol ediliyor...</p>
      </main>
    );
  }

  if (status === "unauthorized") return null;

  const activePackages = packages.filter((pkg) => pkg.is_active).length;
  const totalCredits = packages.reduce((sum, pkg) => sum + pkg.remaining_credits, 0);
  const profileActivity: ActivityItem[] = detail?.created_at
    ? [
        {
          title: "Üye hesabı oluşturuldu",
          date: detail.created_at,
          tone: "secondary",
          description: "Sisteme ilk kayıt tarihi",
        },
      ]
    : [];
  const packageActivity: ActivityItem[] = packages.map((pkg) => ({
      title: pkg.package_title || `Paket #${pkg.package_id.slice(0, 8)}`,
      date: pkg.starts_at || pkg.expires_at || detail?.created_at || new Date().toISOString(),
      tone: pkg.is_active ? "success" : "outline",
      description: `${pkg.remaining_credits} kredi kaldı • ${pkg.is_active ? "aktif paket" : "dondurulmuş paket"}${pkg.trainer_summary ? ` • Eğitmen: ${pkg.trainer_summary}` : ""}`,
    }));
  const activityItems: ActivityItem[] = [...profileActivity, ...packageActivity].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const memberDisplayName = detail
    ? ((detail.first_name || detail.last_name)
        ? `${detail.first_name || ""} ${detail.last_name || ""}`.trim()
        : detail.email)
    : "";
  const latestMeasurement = measurements[0] || null;
  const measurementChartRows: MeasurementChartRow[] = !measurementTrend
    ? []
    : measurementTrend.labels.map((label, index) => ({
        dateText: new Date(label).toLocaleDateString("tr-TR"),
        weight_kg: measurementTrend.weight_kg[index] ?? null,
        fat_percent: measurementTrend.fat_percent[index] ?? null,
        muscle_kg: measurementTrend.muscle_kg[index] ?? null,
        height_cm: measurementTrend.height_cm[index] ?? null,
      }));
  const packageTypeLabel = (raw?: string | null) => {
    if (!raw) return "Belirtilmedi";
    if (raw === "GROUP") return "Grup";
    if (raw === "PT") return "PT";
    if (raw === "REFORMER") return "Reformer";
    if (raw === "MANUAL") return "Manual";
    if (raw === "SCOLIOSIS") return "Skolyoz";
    return raw;
  };
  const currencyFormatter = new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  });

  async function handleRemoveFromSalon() {
    if (!detail || !detail.is_active || isRemoving) return;
    setPendingAction("remove");
  }

  async function handleToggleStatus() {
    if (!detail || isUpdatingStatus) return;
    setPendingAction("toggle-status");
  }

  async function confirmPendingAction() {
    if (!detail || !pendingAction) return;

    if (pendingAction === "remove") {
      setIsRemoving(true);
      try {
        await httpRequest<{ message: string }>(`/admin/members/${params.id}`, { method: "DELETE" });
        toast.success("Üye salondan çıkarıldı");
        setPendingAction(null);
        router.replace("/dashboard");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Üye salondan çıkarılamadı");
      } finally {
        setIsRemoving(false);
      }
      return;
    }

    const nextStatus = !detail.is_active;
    setIsUpdatingStatus(true);
    try {
      const payload = await httpRequest<{ data: MemberDetail }>(`/admin/members/${params.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ is_active: nextStatus }),
      });
      setDetail(payload.data);
      toast.success(nextStatus ? "Üye aktif hale getirildi" : "Üye donduruldu");
      setPendingAction(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Üye durumu güncellenemedi");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Üye Profili"
        description="Üye bilgileri ve paket kullanım özeti."
        actions={
          <Link href="/dashboard" className="interactive inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <ArrowLeft className="h-4 w-4" />
            Dashboard&apos;a Dön
          </Link>
        }
      />

      {!detail ? (
        <Card className="surface-card">
          <CardContent className="pt-6">
            <EmptyState title="Profil yükleniyor" description="Üye bilgileri ve paket bakiyeleri hazırlanıyor." />
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Üye Durumu"
              value={detail.is_active ? "Aktif" : "Donduruldu"}
              tone={detail.is_active ? "emerald" : "amber"}
              hint="Rol ve erişim durumu"
              icon={<UserRoundCheck className="h-4 w-4" />}
            />
            <MetricCard label="Aktif Paket" value={activePackages} hint="Kullanılabilir paket sayısı" icon={<Box className="h-4 w-4" />} />
            <MetricCard label="Toplam Kalan Hak" value={totalCredits} tone="amber" hint="Tüm paketlerden kalan kredi" icon={<CalendarClock className="h-4 w-4" />} />
            <MetricCard
              label="Kayıt Tarihi"
              value={detail.created_at ? new Date(detail.created_at).toLocaleDateString("tr-TR") : "-"}
              tone="slate"
              hint="İlk profil oluşturma"
              icon={<CalendarClock className="h-4 w-4" />}
            />
          </div>

          {latestMeasurement ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Son Boy" value={Number(latestMeasurement.height_cm ?? 0) || "-"} tone="slate" hint="En son ölçüm kaydı" icon={<i className="fa-solid fa-ruler-vertical" aria-hidden="true" />} />
              <MetricCard label="Son Kilo" value={Number(latestMeasurement.weight_kg ?? 0) || "-"} tone="sky" hint="En son kilo verisi" icon={<i className="fa-solid fa-weight-scale" aria-hidden="true" />} />
              <MetricCard label="Yağ Oranı" value={Number(latestMeasurement.fat_percent ?? 0) || "-"} tone="amber" hint="En son yağ ölçümü" icon={<i className="fa-solid fa-droplet" aria-hidden="true" />} />
              <MetricCard label="Kas Kütlesi" value={Number(latestMeasurement.muscle_kg ?? 0) || "-"} tone="emerald" hint="En son kas ölçümü" icon={<i className="fa-solid fa-dumbbell" aria-hidden="true" />} />
            </div>
          ) : null}

          <section className="grid gap-4 xl:grid-cols-3">
          <Card className="surface-card">
            <CardHeader className="gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <CardTitle>{memberDisplayName}</CardTitle>
                  <Badge variant={detail.is_active ? "success" : "warning"} className="w-fit">
                    {detail.is_active ? "Salonda Aktif" : "Donduruldu"}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant={detail.is_active ? "outline" : "default"}
                    size="sm"
                    onClick={handleToggleStatus}
                    disabled={isUpdatingStatus}
                  >
                    <UserRoundCheck className="h-4 w-4" />
                    {detail.is_active
                      ? isUpdatingStatus ? "Donduruluyor..." : "Dondur"
                      : isUpdatingStatus ? "Aktifleştiriliyor..." : "Aktifleştir"}
                  </Button>
                  <Button
                    type="button"
                    variant={detail.is_active ? "destructive" : "outline"}
                    size="sm"
                    onClick={handleRemoveFromSalon}
                    disabled={isRemoving || !detail.is_active}
                  >
                    <ShieldX className="h-4 w-4" />
                    {detail.is_active ? (isRemoving ? "Çıkarılıyor..." : "Salondan Çıkar") : "Donduruldu"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="section-band flex flex-col gap-3 text-sm">
              <MemberDetailRow icon={<Mail className="h-4 w-4" />} label="E-posta" value={detail.email} />
              <MemberDetailRow icon={<Phone className="h-4 w-4" />} label="Telefon" value={detail.phone || "Belirtilmedi"} />
              <MemberDetailRow icon={<UserRoundCheck className="h-4 w-4" />} label="Durum" value={detail.is_active ? "Aktif" : "Donduruldu"} />
              <MemberDetailRow
                icon={<CalendarClock className="h-4 w-4" />}
                label="Kayıt Tarihi"
                value={detail.created_at ? new Date(detail.created_at).toLocaleString("tr-TR") : "Belirtilmedi"}
              />
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader>
              <CardTitle>Paketler</CardTitle>
            </CardHeader>
            <CardContent className="subtle-scroll panel-scroll grid gap-2 text-sm">
              {packages.length === 0 ? (
                <EmptyState
                  icon={<Box className="h-5 w-5" />}
                  title="Paket kaydı bulunmuyor"
                  description="Bu üye için henüz aktif ya da geçmiş paket ataması görünmüyor."
                />
              ) : (
                packages.map((pkg) => (
                  <article key={pkg.id} className="list-row rounded-2xl px-4 py-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <strong>{pkg.package_title || `Paket #${pkg.package_id.slice(0, 8)}`}</strong>
                        <p className="mt-1 text-[11px] text-muted-foreground">Ref: {pkg.package_id.slice(0, 8)}</p>
                      </div>
                      <Badge variant={pkg.is_active ? "secondary" : "outline"}>
                        {pkg.is_active ? "Aktif" : "Donduruldu"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Kalan kredi: {pkg.remaining_credits} / {pkg.package_total_credits ?? "-"} • Tür: {packageTypeLabel(pkg.package_type)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Başlangıç: {pkg.starts_at ? new Date(pkg.starts_at).toLocaleDateString("tr-TR") : "Belirtilmedi"} •
                      Bitiş: {pkg.expires_at ? new Date(pkg.expires_at).toLocaleDateString("tr-TR") : "Süresiz"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Süre: {pkg.package_duration_days ? `${pkg.package_duration_days} gün` : "Süresiz"} • Fiyat: {pkg.package_price ? currencyFormatter.format(pkg.package_price) : "Belirtilmedi"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Eğitmen: {pkg.trainer_summary || "Henüz atanmadı"}
                    </p>
                  </article>
                ))
              )}
            </CardContent>
          </Card>
          <Card className="surface-card">
            <CardHeader>
              <CardTitle>Aktivite Zaman Çizgisi</CardTitle>
            </CardHeader>
            <CardContent className="subtle-scroll panel-scroll grid gap-2 text-sm">
              {activityItems.length === 0 ? (
                <EmptyState
                  icon={<CalendarClock className="h-5 w-5" />}
                  title="Aktivite kaydı bulunmuyor"
                  description="Paket ve profil hareketleri burada zaman sırasıyla görünür."
                />
              ) : (
                activityItems.map((item, index) => (
                  <article key={`${item.title}-${index}`} className="list-row rounded-2xl px-4 py-4">
                    <div className="flex items-center justify-between gap-2">
                      <strong>{item.title}</strong>
                      <Badge variant={item.tone}>{item.tone === "success" ? "Aktif" : item.tone === "outline" ? "Donduruldu" : "Profil"}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(item.date).toLocaleString("tr-TR")}</p>
                  </article>
                ))
              )}
            </CardContent>
          </Card>
        </section>

          <section className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
            <Card className="surface-card">
              <CardHeader>
                <CardTitle>Ölçüm Trend Grafiği</CardTitle>
              </CardHeader>
              <CardContent>
                {measurementChartRows.length === 0 ? (
                  <EmptyState
                    icon={<i className="fa-solid fa-chart-line" aria-hidden="true" />}
                    title="Ölçüm trendi bulunmuyor"
                    description="Boy, kilo, yağ ve kas verileri ölçüm kaydı geldikçe burada çizilir."
                  />
                ) : (
                  <MeasurementTrendChart rows={measurementChartRows} />
                )}
              </CardContent>
            </Card>

            <Card className="surface-card">
              <CardHeader>
                <CardTitle>Ölçüm Geçmişi</CardTitle>
              </CardHeader>
              <CardContent className="subtle-scroll panel-scroll grid gap-2 text-sm">
                {measurements.length === 0 ? (
                  <EmptyState
                    icon={<i className="fa-solid fa-ruler-combined" aria-hidden="true" />}
                    title="Henüz ölçüm kaydı yok"
                    description="İlk ölçüm geldiğinde boy, kilo, yağ ve kas geçmişi burada listelenir."
                  />
                ) : (
                  measurements.map((row) => (
                    <article key={row.id} className="list-row rounded-2xl px-4 py-4">
                      <strong>{new Date(row.measured_at).toLocaleString("tr-TR")}</strong>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Boy: {row.height_cm ?? "-"} • Kilo: {row.weight_kg ?? "-"} • Yağ: {row.fat_percent ?? "-"} • Kas: {row.muscle_kg ?? "-"}
                      </p>
                    </article>
                  ))
                )}
              </CardContent>
            </Card>
          </section>
        </section>
      )}

      <ConfirmDialog
        open={pendingAction !== null}
        title={
          pendingAction === "remove"
            ? "Üyeyi Salondan Çıkar"
            : detail?.is_active
              ? "Üyeyi Dondur"
              : "Üyeyi Yeniden Aktifleştir"
        }
        description={
          pendingAction === "remove"
            ? `"${memberDisplayName}" adlı üyeyi salon erişiminden tamamen kaldırmak üzeresiniz.`
            : detail?.is_active
              ? `"${memberDisplayName}" adlı üyenin hesabı geçici olarak dondurulacak.`
              : `"${memberDisplayName}" adlı üyenin hesabı tekrar aktif hale getirilecek.`
        }
        note={
          pendingAction === "remove"
            ? "Bu işlem sonrası profil ekranı kapanır ve üye admin görünümünden düşer."
            : detail?.is_active
              ? "Dondurulan üye bilgileri korunur, ancak aktif kullanım akışlarından çıkarılır."
              : "Aktifleştirme sonrası üye tekrar aktif kullanım akışlarına dahil olur."
        }
        confirmText={
          pendingAction === "remove"
            ? "Evet, Çıkar"
            : detail?.is_active
              ? "Evet, Dondur"
              : "Evet, Aktifleştir"
        }
        variant={pendingAction === "remove" ? "destructive" : "default"}
        loading={pendingAction === "remove" ? isRemoving : isUpdatingStatus}
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </AppShell>
  );
}
