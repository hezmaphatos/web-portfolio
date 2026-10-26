"use client";

import { completeStageHint } from "@/components/game/useStageHint";
import { rememberCardRect } from "@/components/project/transition";

/**
 * Delegated click handler for a container of project cards (Scene A track, Scene B grid).
 * A plain left click on a card's link to its Project Stage stores the card cover's rect for the
 * shared-element transition (components/project/transition.ts) — before Next's <Link> navigates,
 * because a native listener on the container runs before React's root listener — and counts as
 * "the visitor opened a level" for the Projects stage hint. Modified clicks (new tab) skip both.
 */
export function handOffCardClick(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = event.target instanceof Element ? event.target : null;
  const link = target?.closest<HTMLAnchorElement>('a[href^="/projects/"]');
  const card = link?.closest<HTMLElement>("[data-project-id]");
  if (!card) return;
  rememberCardRect(Number(card.dataset.projectId), card.querySelector("[data-card-cover]"));
  completeStageHint("projects");
}
