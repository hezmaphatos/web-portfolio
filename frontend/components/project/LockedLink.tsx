"use client";

import { Lock, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { useBossLock } from "./useBossLock";

type Props = {
  href: string;
  projectId: number;
  bossEnabled: boolean;
  icon: LucideIcon;
  children: string;
  className?: string;
};

/**
 * An external project link (Open site / Repo) that stays locked until the boss is defeated
 * (spec §6.4). Both faces share one grid cell, so locking/unlocking never changes the button's
 * size. Without JS the <noscript> rule in the site layout shows the real link.
 */
export function LockedLink({
  href,
  projectId,
  bossEnabled,
  icon: Icon,
  children,
  className,
}: Props) {
  const { locked } = useBossLock(projectId, bossEnabled);

  const link = (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("hk-btn text-base", className)}
      tabIndex={locked ? -1 : undefined}
    >
      <Icon aria-hidden="true" className="size-4" />
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );

  if (!bossEnabled) return link;

  return (
    <span className="inline-grid" data-locked-link data-locked={locked ? "true" : "false"}>
      <span data-unlocked-ui aria-hidden={locked || undefined} className="grid [grid-area:1/1]">
        {link}
      </span>
      <span
        data-lock-ui
        aria-hidden={!locked || undefined}
        role="button"
        aria-disabled="true"
        tabIndex={locked ? 0 : -1}
        className={cn("hk-btn cursor-not-allowed text-base opacity-75 [grid-area:1/1]", className)}
      >
        <Lock aria-hidden="true" className="size-4" />
        {children}
        <span className="sr-only"> — locked: defeat the boss to unlock</span>
      </span>
    </span>
  );
}
