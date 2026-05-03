"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Award, CalendarClock, Mail, Phone, ShieldCheck, ShieldX, Sparkles } from "lucide-react";
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

type TrainerDetail = {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  created_at?: string;
  is_active?: boolean;
};

type ActivityItem = {
  title: string;
  date: string;
  tone: "secondary" | "success";
  description: string;
};

type TrainerEarnings = {
  daily_income: number;
  weekly_income: number;
  monthly_income: number;
  yearly_income: number;
};

function TrainerDetailRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
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

export default function AdminTrainerProfilePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { loading: authLoading, user } = useRequireRole("ADMIN");
  const status: "loading" | "ready" | "unauthorized" = authLoading ? "loading" : user ? "ready" : "unauthorized";
  const [detail, setDetail] = useState<TrainerDetail | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [earnings, setEarnings] = useState<TrainerEarnings | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [pendingAction, setPendingAction] = useState<"remove" | "toggle-status" | null>(null);

  useEffect(() => {
    if (status !== "ready") return;
    Promise.all([
      httpRequest<{ data: TrainerDetail }>(`/admin/trainers/${params.id}`),
      httpRequest<{ data?: string[] }>(`/admin/trainers/${params.id}/skills`),
      httpRequest<{ data: TrainerEarnings }>(`/admin/trainers/${params.id}/earnings`),
    ])
      .then(([detailPayload, skillsPayload, earningsPayload]) => {
        setDetail(detailPayload.data);
        setSkills(skillsPayload.data || []);
        setEarnings(earningsPayload.data);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Eğitmen profili yüklenemedi";
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

  const profileActivity: ActivityItem[] = detail?.created_at
    ? [
        {
          title: "Eğitmen hesabı oluşturuldu",
          date: detail.created_at,
          tone: "secondary",
          description: "İlk sisteme eklenme tarihi",
        },
      ]
    : [];
  const skillActivity: ActivityItem[] = skills.map((skill) => ({
      title: `${skill} yetkinliği tanımlı`,
      date: detail?.created_at || new Date().toISOString(),
      tone: "success",
      description: "Eğitmen bu kategori için görev alabilir",
    }));
  const activityItems: ActivityItem[] = [...profileActivity, ...skillActivity].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const trainerDisplayName = detail
    ? ((detail.first_name || detail.last_name)
        ? `${detail.first_name || ""} ${detail.last_name || ""}`.trim()
        : detail.email)
    : "";
  const currencyFormatter = new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  });

  async function handleRemoveFromClinic() {
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
        await httpRequest<{ message: string }>(`/admin/trainers/${params.id}`, { method: "DELETE" });
        toast.success("Eğitmen klinikten çıkarıldı");
        setPendingAction(null);
        router.replace("/dashboard");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Eğitmen klinikten çıkarılamadı");
      } finally {
        setIsRemoving(false);
      }
      return;
    }

    const nextStatus = !detail.is_active;
    setIsUpdatingStatus(true);
    try {
      const payload = await httpRequest<{ data: TrainerDetail }>(`/admin/trainers/${params.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ is_active: nextStatus }),
      });
      setDetail(payload.data);
      toast.success(nextStatus ? "Eğitmen aktif hale getirildi" : "Eğitmen donduruldu");
      setPendingAction(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Eğitmen durumu güncellenemedi");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Eğitmen Profili"
        description="Eğitmenin iletişim bilgileri ve yetkinlikleri."
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
            <EmptyState title="Profil yükleniyor" description="Eğitmen bilgileri ve yetkinlikleri hazırlanıyor." />
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Eğitmen Durumu"
              value={detail.is_active ? "Aktif" : "Donduruldu"}
              tone={detail.is_active ? "emerald" : "amber"}
              hint="Erişim ve çalışma durumu"
              icon={<ShieldCheck className="h-4 w-4" />}
            />
            <MetricCard label="Yetkinlik Sayısı" value={skills.length} hint="Tanımlı hizmet kategorileri" icon={<Award className="h-4 w-4" />} />
            <MetricCard
              label="Kayıt Tarihi"
              value={detail.created_at ? new Date(detail.created_at).toLocaleDateString("tr-TR") : "-"}
              tone="slate"
              hint="İlk sisteme giriş"
              icon={<CalendarClock className="h-4 w-4" />}
            />
            <MetricCard
              label="İletişim Bilgisi"
              value={detail.phone || detail.email}
              tone="sky"
              hint={detail.phone ? detail.email : "Telefon bilgisi henüz tanımlı değil"}
              icon={<Phone className="h-4 w-4" />}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Günlük Kazanç" value={currencyFormatter.format(earnings?.daily_income || 0)} tone="slate" hint="Finansal performans özeti" icon={<i className="fa-solid fa-wallet" aria-hidden="true" />} />
            <MetricCard label="Haftalık Kazanç" value={currencyFormatter.format(earnings?.weekly_income || 0)} tone="sky" hint="Finansal performans özeti" icon={<i className="fa-solid fa-money-bill-trend-up" aria-hidden="true" />} />
            <MetricCard label="Aylık Kazanç" value={currencyFormatter.format(earnings?.monthly_income || 0)} tone="emerald" hint="Finansal performans özeti" icon={<i className="fa-solid fa-sack-dollar" aria-hidden="true" />} />
            <MetricCard label="Yıllık Kazanç" value={currencyFormatter.format(earnings?.yearly_income || 0)} tone="amber" hint="Finansal performans özeti" icon={<i className="fa-solid fa-chart-line" aria-hidden="true" />} />
          </div>

          <section className="grid gap-4 xl:grid-cols-3">
          <Card className="surface-card">
            <CardHeader className="gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>{trainerDisplayName}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">Eğitmen hesabı özeti</p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <Badge variant={detail.is_active ? "success" : "warning"}>{detail.is_active ? "Aktif" : "Donduruldu"}</Badge>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant={detail.is_active ? "outline" : "default"}
                      size="sm"
                      onClick={handleToggleStatus}
                      disabled={isUpdatingStatus}
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {detail.is_active
                        ? isUpdatingStatus ? "Donduruluyor..." : "Dondur"
                        : isUpdatingStatus ? "Aktifleştiriliyor..." : "Aktifleştir"}
                    </Button>
                    <Button
                      type="button"
                      variant={detail.is_active ? "destructive" : "outline"}
                      size="sm"
                      onClick={handleRemoveFromClinic}
                      disabled={isRemoving || !detail.is_active}
                    >
                      <ShieldX className="h-4 w-4" />
                      {detail.is_active ? (isRemoving ? "Çıkarılıyor..." : "Klinikten Çıkar") : "Donduruldu"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="section-band flex flex-col gap-3 text-sm">
              <TrainerDetailRow icon={<Mail className="h-4 w-4" />} label="E-posta" value={detail.email} />
              <TrainerDetailRow icon={<Phone className="h-4 w-4" />} label="Telefon" value={detail.phone || "Belirtilmedi"} />
              <TrainerDetailRow icon={<ShieldCheck className="h-4 w-4" />} label="Durum" value={detail.is_active ? "Aktif" : "Donduruldu"} />
              <TrainerDetailRow
                icon={<CalendarClock className="h-4 w-4" />}
                label="Kayıt Tarihi"
                value={detail.created_at ? new Date(detail.created_at).toLocaleString("tr-TR") : "Belirtilmedi"}
              />
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader>
              <CardTitle>Yetkinlikler ve Kategori Yetkileri</CardTitle>
            </CardHeader>
            <CardContent className="subtle-scroll panel-scroll flex min-h-[220px] flex-wrap content-start gap-2">
              {skills.length === 0 ? (
                <EmptyState
                  icon={<Award className="h-5 w-5" />}
                  title="Henüz kategori atanmamış"
                  description="Bu alan, eğitmenin hangi ders ve hizmet kategorilerinde görev alabileceğini gösterir."
                  className="min-h-[180px] w-full"
                />
              ) : (
                skills.map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
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
                  description="Profil ve yetkinlik hareketleri burada görünür."
                />
              ) : (
                activityItems.map((item, index) => (
                  <article key={`${item.title}-${index}`} className="list-row rounded-2xl px-4 py-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="fa-chip shrink-0">
                          {item.tone === "success" ? <Sparkles className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />}
                        </span>
                        <strong>{item.title}</strong>
                      </div>
                      <Badge variant={item.tone}>{item.tone === "success" ? "Yetkinlik" : "Profil"}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(item.date).toLocaleString("tr-TR")}</p>
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
            ? "Eğitmeni Klinikten Çıkar"
            : detail?.is_active
              ? "Eğitmeni Dondur"
              : "Eğitmeni Yeniden Aktifleştir"
        }
        description={
          pendingAction === "remove"
            ? `"${trainerDisplayName}" adlı eğitmeni klinik erişiminden tamamen kaldırmak üzeresiniz.`
            : detail?.is_active
              ? `"${trainerDisplayName}" adlı eğitmenin hesabı geçici olarak dondurulacak.`
              : `"${trainerDisplayName}" adlı eğitmenin hesabı tekrar aktif hale getirilecek.`
        }
        note={
          pendingAction === "remove"
            ? "Bu işlem sonrası profil ekranı kapanır ve eğitmen admin görünümünden düşer."
            : detail?.is_active
              ? "Dondurulan eğitmen bilgileri korunur, ancak aktif operasyon akışlarından çıkarılır."
              : "Aktifleştirme sonrası eğitmen tekrar planlama ve operasyon akışlarına dahil olur."
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
