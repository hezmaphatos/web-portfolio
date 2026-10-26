"use client";

import { Check, Lock } from "lucide-react";

import { cn } from "@/lib/utils";

import { useBossLock } from "../useBossLock";

/**
 * The visible "Defeat the boss to unlock" line next to the locked Open site / Repo buttons
 * (spec §6.3 item 1). Both texts share one grid cell, so the line keeps its size when the boss
 * falls (no layout shift); the [data-lock-ui] / [data-unlocked-ui] faces follow the same rules
 * as <LockedLink> (and the no-JS style shows the unlocked face). aria-hidden: the buttons
 * already tell screen readers they are locked.
 */
export function LockCaption({
  projectId,
  bossEnabled,
  className,
}: {
  projectId: number;
  bossEnabled: boolean;
  className?: string;
}) {
  const { locked } = useBossLock(projectId, bossEnabled);
  if (!bossEnabled) return null;

  return (
    <span
      aria-hidden="true"
      className={cn("hk-pixel inline-grid text-[0.6875rem] leading-tight", className)}
      data-lock-caption
    >
      <span
        data-lock-ui
        aria-hidden={!locked || undefined}
        className="inline-flex items-center gap-1.5 [grid-area:1/1]"
      >
        <Lock className="size-3.5 shrink-0" strokeWidth={2.5} />
        Defeat the boss to unlock
      </span>
      <span
        data-unlocked-ui
        aria-hidden={locked || undefined}
        className="inline-flex items-center gap-1.5 [grid-area:1/1]"
      >
        <Check className="size-3.5 shrink-0" strokeWidth={3} />
        Unlocked · links open
      </span>
    </span>
  );
}
