"use client";
/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireRole } from "@/lib/require-role";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionButton } from "@/components/ui/action-button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
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

type MeasurementItem = {
  id: string;
  member_id: string;
  trainer_id: string;
  measured_at: string;
  height_cm: number | null;
  weight_kg: number | null;
  fat_percent: number | null;
  muscle_kg: number | null;
};

type DueItem = {
  member_id: string;
  full_name: string;
  email: string;
  phone: string;
  last_measured_at: string | null;
  days_since_last: number | null;
  due: boolean;
};

export default function TrainerMeasurementsPage() {
  const router = useRouter();
  const apiBase = getApiBase();
  const [status, setStatus] = useState<"loading" | "ready" | "unauthorized">("loading");
  const [session, setSession] = useState<SessionData | null>(null);
  const [busy, setBusy] = useState(false);

  const [filterMemberId, setFilterMemberId] = useState("");
  const [thresholdDays, setThresholdDays] = useState(30);
  const [list, setList] = useState<MeasurementItem[]>([]);
  const [trend, setTrend] = useState<any>(null);
  const [dueList, setDueList] = useState<DueItem[]>([]);

  const { loading: roleLoading, user: authUser } = useRequireRole("TRAINER");

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
    if (status !== "ready") return;
    Promise.all([loadMeasurements(), loadDueList()]).catch(() => toast.error("Veriler yüklenemedi"));
  }, [status]);

  async function apiRequest<T>(path: string): Promise<T> {
    const res = await fetch(`${apiBase}${path}`, {
      credentials: "include",
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!res.ok) throw new Error(payload.error?.message || "Request failed");
    return payload as T;
  }

  async function loadMeasurements() {
    const query = filterMemberId ? `?memberId=${encodeURIComponent(filterMemberId)}` : "";
    const payload = await apiRequest<{ data: MeasurementItem[] }>(`/trainer/measurements${query}`);
    setList(payload.data || []);
  }

  async function loadTrend() {
    if (!filterMemberId) {
      toast.error("Trend için üye ID girilmelidir");
      return;
    }
    const payload = await apiRequest<{ data: unknown }>(`/trainer/measurements/trend?memberId=${encodeURIComponent(filterMemberId)}`);
    setTrend(payload.data);
  }

  async function loadDueList() {
    const payload = await apiRequest<{ data: DueItem[] }>(`/trainer/measurements/due?thresholdDays=${encodeURIComponent(String(thresholdDays))}`);
    setDueList(payload.data || []);
  }

  if (status === "loading") {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <p className="text-sm text-muted-foreground">Oturum kontrol ediliyor...</p>
      </main>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Ölçüm Analizi (Salt Okunur)"
        description="Eğitmenler ölçüm trendlerini analiz eder; yeni ölçüm girişi üye tarafından yapılır."
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Ölçüm Kaydı" value={list.length} tone="sky" icon={<i className="fa-solid fa-ruler-combined" aria-hidden="true" />} />
        <MetricCard label="Geciken Üye" value={dueList.length} tone="amber" icon={<i className="fa-solid fa-hourglass-half" aria-hidden="true" />} />
        <MetricCard label="Seçili Üye" value={filterMemberId || "-"} tone="slate" icon={<i className="fa-solid fa-user" aria-hidden="true" />} />
        <MetricCard label="Eşik Gün" value={thresholdDays} tone="emerald" icon={<i className="fa-solid fa-calendar-day" aria-hidden="true" />} />
      </section>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Filtre ve Trend</CardTitle>
        </CardHeader>
        <CardContent className="filter-toolbar grid gap-3 md:grid-cols-4">
          <Input placeholder="Üye ID ile filtrele" value={filterMemberId} onChange={(e) => setFilterMemberId(e.target.value)} />
          <ActionButton action="refresh" onClick={loadMeasurements}>Listeyi Yenile</ActionButton>
          <ActionButton action="view" onClick={loadTrend}>Trend Analizi</ActionButton>
          <ActionButton action="create" disabled>Ölçüm Ekleme Yetkisi Kapalı</ActionButton>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="surface-card">
          <CardHeader>
            <CardTitle>Ölçüm Geçmişi</CardTitle>
          </CardHeader>
          <CardContent className="subtle-scroll panel-scroll grid gap-2">
            {list.length === 0 ? (
              <EmptyState
                icon={<i className="fa-solid fa-ruler-combined" aria-hidden="true" />}
                title="Kayıt bulunmuyor"
                description="Seçilen üye için ölçüm geçmişi bulunmuyor."
              />
            ) : (
              list.map((m) => (
                <article key={m.id} className="list-row text-sm">
                  <strong>{m.member_id}</strong>
                  <p className="mt-1 text-muted-foreground">
                    {new Date(m.measured_at).toLocaleString("tr-TR")} • Boy {m.height_cm ?? "-"} • Kilo {m.weight_kg ?? "-"} • Yağ {m.fat_percent ?? "-"} • Kas {m.muscle_kg ?? "-"}
                  </p>
                </article>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader>
            <CardTitle>Trend Verisi</CardTitle>
          </CardHeader>
          <CardContent>
            {!trend ? (
              <EmptyState
                icon={<i className="fa-solid fa-chart-line" aria-hidden="true" />}
                title="Trend henüz yüklenmedi"
                description="Bir üye için trend analizi çalıştırdığınızda veri burada görünür."
              />
            ) : (
              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(trend, null, 2)}</pre>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Geciken Ölçümler</CardTitle>
        </CardHeader>
        <CardContent className="subtle-scroll panel-scroll grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input className="max-w-[180px]" type="number" value={thresholdDays} onChange={(e) => setThresholdDays(Number(e.target.value) || 30)} />
            <ActionButton action="refresh" onClick={loadDueList} disabled={busy}>Gecikenleri Getir</ActionButton>
          </div>
          {dueList.length === 0 ? (
            <EmptyState
              icon={<i className="fa-solid fa-circle-check" aria-hidden="true" />}
              title="Geciken ölçüm kaydı bulunmuyor"
              description="Eşik gün değerine göre geciken ölçüm ihtiyacı görünmüyor."
            />
          ) : (
            dueList.map((d) => (
              <article key={d.member_id} className="list-row text-sm">
                <strong>{d.full_name}</strong>
                <p className="mt-1 text-muted-foreground">
                  Son ölçüm: {d.last_measured_at ? new Date(d.last_measured_at).toLocaleDateString("tr-TR") : "Yok"} • Gün farkı: {d.days_since_last ?? "N/A"}
                </p>
              </article>
            ))
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
