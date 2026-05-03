"use client";
/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionButton } from "@/components/ui/action-button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { riskLabel } from "@/lib/presentation";
import { useRequireRole } from "@/lib/require-role";
import { httpRequest } from "@/lib/http-client";

type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

type RiskItem = {
  member_id: string;
  full_name: string;
  email: string;
  score: number;
  level: RiskLevel;
  reasons: string[];
  remaining_credits: number;
  days_since_attendance: number | null;
  days_since_measurement: number | null;
};

type RiskPayload = {
  data: RiskItem[];
  total: number;
  limit: number;
  filter_help?: {
    default_limit: number;
    max_limit: number;
    description: string;
  };
};

export default function AdminRiskPage() {
  const { loading: authLoading, user } = useRequireRole("ADMIN");
  const status: "loading" | "ready" | "unauthorized" = authLoading ? "loading" : user ? "ready" : "unauthorized";
  const [busy, setBusy] = useState(false);

  const [items, setItems] = useState<RiskItem[]>([]);
  const [riskSegment, setRiskSegment] = useState<"AT_RISK" | "HEALTHY" | "ALL">("AT_RISK");
  const [memberActivity, setMemberActivity] = useState<"ACTIVE" | "INACTIVE" | "ALL">("ACTIVE");
  const [level, setLevel] = useState<"" | RiskLevel>("");
  const limit = 250;

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("riskSegment", riskSegment);
    params.set("memberActivity", memberActivity);
    params.set("limit", String(limit));
    if (level) params.set("level", level);
    return params.toString();
  }, [riskSegment, memberActivity, limit, level]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (status !== "ready") return;
    loadList().catch(() => toast.error("Risk listesi yüklenemedi"));
  }, [status, queryString]);

  async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
    return httpRequest<T>(path, init);
  }

  async function loadList() {
      const payload = await apiRequest<RiskPayload>(`/admin/risk/members?${queryString}`);
      setItems(payload.data || []);
  }

  async function recalculate() {
    setBusy(true);
    try {
      await apiRequest("/admin/risk/recalculate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      toast.success("Risk skorları yeniden hesaplandı");
      await loadList();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Risk hesaplama başarısız");
    } finally {
      setBusy(false);
    }
  }

  async function triggerNotifications() {
    setBusy(true);
    try {
      await apiRequest("/admin/risk/notifications/trigger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ riskSegment }),
      });
      toast.success("Risk bildirim tetikleme kuyruğa alındı (mock push)");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bildirim tetiklenemedi");
    } finally {
      setBusy(false);
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
        title="Klinik Risk Yönetimi"
        description="Risk segmentlerine göre üyeleri izleyin, skoru güncelleyin ve bildirim sürecini tetikleyin."
        actions={
          <>
            <ActionButton action="refresh" onClick={recalculate} disabled={busy}>Skoru Yeniden Hesapla</ActionButton>
            <ActionButton action="notify" onClick={triggerNotifications} disabled={busy}>Risk Bildirimi Tetikle</ActionButton>
          </>
        }
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Toplam Sonuç" value={items.length} tone="sky" icon={<i className="fa-solid fa-users-viewfinder" aria-hidden="true" />} hint="Aktif filtre çıktısı" />
        <MetricCard label="Çok Riskli" value={items.filter((item) => item.level === "HIGH").length} tone="amber" icon={<i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />} hint="Öncelikli müdahale listesi" />
        <MetricCard label="Riskli" value={items.filter((item) => item.level === "MEDIUM").length} tone="slate" icon={<i className="fa-solid fa-heart-pulse" aria-hidden="true" />} hint="Takip edilmesi gereken segment" />
        <MetricCard label="Stabil" value={items.filter((item) => item.level === "LOW").length} tone="emerald" icon={<i className="fa-solid fa-circle-check" aria-hidden="true" />} hint="Düşük riskli üyeler" />
      </section>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Filtreler</CardTitle>
        </CardHeader>
        <CardContent className="filter-toolbar grid gap-3 md:grid-cols-4 xl:grid-cols-5">
          <Select value={riskSegment} onChange={(e) => setRiskSegment(e.target.value as "AT_RISK" | "HEALTHY" | "ALL")}>
            <option value="AT_RISK">Riskli Kullanıcılar</option>
            <option value="HEALTHY">Sağlıklı Segment</option>
            <option value="ALL">Tüm Üyeler</option>
          </Select>
          <Select value={memberActivity} onChange={(e) => setMemberActivity(e.target.value as "ACTIVE" | "INACTIVE" | "ALL")}>
            <option value="ACTIVE">Aktif Üyeler</option>
            <option value="INACTIVE">Dondurulmuş Üyeler</option>
            <option value="ALL">Aktif + Dondurulmuş</option>
          </Select>
          <Select value={level} onChange={(e) => setLevel(e.target.value as "" | RiskLevel)}>
            <option value="">Seviye (Tümü)</option>
            <option value="HIGH">Çok Riskli</option>
            <option value="MEDIUM">Riskli</option>
            <option value="LOW">Stabil</option>
          </Select>
          <ActionButton action="refresh" onClick={() => loadList()} disabled={busy} />
        </CardContent>
      </Card>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Risk Segmenti Sonuçları</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {items.length === 0 ? (
            <EmptyState
              icon={<i className="fa-solid fa-shield-heart" aria-hidden="true" />}
              title="Filtrelere uygun risk kaydı bulunmuyor"
              description="Risk segmenti, aktivite ve seviye filtrelerini değiştirerek tekrar deneyin."
            />
          ) : (
            items.map((item) => (
              <article key={item.member_id} className={`list-row ${item.level === "HIGH" ? "status-accent-high" : item.level === "MEDIUM" ? "status-accent-medium" : "status-accent-low"}`}>
                <div className="flex items-center justify-between gap-2">
                  <strong>{item.full_name}</strong>
                  <Badge variant={item.level === "HIGH" ? "danger" : item.level === "MEDIUM" ? "warning" : "success"}>{riskLabel(item.level)}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Katılım: {item.days_since_attendance ?? "N/A"} gün • Ölçüm: {item.days_since_measurement ?? "N/A"} gün • Kalan hak: {item.remaining_credits}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{item.reasons.join(" • ")}</p>
              </article>
            ))
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
