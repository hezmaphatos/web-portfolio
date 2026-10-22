import { cn } from "@/lib/utils";
import type { SkillRef } from "@/lib/types";

type Props = {
  skills: SkillRef[];
  /**
   * How many chips (in reveal order) are open. `null` = all open.
   * Phase 3 always passes null (static site, no gating); the boss lock (spec §6.4) uses
   * visibleTechCount() from lib/battle once the save store exists (phase 6).
   */
  openCount?: number | null;
  /** Extra classes for each chip (e.g. on dark sections). */
  chipClassName?: string;
  className?: string;
  /** Render each open skill as something else (e.g. a link to the Skill Tree). */
  renderOpen?: (skill: SkillRef) => React.ReactNode;
};

/**
 * The single component that decides which tech chips are shown and which are locked, used by
 * the showcase cards, the grid and the Project Stage (spec §11). A locked chip has the exact
 * box of an open one ("???" + lock), so unlocking never shifts the layout.
 */
export function TechChips({
  skills,
  openCount = null,
  chipClassName,
  className,
  renderOpen,
}: Props) {
  if (skills.length === 0) return null;
  const open = openCount === null ? skills.length : Math.max(0, Math.min(openCount, skills.length));

  return (
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label="Tech stack">
      {skills.map((skill, index) =>
        index < open ? (
          <li key={skill.id} className="contents">
            {renderOpen ? (
              renderOpen(skill)
            ) : (
              <span className={cn("hk-chip", chipClassName)}>{skill.name}</span>
            )}
          </li>
        ) : (
          <li key={skill.id} className="contents">
            <span className={cn("hk-chip hk-mono opacity-80", chipClassName)}>
              <span aria-hidden="true">🔒 ???</span>
              <span className="sr-only">Locked: defeat the boss to reveal</span>
            </span>
          </li>
        ),
      )}
    </ul>
  );
}
