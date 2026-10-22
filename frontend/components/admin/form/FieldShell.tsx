import type { ReactNode } from "react";

import { Label } from "@/components/admin/ui/label";
import { cn } from "@/lib/utils";

export function describedBy(id: string, hasDescription: boolean, hasError: boolean) {
  const ids = [hasDescription && `${id}-description`, hasError && `${id}-error`].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

export function FieldError({ id, message }: { id?: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p id={id} className="text-destructive text-xs font-medium" role="alert">
      {message}
    </p>
  );
}

type FieldShellProps = {
  /** id of the input the label points at. */
  id: string;
  label: string;
  description?: ReactNode;
  error?: string;
  required?: boolean;
  /** Right side of the label row (counter, buttons). */
  aside?: ReactNode;
  /** The RHF path; rendered as `data-field` so <FormErrorSummary> can jump to it. */
  field?: string;
  className?: string;
  children: ReactNode;
};

/** Label + control + help text + error, with matching ids for aria-describedby. */
export function FieldShell({
  id,
  label,
  description,
  error,
  required,
  aside,
  field,
  className,
  children,
}: FieldShellProps) {
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-1.5", className)}
      data-field={field}
      data-invalid={error ? "" : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>
          {label}
          {required ? (
            <span className="text-destructive" aria-hidden>
              *
            </span>
          ) : null}
        </Label>
        {aside}
      </div>
      {children}
      {description ? (
        <p id={`${id}-description`} className="text-muted-foreground text-xs">
          {description}
        </p>
      ) : null}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}
