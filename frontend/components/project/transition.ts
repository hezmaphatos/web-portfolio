"use client";

/**
 * Shared-element hand-off between a project card (Scene A cartridge / grid card) and the
 * Project Stage it opens (spec §6.1 "shared-element transition dari kartu ke halaman detail").
 *
 * The card calls rememberCardRect() on click (before navigation); the Stage — modal or page —
 * calls takeCardRect() once on mount and animates its [data-stage-cover] from that rect
 * (GSAP Flip-style FLIP: from rect → to rect, transform only). Single-use and short-lived, so a
 * later direct visit never animates from a stale card.
 */

type CardRect = { projectId: number; rect: DOMRect; at: number };

let last: CardRect | null = null;
const MAX_AGE_MS = 1500;

export function rememberCardRect(projectId: number, element: Element | null): void {
  if (!element) return;
  last = { projectId, rect: element.getBoundingClientRect(), at: performance.now() };
}

export function takeCardRect(projectId: number): DOMRect | null {
  const entry = last;
  last = null;
  if (!entry || entry.projectId !== projectId) return null;
  if (performance.now() - entry.at > MAX_AGE_MS) return null;
  return entry.rect;
}
