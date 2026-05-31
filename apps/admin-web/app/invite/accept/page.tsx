"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, Clock3, ShieldCheck, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { FizyoFlowLogo } from "@/components/brand/fizyoflow-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { getApiBase } from "@/lib/api-base";

type PreviewPayload = {
  data: {
    id: string;
    role: "TRAINER" | "MEMBER";
    identity_hint: string;
    expires_at: string;
    status: string;
  };
};

export default function InviteAcceptPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center p-6">
          <p className="text-sm text-muted-foreground">Davet doğrulanıyor...</p>
        </main>
      }
    >
      <InviteAcceptContent />
    </Suspense>
  );
}

function InviteAcceptContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = useMemo(() => params.get("token") ?? "", [params]);
  const apiBase = getApiBase();

  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewPayload["data"] | null>(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    password: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    if (!token) return;
    fetch(`${apiBase}/public/invites/${token}/preview`)
      .then(async (res) => {
        const payload = (await res.json()) as PreviewPayload;
        if (!res.ok) {
          throw new Error((payload as any)?.error?.message || "Davet doğrulanamadı");
        }
        setPreview(payload.data);
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Davet doğrulanamadı");
      });
  }, [apiBase, token]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      toast.error("Token bulunamadı");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/public/invites/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, ...form }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error?.message || "Davet kabul edilemedi");
      }

      toast.success("Kaydın tamamlandı. Şimdi giriş yapabilirsin.");
      router.push("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Davet kabul edilemedi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eef6ff_45%,#f8fafc_100%)] p-4 md:p-8">
      <div className="w-full max-w-3xl space-y-4">
        <Card className="interactive-panel border-slate-200/80 bg-white/95 shadow-soft">
          <CardHeader>
            <FizyoFlowLogo />
            <CardTitle>Davet Kabul Ekranı</CardTitle>
            <CardDescription>
              Klinik davetin doğrulandıktan sonra kişisel bilgilerini tamamlayarak güvenli hesabını oluştur.
            </CardDescription>
          </CardHeader>
        </Card>

        <section className="grid gap-3 md:grid-cols-3">
          <MetricCard label="Adım 1" value="Davet Doğrula" hint="Bağlantı ve rol bilgisi" icon={<ShieldCheck className="h-4 w-4" />} />
          <MetricCard label="Adım 2" value="Profilini Tamamla" tone="emerald" hint="Kimlik ve iletişim alanları" icon={<UserRoundPlus className="h-4 w-4" />} />
          <MetricCard label="Adım 3" value="Giriş Yap" tone="amber" hint="Hesap aktivasyonu sonrası" icon={<CheckCircle2 className="h-4 w-4" />} />
        </section>

        <Card className="interactive-panel border-slate-200/80 bg-white/95 shadow-soft">
          <CardHeader>
            <CardTitle>Davet Bilgisi</CardTitle>
          </CardHeader>
          <CardContent>
            {!preview ? (
              <EmptyState title="Davet doğrulanıyor" description="Bağlantı, rol ve geçerlilik bilgileri kontrol ediliyor." />
            ) : (
              <div className="detail-grid text-sm">
                <div className="detail-pill"><ShieldCheck className="h-4 w-4 text-sky-600" /> Rol: {preview.role}</div>
                <div className="detail-pill"><UserRoundPlus className="h-4 w-4 text-sky-600" /> Kimlik: {preview.identity_hint}</div>
                <div className="detail-pill"><Clock3 className="h-4 w-4 text-sky-600" /> Son geçerlilik: {new Date(preview.expires_at).toLocaleString("tr-TR")}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="interactive-panel border-slate-200/80 bg-white/95 shadow-soft">
          <CardHeader>
            <CardTitle>Hesap Bilgilerini Tamamla</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid gap-4">
              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Ad</Label>
                  <Input value={form.first_name} onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Soyad</Label>
                  <Input value={form.last_name} onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))} />
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>E-posta (telefon davetlerinde zorunlu)</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Telefon (e-posta davetlerinde zorunlu)</Label>
                  <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Şifre</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
              </div>

              <Button type="submit" disabled={loading}>
                {loading ? "Kaydediliyor..." : "Hesabı Tamamla"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
