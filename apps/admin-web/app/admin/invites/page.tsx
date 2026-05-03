"use client";

import { useEffect, useState } from "react";
import { Copy, MailPlus, TimerReset, UserCheck } from "lucide-react";
import { useRequireRole } from "@/lib/require-role";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { MobileActionBar } from "@/components/layout/mobile-action-bar";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionButton } from "@/components/ui/action-button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { httpRequest } from "@/lib/http-client";
import { inviteStatusLabel, resolveInviteFormError } from "./invite-utils";

type InviteStatus = "PENDING" | "ACCEPTED" | "CANCELED" | "EXPIRED";

type InviteRow = {
  id: string;
  role: "TRAINER";
  email_or_phone: string;
  status: InviteStatus;
  expires_at: string;
  created_at: string;
  invite_url?: string;
};

export default function AdminInvitesPage() {
  const { loading: authLoading, user } = useRequireRole("ADMIN");
  const status: "loading" | "ready" | "unauthorized" = authLoading ? "loading" : user ? "ready" : "unauthorized";
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [manualCopyLink, setManualCopyLink] = useState("");

  const [form, setForm] = useState({
    email_or_phone: "",
    expires_in_hours: 72,
  });
  const inviteFormError = resolveInviteFormError(form.email_or_phone, form.expires_in_hours);

  useEffect(() => {
    if (status !== "ready") return;
    loadInvites().catch(() => toast.error("Davetler yüklenemedi"));
  }, [status]);

  const pendingCount = rows.filter((row) => row.status === "PENDING").length;
  const acceptedCount = rows.filter((row) => row.status === "ACCEPTED").length;
  const expiredCount = rows.filter((row) => row.status === "EXPIRED").length;

  async function loadInvites() {
    const payload = await httpRequest<{ data: InviteRow[] }>("/admin/invites");
    setRows(payload.data || []);
  }

  async function createInvite() {
    if (!form.email_or_phone.trim()) {
      toast.error("E-posta veya telefon zorunlu");
      return;
    }

    setBusy(true);
    try {
      const payload = await httpRequest<{ data: InviteRow & { invite_url: string } }>("/admin/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          role: "TRAINER",
        }),
      });

      try {
        await navigator.clipboard.writeText(payload.data.invite_url);
        setManualCopyLink("");
        toast.success("Davet oluşturuldu ve bağlantı panoya kopyalandı");
      } catch {
        setManualCopyLink(payload.data.invite_url);
        toast.error("Tarayıcı panoya kopyalamaya izin vermedi. Aşağıdaki bağlantıyı manuel kopyalayın.");
      }
      setForm((prev) => ({ ...prev, email_or_phone: "" }));
      await loadInvites();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Davet oluşturulamadı");
    } finally {
      setBusy(false);
    }
  }

  async function cancelInvite(id: string) {
    setBusy(true);
    try {
      await httpRequest(`/admin/invites/${id}/cancel`, { method: "PATCH" });
      toast.success("Davet iptal edildi");
      await loadInvites();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Davet iptal edilemedi");
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
        title="Davet Yönetimi"
        description="Eğitmenleri davet bağlantısı ile güvenli şekilde sisteme dahil edin."
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Toplam Davet" value={rows.length} hint="Geçmiş ve aktif kayıtlar" icon={<MailPlus className="h-4 w-4" />} />
        <MetricCard label="Bekleyen" value={pendingCount} tone="amber" hint="Henüz kabul edilmedi" icon={<TimerReset className="h-4 w-4" />} />
        <MetricCard label="Kabul Edilen" value={acceptedCount} tone="emerald" hint="Kullanıcıya dönüştü" icon={<UserCheck className="h-4 w-4" />} />
        <MetricCard label="Manuel Kopyalama" value={manualCopyLink ? "Gerekli" : "Yok"} tone="slate" hint="Pano erişimi engellendiyse" icon={<Copy className="h-4 w-4" />} />
      </section>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Yeni Davet Oluştur</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="section-band">
            <p className="text-sm font-medium text-slate-900">Yeni kullanıcıyı güvenli davet akışıyla ekleyin.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Eğitmenin e-posta veya telefon bilgisini girin, bağlantının ne kadar süre geçerli olacağını belirleyin.
            </p>
          </div>
          <div className="filter-toolbar grid gap-3 md:grid-cols-[minmax(0,1fr),180px,auto]">
          <FormField label="E-posta / Telefon" hint="Davet bağlantısı bu bilgiyle ilişkilendirilecek." error={inviteFormError} required>
            <Input
              placeholder="eposta@ornek.com veya 5551234567"
              value={form.email_or_phone}
              onChange={(e) => setForm((p) => ({ ...p, email_or_phone: e.target.value }))}
            />
          </FormField>
          <FormField label="Geçerlilik (Saat)" hint="Varsayılan: 72 saat">
            <Input
              type="number"
              placeholder="72"
              value={form.expires_in_hours}
              onChange={(e) => setForm((p) => ({ ...p, expires_in_hours: Number(e.target.value) || 72 }))}
            />
          </FormField>
          <div className="grid gap-1.5 md:self-start md:justify-items-end">
            <span className="invisible inline-flex items-center text-sm font-medium" aria-hidden="true">
              Davet Oluştur
            </span>
            <ActionButton className="w-full md:w-auto" action="invite" onClick={createInvite} disabled={busy || !!inviteFormError}>
              Davet Oluştur
            </ActionButton>
          </div>
          </div>
        </CardContent>
      </Card>

      {manualCopyLink ? (
        <Card className="surface-card">
          <CardHeader>
            <CardTitle>Manuel Kopyalama</CardTitle>
          </CardHeader>
          <CardContent className="section-band grid gap-2">
            <p className="text-xs text-muted-foreground">
              Panoya kopyalama izni verilmedi. Bağlantıyı aşağıdan seçip kopyalayabilirsiniz.
            </p>
            <Input value={manualCopyLink} readOnly />
          </CardContent>
        </Card>
      ) : null}

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Aktif / Geçmiş Davetler</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {rows.length === 0 ? (
            <EmptyState
              icon={<MailPlus className="h-5 w-5" />}
              title="Henüz davet oluşturulmadı"
              description="İlk eğitmen davetini oluşturarak sisteme güvenli onboarding akışını başlat."
            />
          ) : (
            rows.map((row) => (
              <article key={row.id} className="list-row rounded-2xl px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{row.email_or_phone}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.role === "TRAINER" ? "Eğitmen" : "Üye"} • Oluşturma: {new Date(row.created_at).toLocaleString("tr-TR")} • Bitiş: {new Date(row.expires_at).toLocaleString("tr-TR")}
                    </p>
                  </div>
                  <Badge variant={row.status === "ACCEPTED" ? "secondary" : row.status === "PENDING" ? "outline" : "danger"}>
                    {inviteStatusLabel(row.status)}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.status === "PENDING" ? (
                    <ActionButton action="cancel" iconOnly tooltip="Davet İptal Et" variant="destructive" size="sm" disabled={busy} onClick={() => cancelInvite(row.id)} />
                  ) : null}
                </div>
              </article>
            ))
          )}
        </CardContent>
      </Card>
      <MobileActionBar>
        <ActionButton action="invite" className="w-full" onClick={createInvite} disabled={busy || !!inviteFormError}>
          Davet Oluştur
        </ActionButton>
      </MobileActionBar>
    </AppShell>
  );
}
