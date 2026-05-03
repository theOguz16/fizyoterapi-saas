import * as React from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  iconClassName?: string;
};

function resolveTitleIcon(title: string) {
  const normalized = title.toLocaleLowerCase("tr-TR");
  if (normalized.includes("dashboard") || normalized.includes("gösterge")) return "fa-solid fa-chart-line";
  if (normalized.includes("takvim") || normalized.includes("randevu")) return "fa-solid fa-calendar-week";
  if (normalized.includes("risk")) return "fa-solid fa-shield-heart";
  if (normalized.includes("ödeme") || normalized.includes("kazanç")) return "fa-solid fa-credit-card";
  if (normalized.includes("paket")) return "fa-solid fa-boxes-stacked";
  if (normalized.includes("referans")) return "fa-solid fa-user-group";
  if (normalized.includes("katılım")) return "fa-solid fa-clipboard-check";
  if (normalized.includes("qr")) return "fa-solid fa-qrcode";
  if (normalized.includes("gelişim") || normalized.includes("ölçüm")) return "fa-solid fa-chart-column";
  if (normalized.includes("ayar")) return "fa-solid fa-gear";
  if (normalized.includes("davet")) return "fa-solid fa-envelope-open-text";
  if (normalized.includes("danışan")) return "fa-solid fa-users-viewfinder";
  return "fa-solid fa-circle-info";
}

export function PageHeader({ title, description, actions, className, iconClassName }: PageHeaderProps) {
  const icon = iconClassName || resolveTitleIcon(title);
  return (
    <Card className={cn("surface-card", className)}>
      <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div className="grid gap-1">
          <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.9rem] [text-shadow:0_1px_0_rgba(255,255,255,0.65)]">
            <span className="fa-chip">
              <AppIcon icon={icon} />
            </span>
            {title}
          </h1>
          {description ? <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </CardContent>
    </Card>
  );
}
