"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import { useGameConfig } from "@/components/game/GameConfig";
import { visibleTechCount } from "@/lib/battle";
import type { SkillRef } from "@/lib/types";
import { cn } from "@/lib/utils";

import { useUnlockReveal } from "./arena/useUnlockReveal";
import { useBossLock } from "./useBossLock";

type Props = {
  skills: SkillRef[];
  projectId: number;
  /** Projects without a boss show every chip. */
  bossEnabled: boolean;
  /** Extra classes for each chip (e.g. on dark sections). */
  chipClassName?: string;
  className?: string;
  /**
   * Open chips become links (e.g. to the Skill Tree). Plain data, not a render function:
   * Server Components pass it, and functions cannot cross into a Client Component.
   */
  link?: { href: string; className?: string; srSuffix?: string };
};

/**
 * The single component that decides which tech chips are open and which are locked, used by the
 * showcase cards, the grid and the Project Stage (spec §11). The first
 * visibleTechCount(n, tech_visible_percent) chips (reveal order) are always open; the rest show
 * "???" until the boss is defeated.
 *
 * A lockable chip stacks both faces in one grid cell (open name + "???"), so its box is the same
 * size locked and unlocked — unlocking after hydration never shifts the layout. Without JS the
 * <noscript> rule in the site layout shows every name (the lock is a game, not a secret).
 */
export function TechChips({
  skills,
  projectId,
  bossEnabled,
  chipClassName,
  className,
  link,
}: Props) {
  const { techVisiblePercent } = useGameConfig();
  const lock = useBossLock(projectId, bossEnabled);
  const { locked } = lock;
  // Unlock sequence (spec §6.4 step 5): the "???" chips rotate open, staggered, after a live defeat.
  const listRef = useRef<HTMLUListElement>(null);
  useUnlockReveal(listRef, lock, projectId, "chips");
  if (skills.length === 0) return null;

  const alwaysOpen = bossEnabled
    ? visibleTechCount(skills.length, techVisiblePercent)
    : skills.length;
  const lockedCount = skills.length - alwaysOpen;

  const open = (skill: SkillRef) =>
    link ? (
      <Link href={link.href} className={cn("hk-chip", chipClassName, link.className)}>
        {skill.name}
        {link.srSuffix ? <span className="sr-only"> {link.srSuffix}</span> : null}
      </Link>
    ) : (
      <span className={cn("hk-chip", chipClassName)}>{skill.name}</span>
    );

  return (
    <ul
      ref={listRef}
      className={cn("flex flex-wrap gap-2", className)}
      aria-label="Tech stack"
      data-tech-chips
      data-locked={locked && lockedCount > 0 ? "true" : "false"}
    >
      {skills.map((skill, index) =>
        index < alwaysOpen ? (
          <li key={skill.id} className="contents">
            {open(skill)}
          </li>
        ) : (
          <li key={skill.id} className="grid" data-lockable-chip>
            <span data-unlocked-ui aria-hidden={locked || undefined} className="[grid-area:1/1]">
              {open(skill)}
            </span>
            <span
              data-lock-ui
              aria-hidden={!locked || undefined}
              className={cn(
                "hk-chip hk-mono justify-center opacity-85 [grid-area:1/1]",
                chipClassName,
              )}
            >
              <Lock aria-hidden="true" className="size-3.5" />
              <span aria-hidden="true">???</span>
              <span className="sr-only">Locked: defeat the boss to reveal this skill</span>
            </span>
          </li>
        ),
      )}
    </ul>
  );
}
