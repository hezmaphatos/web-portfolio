/**
 * Tiny loading / empty / error blocks used inside the CRUD kit (tables, pickers, fields).
 * Kept here, not in components/admin/shell, so the kit has no dependency on the page shell.
 */
import type { ReactNode } from "react";
import { AlertTriangleIcon, InboxIcon, Loader2Icon, RotateCwIcon } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import { errorMessage } from "@/lib/admin/api";
import { cn } from "@/lib/utils";

export function KitSpinner({
  className,
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2", className)}>
      <Loader2Icon className="size-4 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function KitEmpty({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex flex-col items-center justify-center gap-2 px-4 py-10 text-center",
        className,
      )}
    >
      <InboxIcon className="size-8 opacity-60" aria-hidden />
      <p className="text-foreground font-medium">{title}</p>
      {description ? <p className="max-w-sm text-sm">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function KitError({
  error,
  onRetry,
  title = "Could not load data",
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-4 py-10 text-center",
        className,
      )}
    >
      <AlertTriangleIcon className="text-destructive size-8" aria-hidden />
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground max-w-md text-sm">{errorMessage(error)}</p>
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry} className="mt-2">
          <RotateCwIcon aria-hidden />
          Retry
        </Button>
      ) : null}
    </div>
  );
}
