import * as React from "react";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
  testID?: string;
};

export function FormField({ label, htmlFor, hint, error, required, className, children, testID }: FormFieldProps) {
  const hasMeta = Boolean(error || hint);

  return (
    <div className={cn("ui-form-field grid gap-1.5", className)} data-testid={testID}>
      {label ? (
        <label htmlFor={htmlFor} className="inline-flex items-center gap-1 text-sm font-medium text-slate-700">
          {label}
          {required ? <span className="ml-1 text-rose-600">*</span> : null}
        </label>
      ) : null}
      {children}
      <div className="ui-field-meta" aria-live={error ? "polite" : undefined}>
        {error ? <p className="ui-field-error">{error}</p> : hint ? <p className="ui-field-hint">{hint}</p> : hasMeta ? null : <span aria-hidden="true" />}
      </div>
    </div>
  );
}
