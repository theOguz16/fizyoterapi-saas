"use client";
/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireRole } from "@/lib/require-role";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { ActionButton } from "@/components/ui/action-button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { getApiBase } from "@/lib/api-base";
import { buildReferralMetrics, referralStatusLabel } from "./referral-utils";

type Role = "ADMIN" | "TRAINER" | "MEMBER";
type SessionData = {
  accessToken: string;
  user: {
    role: Role;
    tenantSlug: string;
    email: string;
  };
};

type ReferralStatus = "INVITED" | "CONVERTED" | "REWARDED" | "CANCELED";

type ReferralItem = {
  id: string;
  inviter_member_id: string;
  invitee_phone_or_email: string;
  code: string;
  status: ReferralStatus;
  converted_at?: string | null;
  created_at: string;
};

type RewardItem = {
  id: string;
  referral_id: string;
  member_id: string;
  credits_granted: number;
  rule_name: string;
  granted_at: string;
  created_at: string;
};

export default function AdminReferralsPage() {
  const apiBase = getApiBase();
  const [status, setStatus] = useState<"loading" | "ready" | "unauthorized">("loading");
  const [session, setSession] = useState<SessionData | null>(null);
  const [busy, setBusy] = useState(false);

  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedDetail, setSelectedDetail] = useState<{ referral: ReferralItem; rewards: RewardItem[] } | null>(null);

  const [filters, setFilters] = useState({
    status: "",
    memberId: "",
    limit: 100,
  });

  const [grantForm, setGrantForm] = useState({
    credits_granted: 1,
    rule_name: "Referans ödülü",
  });

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
    if (status !== "ready") return;
    Promise.all([loadReferrals(), loadRewards()]).catch(() => toast.error("Referans verileri yüklenemedi"));
  }, [status]);

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

  async function loadReferrals() {
    const query = new URLSearchParams();
    query.set("limit", String(filters.limit));
    if (filters.status) query.set("status", filters.status);
    if (filters.memberId) query.set("memberId", filters.memberId);

    const payload = await apiRequest<{ data: ReferralItem[] }>(`/admin/referrals?${query.toString()}`);
    const rows = payload.data || [];
    setReferrals(rows);
    if (!selectedId && rows.length > 0) {
      setSelectedId(rows[0].id);
      await loadDetail(rows[0].id);
    }
  }

  async function loadDetail(referralId: string) {
    const payload = await apiRequest<{ data: { referral: ReferralItem; rewards: RewardItem[] } }>(
      `/admin/referrals/${referralId}`
    );
    setSelectedId(referralId);
    setSelectedDetail(payload.data);
  }

  async function loadRewards() {
    const query = new URLSearchParams();
    query.set("limit", String(filters.limit));
    if (filters.memberId) query.set("memberId", filters.memberId);

    const payload = await apiRequest<{ data: RewardItem[] }>(`/admin/referrals/rewards/list?${query.toString()}`);
    setRewards(payload.data || []);
  }

  async function grantReward(referralId: string) {
    try {
      setBusy(true);
      await apiRequest(`/admin/referrals/${referralId}/grant-reward`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          credits_granted: Number(grantForm.credits_granted),
          rule_name: grantForm.rule_name,
        }),
      });
      await Promise.all([loadReferrals(), loadRewards(), loadDetail(referralId)]);
      toast.success("Ödül işlemi tamamlandı");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ödül verilemedi");
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

  const metrics = buildReferralMetrics(referrals, rewards);

  return (
    <AppShell>
      <PageHeader
        title="Referans ve Ödül Yönetimi"
        description="Davet sürecini, dönüşüm durumlarını ve referans ödülü hareketlerini yönetin."
        actions={
          <ActionButton
            action="refresh"
            size="sm"
            disabled={busy}
            onClick={() => Promise.all([loadReferrals(), loadRewards()]).catch(() => toast.error("Veriler yenilenemedi"))}
          >
            Listeyi Yenile
          </ActionButton>
        }
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Toplam Referans" value={metrics.total} tone="sky" icon={<i className="fa-solid fa-user-group" aria-hidden="true" />} hint="Filtreye göre listelenen referanslar" />
        <MetricCard label="Dönüşen" value={metrics.converted} tone="amber" icon={<i className="fa-solid fa-arrow-trend-up" aria-hidden="true" />} hint="Kayıta dönüşen davetler" />
        <MetricCard label="Ödüllendirilen" value={metrics.rewarded} tone="emerald" icon={<i className="fa-solid fa-gift" aria-hidden="true" />} hint="Ödül işlenen referanslar" />
        <MetricCard label="Ödül Hareketi" value={metrics.rewardMovements} tone="slate" icon={<i className="fa-solid fa-wallet" aria-hidden="true" />} hint="Kredi ve kampanya akışı" />
      </section>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Filtreler</CardTitle>
        </CardHeader>
        <CardContent className="filter-toolbar grid gap-3 md:grid-cols-[220px,1fr,auto,auto]">
          <FormField label="Durum">
            <Select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
              <option value="">Tüm Durumlar</option>
              <option value="INVITED">Davet Edildi</option>
              <option value="CONVERTED">Dönüştü</option>
              <option value="REWARDED">Ödüllendirildi</option>
              <option value="CANCELED">İptal</option>
            </Select>
          </FormField>
          <FormField label="Davet Eden Üye">
            <Input
              placeholder="Üye ID ile filtrele"
              value={filters.memberId}
              onChange={(e) => setFilters((p) => ({ ...p, memberId: e.target.value }))}
            />
          </FormField>
          <ActionButton action="filter" disabled={busy} onClick={() => loadReferrals()}>
            Referansları Getir
          </ActionButton>
          <ActionButton action="view" disabled={busy} onClick={() => loadRewards()}>
            Ödülleri Getir
          </ActionButton>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.1fr,1fr,1fr]">
        <Card className="surface-card">
          <CardHeader>
            <CardTitle>Referanslar</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {referrals.length === 0 ? (
              <EmptyState
                icon={<i className="fa-solid fa-user-group" aria-hidden="true" />}
                title="Referans kaydı bulunmuyor"
                description="Davet akışı başladığında dönüşümler ve kodlar burada listelenir."
              />
            ) : (
              referrals.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="interactive list-row text-left"
                  data-state={selectedId === row.id ? "selected" : undefined}
                  onClick={() => loadDetail(row.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong>{row.code}</strong>
                    <Badge
                      variant={
                        row.status === "REWARDED"
                          ? "success"
                          : row.status === "CANCELED"
                            ? "danger"
                            : row.status === "CONVERTED"
                              ? "warning"
                              : "secondary"
                      }
                    >
                      {referralStatusLabel(row.status)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{row.invitee_phone_or_email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Davet eden:{" "}
                    <Link href={`/admin/members/${row.inviter_member_id}`} className="interactive underline-offset-2 hover:underline">
                      {row.inviter_member_id}
                    </Link>
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader>
            <CardTitle>Seçili Referans</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {!selectedDetail ? (
              <EmptyState
                icon={<i className="fa-solid fa-circle-info" aria-hidden="true" />}
                title="Detay için referans seçin"
                description="Seçilen referans burada kural ve ödül aksiyonlarıyla birlikte açılır."
              />
            ) : (
              <>
                <div className="section-band">
                  <p className="text-sm">
                    <strong>Kod:</strong> {selectedDetail.referral.code}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Durum: {referralStatusLabel(selectedDetail.referral.status)} • Oluşturma:{" "}
                    {new Date(selectedDetail.referral.created_at).toLocaleString("tr-TR")}
                  </p>
                </div>
                <div className="grid gap-2 md:grid-cols-[110px,1fr,auto]">
                  <FormField label="Kredi" className="md:col-span-1">
                    <Input
                      type="number"
                      value={grantForm.credits_granted}
                      onChange={(e) => setGrantForm((p) => ({ ...p, credits_granted: Number(e.target.value) || 1 }))}
                    />
                  </FormField>
                  <FormField label="Kural Açıklaması" className="md:col-span-1">
                    <Input
                      value={grantForm.rule_name}
                      onChange={(e) => setGrantForm((p) => ({ ...p, rule_name: e.target.value }))}
                    />
                  </FormField>
                  <div className="flex items-end">
                    <ActionButton action="approve" disabled={busy} onClick={() => grantReward(selectedDetail.referral.id)}>
                      Ödül Ver
                    </ActionButton>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader>
            <CardTitle>Ödül Hareketleri</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {rewards.length === 0 ? (
              <EmptyState
                icon={<i className="fa-solid fa-gift" aria-hidden="true" />}
                title="Ödül hareketi bulunmuyor"
                description="Kampanya ve manuel ödüller burada geçmiş olarak görünür."
              />
            ) : (
              rewards.map((row) => (
                <article key={row.id} className="list-row text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <strong>{row.credits_granted} grup ders kredisi</strong>
                    <span className="text-xs text-muted-foreground">{new Date(row.granted_at).toLocaleString("tr-TR")}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{row.rule_name}</p>
                </article>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
