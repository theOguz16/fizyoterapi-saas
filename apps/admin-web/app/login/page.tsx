"use client";

import { FormEvent, useState } from "react";
import { ShieldCheck, Stethoscope, UserRound } from "lucide-react";
import { toast } from "sonner";
import { FizyoFlowLogo } from "@/components/brand/fizyoflow-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/lib/auth-session";
import { resolveRoleHome } from "@/lib/role-routing";
import { webAuthRequest } from "@/lib/web-auth-client";

type Role = "ADMIN" | "TRAINER" | "MEMBER";

type LoginPayload = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const { refresh } = useAuthSession();
  const [form, setForm] = useState<LoginPayload>({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const payload = await webAuthRequest<{ data?: { available_surfaces?: { web?: boolean }; user?: { role?: Role } } }>("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });

      if (payload?.data?.available_surfaces?.web === false) {
        throw new Error("Bu hesap web paneline hazir degil. Once FizyoFlow onayini bekleyin.");
      }

      const role = payload?.data?.user?.role as Role | undefined;
      if (role === "MEMBER") {
        throw new Error("Üye girişi mobil uygulamada yapılır.");
      }

      await refresh();
      const nextRoute = resolveRoleHome(role);
      if (nextRoute) {
        window.location.assign(nextRoute);
        return;
      }

      throw new Error("Bu panel için yetkili kullanıcı rolü bulunamadı.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center p-4 md:p-8">
      <div className="w-full max-w-5xl space-y-4">
        <Card className="interactive-panel border-slate-200/80 bg-white/95 shadow-soft">
          <CardHeader className="space-y-3">
            <FizyoFlowLogo />
            <CardTitle className="text-3xl tracking-tight">Salon Operasyon Girişi</CardTitle>
            <CardDescription className="max-w-3xl text-sm md:text-base">
              Bu panel yalnız yönetici ve eğitmen girişleri içindir. Üyeler giriş ve salon seçimini mobil uygulama üzerinden yapar.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-[360px,1fr]">
          <Card className="interactive-panel border-slate-200/80 bg-white/95 shadow-soft">
            <CardHeader>
              <CardTitle className="text-lg">Erişim Politikası</CardTitle>
              <CardDescription>Bu ekran artık örnek e-posta ve şifre göstermez. Erişim sadece size atanmış kurumsal hesaplarla yapılır.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="detail-pill px-4 py-3">
                <ShieldCheck className="h-4 w-4 text-sky-600" />
                <span>Yönetici hesapları klinik operasyon ve finans akışını yönetir.</span>
              </div>
              <div className="detail-pill px-4 py-3">
                <Stethoscope className="h-4 w-4 text-emerald-600" />
                <span>Eğitmen hesapları kendi takvim, danışan ve check-in akışına erişir.</span>
              </div>
              <div className="detail-pill px-4 py-3">
                <UserRound className="h-4 w-4 text-amber-600" />
                <span>Üye hesapları bu panel yerine mobil ürün akışında oturum açar.</span>
              </div>
            </CardContent>
          </Card>

          <Card className="interactive-panel border-slate-200/80 bg-white/95 shadow-soft">
            <CardHeader>
              <CardTitle>Oturum Aç</CardTitle>
              <CardDescription>E-posta ve şifreni girerek salon operasyon paneline devam et.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">E-posta</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="ornek@fizyoflow.com"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="password">Şifre</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="********"
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  />
                </div>

                <Button type="submit" disabled={loading} className="mt-2">
                  {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
