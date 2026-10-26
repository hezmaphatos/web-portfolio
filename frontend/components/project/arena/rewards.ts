"use client";

import { useGameStore } from "@/lib/store";
import type { BossTier } from "@/lib/types";

/*
 * What a boss defeat changes outside the Arena (spec §6.4 steps 5–6, §5 badges):
 * - claimDefeat(): `defeated` goes into the save cookie at once, the defeat is counted on the API
 *   once, and the First Blood / Final Boss badges unlock (their toasts come in phase 7).
 * - scheduleReveal() / revealDelay(): the moment the unlock sequence starts. The cookie is written
 *   at the killing blow (so leaving right away still keeps the win), but the chips and link locks
 *   wait for the Arena's hit-stop + dissolve + banner before they flip open.
 * Collector ("defeat every featured boss") is not decided here: the Stage only knows its own
 * project, not which bosses are featured — phase 7 evaluates it from the whole `defeated` list.
 */

export type DefeatTarget = Readonly<{ id: number; slug: string; tier: BossTier }>;

/** Slugs already counted in this page session (belt and braces on top of defeat()'s own check). */
const counted = new Set<string>();

/**
 * POST /public/projects/{slug}/defeat (§9) — fire-and-forget: `keepalive` lets it finish if the
 * visitor leaves at once, and every error (offline, throttled 429, 404/422) is ignored: the win
 * is in the cookie already, the counter is only an admin statistic.
 */
function countDefeat(slug: string): void {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base || counted.has(slug)) return;
  counted.add(slug);
  const url = `${base.replace(/\/+$/, "")}/public/projects/${encodeURIComponent(slug)}/defeat`;
  try {
    void fetch(url, {
      method: "POST",
      headers: { Accept: "application/json" },
      keepalive: true,
    }).catch(() => {});
  } catch {
    // fetch itself can throw synchronously (e.g. a blocked keepalive): still nothing to do.
  }
}

function apply(target: DefeatTarget): boolean {
  const game = useGameStore.getState();
  const first = game.defeat(target.id); // true only the first time this save beats this boss
  if (first) countDefeat(target.slug);
  game.unlockBadge("first-blood"); // §5: "Mengalahkan boss pertama" — any defeat qualifies
  if (target.tier === "final") game.unlockBadge("final-boss");
  return first;
}

/**
 * Records a defeat (killing blow or Skip battle). Returns true when this boss was beaten for the
 * first time, false for a rematch, null when the save cookie had not been read yet — then it is
 * applied right after hydration (a write before it would be overwritten by the cookie).
 */
export function claimDefeat(target: DefeatTarget): boolean | null {
  if (useGameStore.getState().hydrated) return apply(target);
  const unsubscribe = useGameStore.subscribe((state) => {
    if (!state.hydrated) return;
    unsubscribe();
    apply(target);
  });
  return null;
}

/** When (performance.now() ms) each project's unlock sequence starts, set by its Arena. */
const revealAt = new Map<number, number>();

/** The Arena announces that the unlock sequence of `projectId` starts at `at` (performance.now). */
export function scheduleReveal(projectId: number, at: number): void {
  revealAt.set(projectId, at);
}

/** Milliseconds until `projectId`'s unlock sequence starts (0 = now, or nothing scheduled). */
export function revealDelay(projectId: number): number {
  const at = revealAt.get(projectId);
  return at === undefined ? 0 : Math.max(0, at - performance.now());
}
