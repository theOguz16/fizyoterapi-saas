"use client";

import { useEffect } from "react";
import { AlertTriangle, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmText: string;
  cancelText?: string;
  loading?: boolean;
  variant?: "default" | "destructive";
  icon?: LucideIcon;
  note?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText,
  cancelText = "Vazgeç",
  loading = false,
  variant = "default",
  icon: Icon = AlertTriangle,
  note,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [loading, onCancel, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.18),transparent_32%),linear-gradient(180deg,rgba(2,6,23,0.82),rgba(15,23,42,0.92))] p-4 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-lg overflow-hidden rounded-[calc(var(--ui-radius-lg)+4px)] border border-white/20 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] shadow-[0_36px_120px_rgba(2,6,23,0.42)]"
      >
        <div className="border-b border-slate-200/80 bg-[linear-gradient(135deg,rgba(14,165,233,0.08),rgba(16,185,129,0.08))] px-5 py-4">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]",
                variant === "destructive"
                  ? "border-rose-200 bg-[linear-gradient(135deg,rgba(254,226,226,0.95),rgba(255,241,242,0.98))] text-rose-600"
                  : "border-sky-200 bg-[linear-gradient(135deg,rgba(224,242,254,0.98),rgba(236,253,245,0.95))] text-sky-700"
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "mb-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
                  variant === "destructive"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-sky-200 bg-sky-50 text-sky-700"
                )}
              >
                {variant === "destructive" ? "Kritik İşlem" : "İşlem Onayı"}
              </div>
              <h2 id="confirm-dialog-title" className="text-xl font-semibold tracking-tight text-slate-950">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">{description}</p>
            </div>
          </div>
        </div>

        <div className="px-5 py-5">
          {note ? (
            <div className="rounded-[var(--ui-radius-md)] border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm leading-6 text-slate-600">
              {note}
            </div>
          ) : null}

          <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", note ? "mt-5" : "")}>
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading} className="min-w-[120px]">
              {cancelText}
            </Button>
            <Button
              type="button"
              variant={variant === "destructive" ? "destructive" : "default"}
              onClick={onConfirm}
              disabled={loading}
              className="min-w-[160px]"
            >
              {loading ? "İşleniyor..." : confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
