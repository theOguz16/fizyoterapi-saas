import { type ReactNode } from "react";
import { renderLegacyIconNode } from "@/components/ui/app-icon";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: "sky" | "emerald" | "slate" | "amber";
  hint?: ReactNode;
  className?: string;
};

export function MetricCard({ label, value, icon, tone = "sky", hint, className }: MetricCardProps) {
  const resolvedIcon = renderLegacyIconNode(icon);
  return (
    <article className={cn("metric-card interactive-scale", className)} data-tone={tone}>
      <div className="relative z-[1] flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="metric-caption">{label}</p>
          <p className="metric-value">{value}</p>
          {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
        </div>
        {resolvedIcon ? <div className="fa-chip shrink-0">{resolvedIcon}</div> : null}
      </div>
    </article>
  );
}
