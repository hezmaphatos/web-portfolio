"use client";

import { Lock } from "lucide-react";
import { useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { useUnlockReveal } from "./arena/useUnlockReveal";
import { useBossLock } from "./useBossLock";

type Props = {
  href: string;
  projectId: number;
  bossEnabled: boolean;
  /** The rendered icon (an element, so a Server Component can hand it over). */
  icon: ReactNode;
  children: string;
  className?: string;
};

/**
 * The client half of <LockedLink> (use that one): reads the boss lock from the save cookie and
 * plays the unlock sequence. Both faces share one grid cell, so locking/unlocking never changes
 * the button's size. Without JS the <noscript> rule in the site layout shows the real link.
 */
export function LockedLinkView({ href, projectId, bossEnabled, icon, children, className }: Props) {
  const lock = useBossLock(projectId, bossEnabled);
  const { locked } = lock;
  // Unlock sequence (spec §6.4 step 5): the lock pops open and the live button wipes in.
  const rootRef = useRef<HTMLSpanElement>(null);
  useUnlockReveal(rootRef, lock, projectId, "links");

  const link = (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("hk-btn text-base", className)}
      tabIndex={locked ? -1 : undefined}
    >
      {icon}
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );

  if (!bossEnabled) return link;

  return (
    <span
      ref={rootRef}
      className="inline-grid"
      data-locked-link
      data-locked={locked ? "true" : "false"}
    >
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
