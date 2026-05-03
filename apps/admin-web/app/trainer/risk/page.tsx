"use client";
/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { FormField } from "@/components/ui/form-field";
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
  days_since_attendance: number | null;
  days_since_measurement: number | null;
};

type RiskPayload = {
  data: RiskItem[];
  total: number;
  limit?: number;
};

export default function TrainerRiskPage() {
  const { loading: authLoading, user } = useRequireRole("TRAINER");
  const status: "loading" | "ready" | "unauthorized" = authLoading ? "loading" : user ? "ready" : "unauthorized";
  const [items, setItems] = useState<RiskItem[]>([]);
  const [riskSegment, setRiskSegment] = useState<"AT_RISK" | "HEALTHY" | "ALL">("AT_RISK");
  const [level, setLevel] = useState<"" | RiskLevel>("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("riskSegment", riskSegment);
    if (level) params.set("level", level);
    return params.toString();
  }, [riskSegment, level]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (status !== "ready") return;
    loadList().catch(() => toast.error("Risk listesi yüklenemedi"));
  }, [status, queryString]);

  async function loadList() {
    const payload = await httpRequest<RiskPayload>(`/trainer/risk/members?${queryString}`);
    setItems(payload.data || []);
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
        title="Riskli Danışanlar"
        description="Yalnızca size bağlı danışanların risk durumlarını takip edin ve aksiyon planınızı oluşturun."
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Toplam Sonuç" value={items.length} tone="sky" icon={<i className="fa-solid fa-users-viewfinder" aria-hidden="true" />} />
        <MetricCard label="Çok Riskli" value={items.filter((item) => item.level === "HIGH").length} tone="amber" icon={<i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />} />
        <MetricCard label="Riskli" value={items.filter((item) => item.level === "MEDIUM").length} tone="slate" icon={<i className="fa-solid fa-heart-pulse" aria-hidden="true" />} />
        <MetricCard label="Stabil" value={items.filter((item) => item.level === "LOW").length} tone="emerald" icon={<i className="fa-solid fa-circle-check" aria-hidden="true" />} />
      </section>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Filtreler</CardTitle>
        </CardHeader>
        <CardContent className="filter-toolbar grid gap-3 lg:grid-cols-[1.2fr,1fr,auto]">
          <FormField label="Risk Segmenti" hint="Riskli, stabil veya tüm danışanları görün.">
            <Select value={riskSegment} onChange={(e) => setRiskSegment(e.target.value as "AT_RISK" | "HEALTHY" | "ALL") }>
              <option value="AT_RISK">Riskli Danışanlar</option>
              <option value="HEALTHY">Stabil Danışanlar</option>
              <option value="ALL">Tüm Danışanlar</option>
            </Select>
          </FormField>
          <FormField label="Risk Seviyesi" hint="İstersen sadece tek seviyeyi filtrele.">
            <Select value={level} onChange={(e) => setLevel(e.target.value as "" | RiskLevel)}>
              <option value="">Seviye (Tümü)</option>
              <option value="HIGH">Çok Riskli</option>
              <option value="MEDIUM">Riskli</option>
              <option value="LOW">Stabil</option>
            </Select>
          </FormField>
          <div className="grid gap-1.5 lg:self-start lg:justify-items-end">
            <span className="invisible inline-flex items-center text-sm font-medium" aria-hidden="true">
              Listeyi Yenile
            </span>
            <Button variant="outline" className="w-full lg:w-auto" onClick={() => loadList()}>
              Listeyi Yenile
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Risk Sonuçları</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {items.length === 0 ? (
            <EmptyState
              icon={<i className="fa-solid fa-shield-heart" aria-hidden="true" />}
              title="Kriterlere uygun danışan bulunmuyor"
              description="Risk segmenti ve seviye filtrelerini değiştirerek yeniden deneyin."
            />
          ) : (
            items.map((item) => (
              <article key={item.member_id} className={`list-row ${item.level === "HIGH" ? "status-accent-high" : item.level === "MEDIUM" ? "status-accent-medium" : "status-accent-low"}`}>
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/trainer/members?memberId=${item.member_id}`} className="interactive font-semibold accent-text-link">
                    {item.full_name}
                  </Link>
                  <Badge variant={item.level === "HIGH" ? "danger" : item.level === "MEDIUM" ? "warning" : "success"}>{riskLabel(item.level)}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Son katılım: {item.days_since_attendance ?? "N/A"} gün • Son ölçüm: {item.days_since_measurement ?? "N/A"} gün
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
