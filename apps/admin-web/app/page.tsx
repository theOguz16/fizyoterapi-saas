import Link from "next/link";
import { ArrowRight, CalendarCheck2, LayoutDashboard, ScanLine, Settings2, Sparkles, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";

const shortcuts = [
  { href: "/dashboard", label: "Admin Dashboard", icon: LayoutDashboard },
  { href: "/trainer/checkin", label: "Trainer Check-in", icon: ScanLine },
  { href: "/trainer/today", label: "Trainer Today", icon: CalendarCheck2 },
  { href: "/trainer/members", label: "Trainer Members", icon: Users },
  { href: "/admin/settings", label: "Admin Settings", icon: Settings2 },
];

export default function HomePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.18),_transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eef6ff_48%,#f8fafc_100%)] p-4 md:p-8">
      <div className="w-full max-w-6xl space-y-4">
        <Card className="interactive-panel border-emerald-100/80 bg-white/95 shadow-soft">
          <CardHeader className="space-y-3">
            <Badge variant="secondary" className="w-fit bg-emerald-100 text-emerald-900">
              Admin Web Console
            </Badge>
            <CardTitle className="text-3xl tracking-tight md:text-4xl">
              Fitness SaaS Isletme Paneli
            </CardTitle>
            <CardDescription className="max-w-3xl text-sm md:text-base">
              Admin, trainer ve member akislari tek panelde toplandi. Demo tenant ile giris yapip tum sprint
              ekranlarini rol bazli test edebilirsin.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/login">
                Login Ekrani
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/dashboard">Hizli Dashboard</Link>
            </Button>
          </CardContent>
        </Card>

        <section className="grid gap-3 md:grid-cols-3">
          <MetricCard label="Roller" value="Admin • Trainer • Member" hint="Tek panelden rol bazlı deneyim" icon={<Users className="h-4 w-4" />} />
          <MetricCard label="Akışlar" value="Takvim • Paket • Risk" tone="emerald" hint="Operasyonel modüller hazır" icon={<CalendarCheck2 className="h-4 w-4" />} />
          <MetricCard label="Deneyim" value="Daha güçlü UI/UX" tone="amber" hint="Hover, durum rengi, boş durum ve aksiyon dili" icon={<Sparkles className="h-4 w-4" />} />
        </section>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.href} className="interactive-panel border-emerald-100/80 bg-white/95 shadow-soft">
                <CardContent className="flex items-center justify-between p-5">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Hizli Gecis</p>
                    <p className="font-semibold">{item.label}</p>
                  </div>
                  <Button asChild variant="ghost" size="icon">
                    <Link href={item.href} aria-label={item.label}>
                      <Icon className="h-5 w-5 text-emerald-700" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </main>
  );
}
