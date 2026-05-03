import * as React from "react";
import { cn } from "@/lib/utils";

type ClinervaLogoProps = {
  className?: string;
  compact?: boolean;
};

export function ClinervaLogo({ className, compact = false }: ClinervaLogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 48 48" aria-hidden className="h-10 w-10 shrink-0">
        <defs>
          <linearGradient id="clinerva-ring" x1="0" x2="1" y1="1" y2="0">
            <stop offset="0%" stopColor="#0EA5E9" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="17.5" fill="white" stroke="url(#clinerva-ring)" strokeWidth="4" />
        <text
          x="24"
          y="30"
          textAnchor="middle"
          fontSize="18"
          fontWeight="800"
          fill="#0369A1"
          fontFamily="Poppins, sans-serif"
        >
          C
        </text>
      </svg>
      {!compact ? (
        <div className="grid leading-tight">
          <span className="brand-gradient-text text-lg font-semibold tracking-tight">
            LINERVA
          </span>
          <span className="text-[11px] text-slate-500">Klinik Yönetim Platformu</span>
        </div>
      ) : null}
    </div>
  );
}
