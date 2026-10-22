import { Badge } from "@/components/admin/ui/badge";
import type { AwardPlacement } from "@/lib/types";
import { cn } from "@/lib/utils";

export const PLACEMENT_LABEL: Record<AwardPlacement, string> = {
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
  finalist: "Finalist",
  participant: "Participant",
};

/** Badge and dot colours per placement (text/background pairs pass WCAG AA). */
const STYLE: Record<AwardPlacement, { badge: string; dot: string }> = {
  gold: { badge: "border-amber-300 bg-amber-50 text-amber-900", dot: "bg-amber-400" },
  silver: { badge: "border-slate-300 bg-slate-100 text-slate-800", dot: "bg-slate-400" },
  bronze: { badge: "border-orange-300 bg-orange-50 text-orange-900", dot: "bg-orange-700" },
  finalist: { badge: "border-sky-300 bg-sky-50 text-sky-900", dot: "bg-sky-500" },
  participant: { badge: "border-zinc-300 bg-zinc-50 text-zinc-700", dot: "bg-zinc-400" },
};

export function PlacementBadge({
  placement,
  className,
}: {
  placement: AwardPlacement;
  className?: string;
}) {
  const style = STYLE[placement];
  return (
    <Badge variant="outline" className={cn(style.badge, className)}>
      <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden />
      {PLACEMENT_LABEL[placement]}
    </Badge>
  );
}
