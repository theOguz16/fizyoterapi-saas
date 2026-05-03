import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.01em] transition-all", {
  variants: {
    variant: {
      default: "border-transparent bg-gradient-to-r from-sky-500 to-emerald-500 text-white",
      secondary: "border-sky-200 bg-gradient-to-r from-sky-50 to-emerald-50 text-slate-700",
      outline: "border-slate-300 bg-white text-foreground",
      success: "border-transparent bg-emerald-600 text-white",
      warning: "border-transparent bg-amber-500 text-white",
      danger: "border-transparent bg-red-600 text-white",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
