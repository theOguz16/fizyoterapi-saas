"use client";
/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useRef, useState } from "react";
import { useRequireRole } from "@/lib/require-role";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { MetricCard } from "@/components/ui/metric-card";
import { FormField } from "@/components/ui/form-field";
import { paymentStatusLabel } from "@/lib/presentation";
import { httpRequest } from "@/lib/http-client";
import {
  applicationStageLabel,
  applicationStageVariant,
  filterApplicationsByStage,
  parseApplicationNote,
} from "./application-utils";

type ApplicationRow = {
  id: string;
  status: string;
  payment_status: string;
  payment_reference?: string | null;
  payment_confirmed_at?: string | null;
  note?: string | null;
  raw_note?: string | null;
  created_at: string;
  selected_slot_count?: number | null;
  package_id?: string | null;
  package_title?: string | null;
  trainer_id?: string | null;
  trainer_name?: string | null;
  applicant?: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
  } | null;
};

export default function AdminApplicationsPage() {
  const { loading: authLoading, user } = useRequireRole("ADMIN");
  const status: "loading" | "ready" | "unauthorized" = authLoading ? "loading" : user ? "ready" : "unauthorized";
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [stageFilter, setStageFilter] = useState<"ALL" | "PENDING" | "PAYMENT" | "JOINED" | "REJECTED">("ALL");
  const listAbortRef = useRef<AbortController | null>(null);
  const listRequestIdRef = useRef(0);

  useEffect(() => {
    if (status !== "ready") return;
    loadApplications().catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Başvurular yüklenemedi");
    });
  }, [status]);

  useEffect(() => {
    return () => {
      listAbortRef.current?.abort();
    };
  }, []);

  async function loadApplications() {
    listAbortRef.current?.abort();
    const controller = new AbortController();
    listAbortRef.current = controller;
    const requestId = ++listRequestIdRef.current;
    setLoading(true);
    try {
      const payload = await httpRequest<{ data: ApplicationRow[] }>("/admin/salon-applications", { signal: controller.signal });
      if (requestId !== listRequestIdRef.current) return;
      setRows(Array.isArray(payload.data) ? payload.data : []);
    } finally {
      if (requestId === listRequestIdRef.current) {
        setLoading(false);
      }
      if (listAbortRef.current === controller) {
        listAbortRef.current = null;
      }
    }
  }

  async function approve(id: string) {
    try {
      setBusyId(id);
      await httpRequest(`/admin/salon-applications/${id}/approve`, { method: "PATCH" });
      await loadApplications();
      toast.success("Başvuru onaylandı ve üyelik aktive edildi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Başvuru güncellenemedi");
    } finally {
      setBusyId("");
    }
  }

  async function reject(id: string) {
    try {
      setBusyId(id);
      await httpRequest(`/admin/salon-applications/${id}/reject`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: "Yönetici tarafından reddedildi" }),
      });
      await loadApplications();
      toast.success("Başvuru reddedildi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Başvuru reddedilemedi");
    } finally {
      setBusyId("");
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

  const visibleRows = filterApplicationsByStage(rows, stageFilter);
  const pendingCount = rows.filter((row) => row.status === "PENDING").length;
  const paymentWaitingCount = rows.filter((row) => row.status === "APPROVED" && row.payment_status !== "VERIFIED").length;
  const joinedCount = rows.filter((row) => row.status === "APPROVED" && row.payment_status === "VERIFIED").length;

  return (
    <AppShell>
      <PageHeader
        title="Başvurular"
        description="Mobil uygulamadan gelen gerçek salon katılım taleplerini yönetin. Onay verdiğiniz başvurular üyeliğe dönüşür ve seçilen saatler takvime işlenir."
      />

      <Card className="surface-card">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Akış tek huni olarak ilerler:
          <strong className="ml-1">Başvurdu</strong>
          <span> → </span>
          <strong>Salona Katıldı</strong>.
          Admin onayı sonrasında salon üyeliği ve seçilen saatler doğrudan aktifleşir.
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Yeni Başvuru" value={pendingCount} tone="amber" icon={<i className="fa-solid fa-inbox" aria-hidden="true" />} hint="Henüz ödeme akışına alınmayan talepler" />
        <MetricCard label="Ödeme Bekliyor" value={paymentWaitingCount} tone="sky" icon={<i className="fa-solid fa-hourglass-half" aria-hidden="true" />} hint="Eski akıştan kalan, henüz doğrulanmamış başvurular" />
        <MetricCard label="Salona Katıldı" value={joinedCount} tone="emerald" icon={<i className="fa-solid fa-circle-check" aria-hidden="true" />} hint="Ödemesi onaylanıp üyeliği açılan kullanıcılar" />
      </section>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Filtreler</CardTitle>
        </CardHeader>
        <CardContent className="filter-toolbar grid gap-3 md:grid-cols-[minmax(240px,320px),auto]">
          <FormField label="Akış Aşaması" hint="Başvuru, ödeme ve katılım aşamasına göre filtrele.">
            <Select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as typeof stageFilter)}>
              <option value="ALL">Tüm Başvurular</option>
              <option value="PENDING">Başvurdu</option>
              <option value="PAYMENT">Ödeme Bekliyor</option>
              <option value="JOINED">Salona Katıldı</option>
              <option value="REJECTED">Reddedildi</option>
            </Select>
          </FormField>
          <div className="grid gap-1.5 md:self-start md:justify-items-end">
            <span className="invisible inline-flex items-center text-sm font-medium" aria-hidden="true">
              Listeyi Yenile
            </span>
            <ActionButton action="refresh" onClick={() => loadApplications()} disabled={loading || Boolean(busyId)}>
              Listeyi Yenile
            </ActionButton>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4">
        {visibleRows.length === 0 && !loading ? (
          <EmptyState
            title="Bu filtre için başvuru görünmüyor"
            description="Mobil uygulamadan gelen salon katılım talepleri burada listelenir."
            icon={<i className="fa-solid fa-inbox" aria-hidden="true" />}
          />
        ) : null}

        {visibleRows.map((row) => (
          <Card key={row.id} className="surface-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3 text-base">
                <span>{row.applicant?.full_name || "Salon Başvurusu"}</span>
                <Badge variant={applicationStageVariant(row)}>{applicationStageLabel(row)}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[1.4fr,auto] md:items-center">
              <div className="grid gap-2 text-sm text-slate-600">
                <p>E-posta: {row.applicant?.email || "-"}</p>
                <p>Telefon: {row.applicant?.phone || "-"}</p>
                <p>Başvuru Tarihi: {new Date(row.created_at).toLocaleString("tr-TR")}</p>
                <p>Ödeme Durumu: {paymentStatusLabel(row.payment_status)}</p>
                <p>Paket: {row.package_title || row.package_id || "Belirtilmedi"}</p>
                <p>Eğitmen: {row.trainer_name || row.trainer_id || "Belirtilmedi"}</p>
                <p>Tercih Slotu: {row.selected_slot_count || 0}</p>
                {row.payment_confirmed_at ? <p>Ödeme Onayı: {new Date(row.payment_confirmed_at).toLocaleString("tr-TR")}</p> : null}
                {row.payment_reference ? <p>Ödeme Referansı: {row.payment_reference}</p> : null}
                {row.note ? (
                  <div className="grid gap-1 rounded-[var(--ui-radius-md)] border border-slate-200/80 bg-slate-50/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Not</p>
                    {parseApplicationNote(row.note).map((item, index) => (
                      <p key={`${row.id}-note-${index}`} className="text-sm text-slate-700">
                        {item}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <ActionButton
                  action="approve"
                  label="Ödemeye Aktar"
                  disabled={busyId === row.id || row.status !== "PENDING"}
                  onClick={() => void approve(row.id)}
                />
                <ActionButton
                  action="reject"
                  disabled={busyId === row.id || row.payment_status === "VERIFIED" || row.status === "REJECTED"}
                  onClick={() => void reject(row.id)}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </AppShell>
  );
}
