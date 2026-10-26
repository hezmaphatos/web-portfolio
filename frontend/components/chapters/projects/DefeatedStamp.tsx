"use client";

import { useBossLock } from "@/components/project/useBossLock";
import { cn } from "@/lib/utils";

type Props = { projectId: number; bossEnabled: boolean; size?: "sm" | "md"; className?: string };

/**
 * The DEFEATED stamp on a card cover (spec §6.1/§6.2), shown once the save cookie says this boss
 * was beaten. Absolutely positioned over the cover (which is `relative`), so it appearing after
 * hydration never moves anything. Never rendered on the server: the HTML is always "locked".
 */
export function DefeatedStamp({ projectId, bossEnabled, size = "md", className }: Props) {
  const { defeated } = useBossLock(projectId, bossEnabled);
  if (!defeated) return null;

  return (
    <span className={cn("hk-defeated hk-pixel", size === "sm" && "is-sm", className)}>
      Defeated<span className="sr-only"> boss</span>
    </span>
  );
}
