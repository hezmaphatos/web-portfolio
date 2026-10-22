"use client";

import { CircleAlert, RefreshCw } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import { errorMessage } from "@/lib/admin/api";
import { cn } from "@/lib/utils";

type ErrorStateProps = {
  title?: string;
  /** Explicit text; otherwise derived from `error` (ApiError message), then a generic line. */
  message?: string;
  error?: unknown;
  /** Shows a "Try again" button, e.g. `() => query.refetch()`. */
  onRetry?: () => void;
  /** Spins the retry icon and disables the button, e.g. `query.isFetching`. */
  retrying?: boolean;
  className?: string;
};

export function ErrorState({
  title = "Something went wrong",
  message,
  error,
  onRetry,
  retrying = false,
  className,
}: ErrorStateProps) {
  const text = message ?? (error !== undefined ? errorMessage(error) : "The request failed.");

  return (
    <div
      role="alert"
      className={cn(
        "border-destructive/30 bg-destructive/5 flex flex-col items-center gap-3 rounded-lg border px-6 py-10 text-center",
        className,
      )}
    >
      <CircleAlert className="text-destructive size-6" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mx-auto max-w-md text-sm">{text}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
          <RefreshCw className={cn(retrying && "animate-spin")} aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  );
}
