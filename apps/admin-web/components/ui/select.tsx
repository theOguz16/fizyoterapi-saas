import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-[var(--ui-radius-sm)] border border-sky-200/70 bg-white/95 px-3 py-2 text-sm shadow-[var(--ui-shadow-soft)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70 focus-visible:border-emerald-300",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = "Select";

export { Select };
