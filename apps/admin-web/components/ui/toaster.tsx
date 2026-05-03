"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      richColors
      position="top-right"
      toastOptions={{
        style: {
          borderRadius: "12px",
          border: "1px solid hsl(var(--border))",
          background: "hsl(var(--card))",
          color: "hsl(var(--card-foreground))",
        },
      }}
    />
  );
}
