"use client";
/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useRef, useState } from "react";
import { useRequireRole } from "@/lib/require-role";
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
import { bookingStatusLabel, paymentStatusLabel } from "@/lib/presentation";
import { httpRequest } from "@/lib/http-client";
import { parseApplicationNote } from "../applications/application-utils";
import { membershipQueueFilter, paymentFilterLabel } from "./payment-utils";

type PaymentStatus = "REQUESTED" | "APPROVED" | "REJECTED";

type BookingPaymentRow = {
  id: string;
  member_id: string;
  member_full_name?: string | null;
  member_email?: string | null;
  trainer_id: string;
  trainer_full_name?: string | null;
  trainer_email?: string | null;
  session_id?: string | null;
  session_title?: string | null;
  session_type?: string | null;
  lesson_category?: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  payment_status: PaymentStatus;
  package_id?: string | null;
  package_title?: string | null;
  package_display_price?: string | null;
  payment_requested_at?: string | null;
  payment_approved_at?: string | null;
  payment_note?: string | null;
};

type MembershipApplicationPaymentRow = {
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

export default function AdminPaymentsPage() {
  const { loading: authLoading, user } = useRequireRole("ADMIN");
  const status: "loading" | "ready" | "unauthorized" = authLoading ? "loading" : user ? "ready" : "unauthorized";
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<PaymentStatus>("REQUESTED");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<BookingPaymentRow[]>([]);
  const [membershipRows, setMembershipRows] = useState<MembershipApplicationPaymentRow[]>([]);
  const listAbortRef = useRef<AbortController | null>(null);
  const listRequestIdRef = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (status !== "ready") return;
    loadRequests().catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Ödeme talepleri yüklenemedi");
    });
  }, [status, filter]);

  useEffect(() => {
    return () => {
      listAbortRef.current?.abort();
    };
  }, []);

  async function loadRequests() {
    listAbortRef.current?.abort();
    const controller = new AbortController();
    listAbortRef.current = controller;
    const requestId = ++listRequestIdRef.current;
    const [bookingPayload, membershipPayload] = await Promise.all([
      httpRequest<{ data: BookingPaymentRow[] }>(`/admin/payments/requests?payment_status=${filter}`, {
        signal: controller.signal,
      }),
      httpRequest<{ data: MembershipApplicationPaymentRow[] }>("/admin/salon-applications", {
        signal: controller.signal,
      }),
    ]);
    if (requestId !== listRequestIdRef.current) return;
    setRows(bookingPayload.data || []);
    setMembershipRows((membershipPayload.data || []).filter((row) => membershipQueueFilter(row, filter)));
  }

  async function approve(bookingId: string) {
    try {
      setBusy(true);
      await httpRequest(`/admin/payments/requests/${bookingId}/approve`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payment_note: note || undefined }),
      });
      toast.success("Ödeme talebi onaylandı");
      setNote("");
      await loadRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Onay işlemi başarısız");
    } finally {
      setBusy(false);
    }
  }

  async function reject(bookingId: string) {
    try {
      setBusy(true);
      await httpRequest(`/admin/payments/requests/${bookingId}/reject`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payment_note: note || undefined }),
      });
      toast.success("Ödeme talebi reddedildi");
      setNote("");
      await loadRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Red işlemi başarısız");
    } finally {
      setBusy(false);
    }
  }

  async function approveMembershipApplication(applicationId: string) {
    try {
      setBusy(true);
      await httpRequest(`/admin/salon-applications/${applicationId}/payment-verify`, {
        method: "PATCH",
      });
      toast.success("Ödeme onaylandı ve salon üyeliği aktive edildi");
      await loadRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Üyelik ödemesi onaylanamadı");
    } finally {
      setBusy(false);
    }
  }

  async function rejectMembershipApplication(applicationId: string) {
    try {
      setBusy(true);
      await httpRequest(`/admin/salon-applications/${applicationId}/reject`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: note || "Ödeme onayı verilmedi" }),
      });
      toast.success("Başvuru reddedildi");
      setNote("");
      await loadRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Başvuru reddedilemedi");
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

  const totalVisibleRows = rows.length + membershipRows.length;

  return (
    <AppShell>
      <PageHeader
        title="Ödeme Onayları"
        description="Ders/randevu ödemelerini ve salon katılım başvurularından gelen ödeme onaylarını yönetin."
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Toplam Kayıt" value={totalVisibleRows} tone="sky" icon={<i className="fa-solid fa-credit-card" aria-hidden="true" />} />
        <MetricCard label="Randevu Ödemeleri" value={rows.length} tone="amber" icon={<i className="fa-solid fa-calendar-check" aria-hidden="true" />} />
        <MetricCard label="Salon Katılımı" value={membershipRows.length} tone="emerald" icon={<i className="fa-solid fa-user-plus" aria-hidden="true" />} />
        <MetricCard label="Aktif Filtre" value={paymentFilterLabel(filter)} tone="slate" icon={<i className="fa-solid fa-filter" aria-hidden="true" />} />
      </section>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Filtre ve Not</CardTitle>
        </CardHeader>
        <CardContent className="filter-toolbar grid gap-3 md:grid-cols-[240px,1fr,auto]">
          <Select value={filter} onChange={(e) => setFilter(e.target.value as PaymentStatus)}>
            <option value="REQUESTED">Onay Bekleyen</option>
            <option value="APPROVED">Onaylanan</option>
            <option value="REJECTED">Reddedilen</option>
          </Select>
          <Input
            placeholder="Onay/ret notu (opsiyonel)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <ActionButton action="refresh" onClick={() => loadRequests()} disabled={busy} />
        </CardContent>
      </Card>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Salon Katılım Ödemeleri</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {membershipRows.length === 0 ? (
            <EmptyState
              icon={<i className="fa-solid fa-credit-card" aria-hidden="true" />}
              title="Bu filtre için kayıt bulunmuyor"
              description="Ön onay alan salon başvuruları burada ödeme onayı bekler."
            />
          ) : (
            membershipRows.map((row) => (
              <article key={row.id} className="list-row">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>Başvuru #{row.id}</strong>
                  <Badge variant="secondary">{paymentStatusLabel(row.payment_status)}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Üye: {row.applicant?.full_name || row.applicant?.id || "Belirlenmedi"}
                  {row.applicant?.email ? ` (${row.applicant.email})` : ""}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Telefon: {row.applicant?.phone || "-"} • Başvuru: {new Date(row.created_at).toLocaleString("tr-TR")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Paket: {row.package_title || row.package_id || "Belirtilmedi"}</p>
                <p className="mt-1 text-sm text-muted-foreground">Eğitmen: {row.trainer_name || row.trainer_id || "Belirtilmedi"}</p>
                <p className="mt-1 text-sm text-muted-foreground">Tercih Slotu: {row.selected_slot_count || 0}</p>
                <p className="mt-1 text-sm text-muted-foreground">Akış Durumu: {row.status === "APPROVED" && row.payment_status === "VERIFIED" ? "Salona Katıldı" : row.status === "APPROVED" ? "Ödeme Bekliyor" : "Reddedildi"}</p>
                {row.payment_reference ? <p className="mt-1 text-sm text-muted-foreground">Ödeme Referansı: {row.payment_reference}</p> : null}
                {row.payment_confirmed_at ? <p className="mt-1 text-xs text-muted-foreground">Ödeme Onayı: {new Date(row.payment_confirmed_at).toLocaleString("tr-TR")}</p> : null}
                {row.note ? (
                  <div className="mt-2 grid gap-1 rounded-[var(--ui-radius-md)] border border-slate-200/80 bg-slate-50/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Başvuru Notu</p>
                    {parseApplicationNote(row.note).map((item, index) => (
                      <p key={`${row.id}-note-${index}`} className="text-sm text-slate-700">
                        {item}
                      </p>
                    ))}
                  </div>
                ) : null}

                {filter === "REQUESTED" ? (
                  <div className="mt-3 flex gap-2">
                    <ActionButton action="approve" iconOnly size="sm" tooltip="Ödemeyi Onayla" onClick={() => approveMembershipApplication(row.id)} disabled={busy} />
                    <ActionButton action="reject" iconOnly size="sm" tooltip="Başvuruyu Reddet" onClick={() => rejectMembershipApplication(row.id)} disabled={busy} />
                  </div>
                ) : null}
              </article>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Ders ve Randevu Ödemeleri</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {rows.length === 0 ? (
            <EmptyState
              icon={<i className="fa-solid fa-credit-card" aria-hidden="true" />}
              title="Bu filtre için kayıt bulunmuyor"
              description="Ödeme durumu değiştiğinde veya yeni talep geldiğinde liste güncellenecek."
            />
          ) : (
            rows.map((row) => (
              <article key={row.id} className="list-row">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>Randevu #{row.id}</strong>
                  <Badge variant="secondary">{paymentStatusLabel(row.payment_status)}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Üye: {row.member_full_name || row.member_id}
                  {row.member_email ? ` (${row.member_email})` : ""} • Eğitmen: {row.trainer_full_name || row.trainer_id}
                  {row.trainer_email ? ` (${row.trainer_email})` : ""}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(row.starts_at).toLocaleString("tr-TR")} - {new Date(row.ends_at).toLocaleString("tr-TR")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ders: {row.session_title || row.lesson_category || "Belirlenmedi"} • Randevu durumu: {bookingStatusLabel(row.status)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Paket: {row.package_title || "Belirlenmedi"} • Ücret: {row.package_display_price ? `${row.package_display_price} TL` : "Belirlenmedi"}
                </p>
                {row.payment_note ? <p className="mt-1 text-xs text-muted-foreground">Not: {row.payment_note}</p> : null}

                {filter === "REQUESTED" ? (
                  <div className="mt-3 flex gap-2">
                    <ActionButton action="approve" iconOnly size="sm" tooltip="Onayla" onClick={() => approve(row.id)} disabled={busy} />
                    <ActionButton action="reject" iconOnly size="sm" tooltip="Reddet" onClick={() => reject(row.id)} disabled={busy} />
                  </div>
                ) : null}
              </article>
            ))
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
