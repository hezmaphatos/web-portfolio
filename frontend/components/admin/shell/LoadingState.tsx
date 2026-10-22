import { Skeleton } from "@/components/admin/ui/skeleton";
import { cn } from "@/lib/utils";

type LoadingStateProps = {
  /** "table": header + rows; "list": plain rows; "cards": grid of tiles; "form": label/field pairs. */
  variant?: "table" | "list" | "cards" | "form";
  rows?: number;
  /** Announced to screen readers. */
  label?: string;
  className?: string;
};

export function LoadingState({
  variant = "table",
  rows = 5,
  label = "Loading…",
  className,
}: LoadingStateProps) {
  return (
    <div role="status" aria-live="polite" className={cn("w-full", className)}>
      <span className="sr-only">{label}</span>
      {variant === "table" && (
        <div aria-hidden="true" className="overflow-hidden rounded-lg border">
          <div className="bg-muted/50 flex gap-4 border-b px-4 py-3">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/6" />
            <Skeleton className="h-4 w-1/6" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
              <Skeleton className="size-8 shrink-0 rounded-md" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/6" />
              <Skeleton className="ml-auto h-6 w-16" />
            </div>
          ))}
        </div>
      )}
      {variant === "list" && (
        <div aria-hidden="true" className="space-y-2">
          {Array.from({ length: rows }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      )}
      {variant === "cards" && (
        <div aria-hidden="true" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: rows }, (_, index) => (
            <Skeleton key={index} className="aspect-square w-full rounded-lg" />
          ))}
        </div>
      )}
      {variant === "form" && (
        <div aria-hidden="true" className="max-w-xl space-y-5">
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
