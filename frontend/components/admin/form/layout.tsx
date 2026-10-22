"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useFormState, type FieldErrors, type FieldValues } from "react-hook-form";
import { AlertCircleIcon, CheckIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { focusField } from "@/components/admin/form/focus-field";
import type { AnyControl } from "@/components/admin/form/types";
import { cn } from "@/lib/utils";

/* ── Section card ─────────────────────────────────────────────────────── */

type FormSectionProps = {
  title: string;
  description?: ReactNode;
  /** Grid columns on ≥ sm screens. Default 1; use `className="sm:col-span-2"` on wide fields. */
  columns?: 1 | 2 | 3;
  /** Right side of the header (e.g. a preset button). */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

const GRID: Record<NonNullable<FormSectionProps["columns"]>, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
};

export function FormSection({
  title,
  description,
  columns = 1,
  action,
  className,
  children,
}: FormSectionProps) {
  return (
    <Card className={className}>
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>
              <h2>{title}</h2>
            </CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className={cn("grid gap-4", GRID[columns])}>{children}</CardContent>
    </Card>
  );
}

/* ── Error flattening ─────────────────────────────────────────────────── */

export type FlatError = { path: string; message: string };

/** `{ metrics: [ , { value: { message } } ] }` → `[{ path: "metrics.1.value", message }]`. */
export function flattenErrors(errors: FieldErrors | undefined, prefix = ""): FlatError[] {
  const out: FlatError[] = [];
  if (!errors || typeof errors !== "object") return out;

  const visit = (node: unknown, path: string) => {
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (typeof record.message === "string" && record.message) {
      out.push({ path, message: record.message });
    }
    for (const [key, child] of Object.entries(record)) {
      if (key === "ref" || key === "message" || key === "type" || key === "types") continue;
      if (key === "root") {
        visit(child, path);
        continue;
      }
      visit(child, path ? `${path}.${key}` : key);
    }
  };

  visit(errors, prefix);
  return out;
}

function humanPath(path: string, labels?: Record<string, string>): string {
  if (labels?.[path]) return labels[path];
  return path
    .split(".")
    .map((part, index) => {
      if (index === 0 && labels?.[part]) return labels[part];
      if (/^\d+$/.test(part)) return `#${Number(part) + 1}`;
      const text = part.replace(/_/g, " ");
      return text.charAt(0).toUpperCase() + text.slice(1);
    })
    .join(" › ");
}

type FormErrorSummaryProps<T extends FieldValues> = {
  control?: AnyControl<T>;
  /** Friendly names: `{ boss_hp: "Boss HP", "gallery": "Gallery" }`. */
  labels?: Record<string, string>;
  /** Called before focusing, e.g. to switch to the tab that holds the field. */
  onNavigate?: (path: string) => void;
  className?: string;
};

/**
 * Lists every current error (client or server) as links to the field. Use it on long or tabbed
 * forms, where an error can sit on a field that is not visible.
 */
export function FormErrorSummary<T extends FieldValues>({
  control,
  labels,
  onNavigate,
  className,
}: FormErrorSummaryProps<T>) {
  const { errors } = useFormState({ control });
  const list = flattenErrors(errors as FieldErrors);
  if (list.length === 0) return null;

  return (
    <div
      role="alert"
      className={cn(
        "border-destructive/30 bg-destructive/5 rounded-lg border px-4 py-3 text-sm",
        className,
      )}
    >
      <p className="text-destructive flex items-center gap-2 font-medium">
        <AlertCircleIcon className="size-4" aria-hidden />
        {list.length === 1 ? "1 field needs attention" : `${list.length} fields need attention`}
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {list.map((item) => (
          <li key={item.path}>
            <button
              type="button"
              className="hover:text-destructive focus-visible:ring-ring/50 rounded text-left underline-offset-2 outline-none hover:underline focus-visible:ring-2"
              onClick={() => {
                onNavigate?.(item.path);
                // Let a tab switch render first.
                requestAnimationFrame(() => focusField(item.path));
              }}
            >
              <span className="font-medium">{humanPath(item.path, labels)}:</span> {item.message}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Sticky action bar ────────────────────────────────────────────────── */

type FormActionsProps<T extends FieldValues> = {
  control?: AnyControl<T>;
  /** The save mutation's `isPending` (form `isSubmitting` is also honoured). */
  isPending?: boolean;
  submitLabel?: string;
  cancelHref?: string;
  onCancel?: () => void;
  cancelLabel?: string;
  /** Extra buttons on the left of Cancel (e.g. "Preview ↗"). */
  extra?: ReactNode;
  /** Disable Save while nothing changed (edit forms). Default false. */
  requireDirty?: boolean;
  className?: string;
};

/** Sticky Save / Cancel bar with an unsaved-changes indicator. Put it inside the <form>. */
export function FormActions<T extends FieldValues>({
  control,
  isPending = false,
  submitLabel = "Save",
  cancelHref,
  onCancel,
  cancelLabel = "Cancel",
  extra,
  requireDirty = false,
  className,
}: FormActionsProps<T>) {
  const { isDirty, isSubmitting, errors } = useFormState({ control });
  const busy = isPending || isSubmitting;
  const errorCount = flattenErrors(errors as FieldErrors).length;

  return (
    <div
      className={cn(
        "bg-background/95 supports-backdrop-filter:bg-background/80 sticky bottom-0 z-20 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-t-lg border border-b-0 px-4 py-3 shadow-[0_-4px_12px_-8px_rgb(0_0_0/0.2)] backdrop-blur",
        className,
      )}
    >
      <p className="flex items-center gap-2 text-sm" aria-live="polite">
        {errorCount > 0 ? (
          <span className="text-destructive flex items-center gap-1.5 font-medium">
            <AlertCircleIcon className="size-4" aria-hidden />
            {errorCount === 1 ? "1 error" : `${errorCount} errors`}
          </span>
        ) : null}
        {isDirty ? (
          <span className="flex items-center gap-1.5 font-medium text-amber-700">
            <span className="size-2 rounded-full bg-amber-500" aria-hidden />
            Unsaved changes
          </span>
        ) : (
          <span className="text-muted-foreground flex items-center gap-1.5">
            <CheckIcon className="size-4" aria-hidden />
            No unsaved changes
          </span>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {extra}
        {cancelHref ? (
          <Button asChild variant="outline">
            <Link href={cancelHref}>{cancelLabel}</Link>
          </Button>
        ) : onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
        ) : null}
        <Button type="submit" disabled={busy || (requireDirty && !isDirty)}>
          {busy ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
          {busy ? "Saving…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}
