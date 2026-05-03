import * as React from "react";
import { cn } from "@/lib/utils";

type MobileActionBarProps = React.HTMLAttributes<HTMLDivElement>;

export function MobileActionBar({ className, ...props }: MobileActionBarProps) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-sky-200/70 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur md:hidden",
        className
      )}
      {...props}
    />
  );
}
