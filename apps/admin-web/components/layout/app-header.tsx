"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { ShieldCheck, Stethoscope, UserRound } from "lucide-react";
import { ClinervaLogo } from "@/components/brand/clinerva-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppIcon } from "@/components/ui/app-icon";
import { useAuthSession } from "@/lib/auth-session";
import type { Role } from "@/lib/auth-types";
import { cn } from "@/lib/utils";
import { webAuthRequest } from "@/lib/web-auth-client";

const navByRole: Record<Role, Array<{ href: string; label: string; icon: string; shortLabel?: string }>> = {
  ADMIN: [
    { href: "/dashboard", label: "Gösterge Paneli", shortLabel: "Panel", icon: "fa-solid fa-chart-line" },
    { href: "/admin/package-trainers", label: "Paketler ve Atamalar", shortLabel: "Paketler", icon: "fa-solid fa-boxes-stacked" },
    { href: "/admin/invites", label: "Davetler", shortLabel: "Davet", icon: "fa-solid fa-envelope-open-text" },
    { href: "/admin/payments", label: "Ödeme Onayları", shortLabel: "Ödemeler", icon: "fa-solid fa-credit-card" },
    { href: "/admin/risk", label: "Risk Yönetimi", shortLabel: "Risk", icon: "fa-solid fa-shield-heart" },
    { href: "/admin/applications", label: "Başvurular", shortLabel: "Başvurular", icon: "fa-solid fa-file-signature" },
    { href: "/admin/settings", label: "Klinik Ayarları", shortLabel: "Ayarlar", icon: "fa-solid fa-gear" },
  ],
  TRAINER: [
    { href: "/trainer/today", label: "Bugün", icon: "fa-solid fa-calendar-day" },
    { href: "/trainer/bookings", label: "Takvim", icon: "fa-solid fa-calendar-week" },
    { href: "/trainer/members", label: "Danışanlarım", icon: "fa-solid fa-users-viewfinder" },
    { href: "/trainer/risk", label: "Risk İzleme", icon: "fa-solid fa-heart-pulse" },
  ],
  MEMBER: [],
};

function toSalonLabel(slug?: string) {
  if (!slug) return "Salon";

  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("-");
}

function roleLabel(role: Role) {
  if (role === "ADMIN") return "Yönetici";
  if (role === "TRAINER") return "Eğitmen";
  return "Üye";
}

function roleIcon(role: Role) {
  if (role === "ADMIN") return <ShieldCheck className="h-4 w-4" />;
  if (role === "TRAINER") return <Stethoscope className="h-4 w-4" />;
  return <UserRound className="h-4 w-4" />;
}

export function AppHeader() {
  const pathname = usePathname();
  const { user, refresh } = useAuthSession();
  const role = user?.role;
  const isAdmin = role === "ADMIN";
  const navItems = useMemo(() => (role ? navByRole[role] ?? [] : []), [role]);

  async function logout() {
    try {
      await webAuthRequest("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore: local auth snapshot refresh below is the source of truth
    } finally {
      await refresh();
      window.location.href = "/login";
    }
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-sky-200/60 bg-gradient-to-r from-white/95 via-sky-50/85 to-emerald-50/85 shadow-[0_10px_28px_rgba(14,165,233,0.08)] backdrop-blur-md">
      <div className="mx-auto flex h-[72px] w-full max-w-[1280px] items-center justify-between gap-3 px-3 md:px-5">
        <Link href={role === "ADMIN" ? "/dashboard" : role === "TRAINER" ? "/trainer/today" : "/login"}>
          <ClinervaLogo compact={isAdmin} className="shrink-0" />
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1.5 xl:flex">
          {navItems.map((item) => (
            <Button
              key={item.href}
              asChild
              variant={pathname?.startsWith(item.href) ? "default" : "ghost"}
              size="sm"
              className="interactive min-w-0 px-2.5"
            >
              <Link href={item.href} className="inline-flex min-w-0 items-center gap-2">
                <AppIcon icon={item.icon} className="fa-soft" />
                <span className="truncate">{isAdmin ? item.shortLabel || item.label : item.label}</span>
              </Link>
            </Button>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {role ? (
            <Badge variant="secondary" className="max-w-[210px] bg-gradient-to-r from-sky-100 to-emerald-100 text-slate-800">
              <span className="mr-2 shrink-0">{roleIcon(role)}</span>
              <span className="truncate">
                {isAdmin ? `${toSalonLabel(user?.tenantSlug)} • ${roleLabel(role)}` : `${toSalonLabel(user?.tenantSlug)}'da ${roleLabel(role)}`}
              </span>
            </Badge>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">Giriş Yap</Link>
            </Button>
          )}

          {role ? (
            <Button size="sm" variant="outline" onClick={logout} className="px-3">
              <span className="hidden md:inline">Çıkış Yap</span>
              <span className="md:hidden">Çıkış</span>
            </Button>
          ) : null}
        </div>
      </div>

      {role && navItems.length > 0 ? (
        <div className="border-t border-white/50 xl:hidden">
          <nav className="mx-auto flex w-full max-w-[1280px] gap-2 overflow-x-auto px-3 py-3 md:px-5">
            {navItems.map((item) => {
              const active = pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-sky-400 bg-sky-500 text-white shadow-[0_10px_24px_rgba(14,165,233,0.22)]"
                      : "border-sky-200/80 bg-white/85 text-slate-700"
                  )}
                >
                  <AppIcon icon={item.icon} />
                  <span>{item.shortLabel || item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
