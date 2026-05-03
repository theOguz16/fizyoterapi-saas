import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--ui-radius-sm)] text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-gradient-to-r from-sky-500 to-emerald-500 text-white shadow-[0_10px_24px_rgba(14,165,233,0.24)] hover:-translate-y-[1px] hover:from-sky-600 hover:to-emerald-600 hover:shadow-[0_14px_28px_rgba(16,185,129,0.26)]",
        secondary:
          "border border-emerald-200 bg-gradient-to-r from-emerald-50 to-sky-50 text-slate-800 hover:-translate-y-[1px] hover:bg-[var(--ui-state-hover)]",
        outline:
          "border border-sky-200/70 bg-white/90 text-slate-700 shadow-[0_6px_16px_rgba(148,163,184,0.08)] hover:-translate-y-[1px] hover:border-emerald-300 hover:bg-[var(--ui-state-hover)]",
        ghost: "text-slate-700 hover:bg-[var(--ui-state-hover)] hover:text-slate-900",
        destructive: "bg-destructive text-destructive-foreground shadow-[0_10px_24px_rgba(239,68,68,0.22)] hover:-translate-y-[1px] hover:bg-destructive/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
