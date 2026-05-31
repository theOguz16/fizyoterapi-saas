import * as React from "react";
import { cn } from "@/lib/utils";

type FizyoFlowLogoProps = {
  className?: string;
  compact?: boolean;
};

export function FizyoFlowLogo({ className, compact = false }: FizyoFlowLogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 48 48" aria-hidden className="h-10 w-10 shrink-0">
        <rect x="2.5" y="2.5" width="43" height="43" rx="14" fill="#F7FAF7" />
        <rect x="2.5" y="2.5" width="43" height="43" rx="14" stroke="#DCEADC" strokeWidth="1.2" />
        <rect x="12" y="12" width="8" height="8" rx="2.6" fill="#EAF4EC" stroke="#CFE3D2" strokeWidth="1.6" />
        <rect x="28" y="12" width="8" height="8" rx="2.6" fill="#EAF4EC" stroke="#CFE3D2" strokeWidth="1.6" />
        <rect x="12" y="28" width="8" height="8" rx="2.6" fill="#EAF4EC" stroke="#CFE3D2" strokeWidth="1.6" />
        <rect x="28" y="28" width="8" height="8" rx="2.6" fill="#6F9274" />
        <path d="M15.5 28C15.5 21.5 21 18 25 22.5C29 27 32.5 21.5 32.5 16.5" stroke="#6F9274" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15.5 20C18.5 23.5 21.5 25 25 25C28 25 31 23.5 34 20" stroke="#5DADE2" strokeWidth="2.1" strokeLinecap="round" />
        <circle cx="25" cy="22.5" r="2.2" fill="#F8B84E" />
        <path d="M30.5 32L32.5 34L36.5 29.5" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!compact ? (
        <div className="grid leading-tight">
          <span className="brand-gradient-text text-lg font-semibold tracking-tight">
            Fizyoflow
          </span>
          <span className="text-[11px] text-slate-500">Klinik Yönetim Platformu</span>
        </div>
      ) : null}
    </div>
  );
}
