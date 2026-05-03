import * as React from "react";
import { cn } from "@/lib/utils";

export function AppShell({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <main className={cn("app-shell grid gap-4 md:gap-6", className)} {...props} />;
}
