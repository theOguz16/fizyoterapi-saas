"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { Skeleton } from "@/components/ui/skeleton";
import { attendanceResultLabel, bookingStatusLabel, paymentStatusLabel, riskLabel } from "@/lib/presentation";
import { useRequireRole } from "@/lib/require-role";
import { httpRequest } from "@/lib/http-client";

type TodayPayload = {
  data: {
    date: string;
    summary: {
      booking_total: number;
      pending_bookings: number;
      approved_bookings: number;
      session_total: number;
      weekly_session_total: number;
      member_total: number;
      scheduled_sessions: number;
      completed_sessions: number;
      checkin_total: number;
      deducted_credits_total: number;
    };
    risk: {
      at_risk_count: number;
      preview: Array<{ member_id: string; full_name: string; level: string; score: number }>;
    };
    earnings: {
      month_gross_total: number;
      month_trainer_income: number;
      month_commission_rate: number;
      month_credited_lessons: number;
    };
    bookings: Array<{
      id: string;
      member_id: string;
      member_full_name?: string | null;
      starts_at: string;
      ends_at: string;
      status: string;
      lesson_category?: string | null;
      payment_status?: string;
    }>;
    sessions: Array<{
      id: string;
      title: string;
      type: string;
      lesson_category?: string;
      starts_at: string;
      ends_at: string;
      status: string;
      capacity: number;
    }>;
    checkins: Array<{
      id: string;
      member_id: string;
      member_full_name?: string | null;
      created_at: string;
      result: string;
      credits_deducted: number;
      lesson_category?: string | null;
    }>;
  };
};

export default function TrainerTodayPage() {
  const { loading: authLoading, user } = useRequireRole("TRAINER");
  const status: "loading" | "ready" | "unauthorized" = authLoading ? "loading" : user ? "ready" : "unauthorized";
  const [data, setData] = useState<TodayPayload["data"] | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (status !== "ready") return;
    loadToday().catch(() => toast.error("Bugün özeti yüklenemedi"));
  }, [status]);

  async function loadToday() {
    setLoadingData(true);
    try {
      const payload = await httpRequest<TodayPayload>("/trainer/today");
      setData(payload.data);
    } finally {
      setLoadingData(false);
    }
  }

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
        title="Eğitmen Operasyon Merkezi"
        description="Bugünkü randevu ve ders operasyonlarını, katılım kayıtlarını ve öncelikli riskli danışanları yönetin."
        actions={
          <ActionButton action="refresh" size="sm" onClick={() => loadToday().catch(() => toast.error("Bugün özeti yüklenemedi"))}>
            Veriyi Yenile
          </ActionButton>
        }
      />

      {loadingData && !data ? (
        <Card className="surface-card">
          <CardContent className="grid gap-3 pt-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      ) : data ? (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Bugünkü Ders" value={data.summary.session_total} tone="emerald" icon={<i className="fa-solid fa-dumbbell" aria-hidden="true" />} hint={`${data.summary.completed_sessions} tamamlandı`} />
            <MetricCard label="Danışan Sayısı" value={data.summary.member_total} tone="sky" icon={<i className="fa-solid fa-users" aria-hidden="true" />} hint="Takip edilen toplam danışan" />
            <MetricCard label="Riskli Danışan" value={data.risk.at_risk_count} tone="amber" icon={<i className="fa-solid fa-heart-pulse" aria-hidden="true" />} hint="Öncelikli takip listesi" />
            <MetricCard label="Haftalık Ders" value={data.summary.weekly_session_total} tone="slate" icon={<i className="fa-solid fa-calendar-week" aria-hidden="true" />} hint="Bu hafta planlı toplam ders" />
          </section>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
            <MoneyCard label="Bu Ay Eğitmen Kazancın" value={data.earnings.month_trainer_income} />
            <MetricCard label="Bu Ay İşlenen Ders" value={data.earnings.month_credited_lessons} tone="emerald" icon={<i className="fa-solid fa-bolt" aria-hidden="true" />} hint="Prim hesabına giren dersler" />
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <ListCard
              title="Randevular"
              items={data.bookings.map((row) => ({
                id: row.id,
                title: row.member_full_name || row.member_id,
                href: `/trainer/members?memberId=${row.member_id}`,
                subtitle: `${new Date(row.starts_at).toLocaleString("tr-TR")} - ${new Date(row.ends_at).toLocaleString("tr-TR")}`,
                detail: `Ders: ${row.lesson_category ?? "Belirlenmedi"} • Ödeme: ${paymentStatusLabel(row.payment_status)}`,
                badge: bookingStatusLabel(row.status),
              }))}
            />
            <ListCard
              title="Dersler"
              items={data.sessions.map((row) => ({
                id: row.id,
                title: row.title,
                subtitle: `${new Date(row.starts_at).toLocaleTimeString("tr-TR")} - ${new Date(row.ends_at).toLocaleTimeString("tr-TR")}`,
                detail: `Tür: ${row.type} • Kategori: ${row.lesson_category ?? "Belirlenmedi"} • Kapasite: ${row.capacity}`,
                badge: row.status,
              }))}
            />
            <ListCard
              title="Son Check-in"
              items={data.checkins.map((row) => ({
                id: row.id,
                title: row.member_full_name || row.member_id,
                href: `/trainer/members?memberId=${row.member_id}`,
                subtitle: `${new Date(row.created_at).toLocaleString("tr-TR")}`,
                detail: `${attendanceResultLabel(row.result)} • Kullanılan kredi: ${row.credits_deducted}`,
                badge: row.lesson_category || "Ders",
              }))}
            />
          </section>

          <Card className="surface-card">
            <CardHeader>
              <CardTitle>Öncelikli Riskli Danışanlar</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {data.risk.preview.length === 0 ? (
                <EmptyState
                  icon={<i className="fa-solid fa-circle-check" aria-hidden="true" />}
                  title="Öncelikli risk danışanı bulunmuyor"
                  description="Risk motoru acil aksiyon gerektiren bir kullanıcı tespit ettiğinde burada görünür."
                />
              ) : (
                data.risk.preview.map((item) => (
                  <article key={item.member_id} className={`list-row ${item.level === "HIGH" ? "status-accent-high" : item.level === "MEDIUM" ? "status-accent-medium" : "status-accent-low"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="grid gap-1">
                        <Link href={`/trainer/members?memberId=${item.member_id}`} className="interactive font-semibold accent-text-link">
                          {item.full_name}
                        </Link>
                        <Badge variant="secondary" className="w-fit">{riskLabel(item.level)}</Badge>
                      </div>
                      <Link
                        href={`/trainer/members?memberId=${item.member_id}`}
                        className="interactive rounded-md border border-border px-2 py-1 text-xs font-medium hover:border-sky-300 hover:text-sky-700"
                      >
                        Profili Aç
                      </Link>
                    </div>
                  </article>
                ))
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="surface-card">
          <CardContent className="pt-6 text-sm text-muted-foreground">Bugün verisi bulunamadı.</CardContent>
        </Card>
      )}
    </AppShell>
  );
}

function MoneyCard({ label, value }: { label: string; value: number }) {
  const currency = new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  });

  return <MetricCard label={label} value={currency.format(value || 0)} tone="sky" icon={<i className="fa-solid fa-wallet" aria-hidden="true" />} hint="Aylık kazanç özeti" />;
}

function ListCard({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; title: string; subtitle: string; detail: string; badge: string; href?: string }>;
}) {
  return (
    <Card className="surface-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {items.length === 0 ? (
          <EmptyState
            icon={<i className="fa-solid fa-calendar-day" aria-hidden="true" />}
            title="Kayıt bulunmuyor"
            description="Bu bölüm ilgili operasyon akışı oluştuğunda otomatik dolacaktır."
          />
        ) : (
          items.map((item) => (
            <article key={item.id} className="list-row text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {item.href ? (
                    <Link href={item.href} className="interactive font-semibold accent-text-link">
                      {item.title}
                    </Link>
                  ) : (
                    <strong>{item.title}</strong>
                  )}
                  <Badge variant="secondary">{item.badge}</Badge>
                </div>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="interactive rounded-md border border-border px-2 py-1 text-xs font-medium hover:border-sky-300 hover:text-sky-700"
                  >
                    Aç
                  </Link>
                ) : null}
              </div>
              <p className="mt-1 text-muted-foreground">{item.subtitle}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}
