import { type ReactNode } from "react";
import { renderLegacyIconNode } from "@/components/ui/app-icon";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  const resolvedIcon = renderLegacyIconNode(icon);
  return (
    <div className={cn("empty-state", className)}>
      {resolvedIcon ? <div className="empty-state-icon">{resolvedIcon}</div> : null}
      <div className="grid gap-1">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {description ? <p className="max-w-md text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
