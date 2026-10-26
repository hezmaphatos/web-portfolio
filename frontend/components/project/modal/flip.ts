"use client";

import { takeCardRect } from "../transition";

/*
 * FLIP shared-element helpers for the Project Stage (spec §6.1: the cover grows out of the
 * clicked card). FLIP = First (the card's rect, recorded on click), Last (where the stage cover
 * is laid out now), Invert (a transform that puts the cover back over the card), Play (animate
 * that transform to identity). The layout never animates — only transform — so it stays at 60
 * fps and nothing around the cover reflows.
 */

/** Quart-out, the site's "lift" ease (same as the trophy dialog). */
export const EASE_OUT = [0.25, 1, 0.5, 1] as const;
export const EASE_IN = [0.5, 0, 0.75, 0] as const;
export const FLIP_SECONDS = 0.6;

type Box = { left: number; top: number; width: number; height: number };

export const usableBox = (box: Box | null | undefined): box is Box =>
  !!box && box.width > 0 && box.height > 0;

/** Some part of the box is inside the viewport (a FLIP to an off-screen spot looks broken). */
export function inViewport(box: Box): boolean {
  return (
    box.top < window.innerHeight &&
    box.top + box.height > 0 &&
    box.left < window.innerWidth &&
    box.left + box.width > 0
  );
}

let taken: { projectId: number; rect: DOMRect; at: number } | null = null;
const REUSE_MS = 2500;

/**
 * takeCardRect() is single-use, but the opening can run twice in quick succession: React's dev
 * Strict Mode mounts every effect twice, and the modal can be shown, hidden and shown again
 * while its route streams in (seen in dev, where nothing is prefetched). The rect taken first is
 * handed out again for a short while, so the opening that stays on screen still flies from the
 * card. A later opening (a Back/Forward re-show) needs a fresh card click.
 */
export function cardRectFor(projectId: number): DOMRect | null {
  const fresh = takeCardRect(projectId);
  const now = performance.now();
  if (fresh) {
    taken = { projectId, rect: fresh, at: now };
    return fresh;
  }
  if (taken && taken.projectId === projectId && now - taken.at < REUSE_MS) return taken.rect;
  return null;
}

/** A running piece of the hand-off. stop() leaves no inline style behind. */
export type Flight = { stop: () => void; finished: Promise<unknown> };

/** CSS easing string for WAAPI from a cubic-bezier tuple. */
export const cssEase = (ease: readonly number[]) => `cubic-bezier(${ease.join(",")})`;

/**
 * Animates `element` from `from` (viewport rect) to where it is laid out. Returns null when the
 * move would not read as a hand-off (no size, target off screen) — the caller then falls back
 * to a plain entrance.
 *
 * Native WAAPI on purpose: the panel's clip reveal runs with WAAPI too, and two WAAPI animations
 * created in the same frame start on the same frame. (A Motion/JS tween keeps its own clock: after
 * a long first render it jumps ahead, and the cover landed before the panel had opened.) A
 * finished or cancelled WAAPI animation also leaves no inline transform behind.
 */
export function flipFrom(
  element: HTMLElement,
  from: DOMRect,
  options: { duration?: number; ease?: readonly number[] } = {},
): Flight | null {
  const to = element.getBoundingClientRect();
  if (!usableBox(from) || !usableBox(to) || !inViewport(to)) return null;

  const x = from.left + from.width / 2 - (to.left + to.width / 2);
  const y = from.top + from.height / 2 - (to.top + to.height / 2);
  const scaleX = from.width / to.width;
  const scaleY = from.height / to.height;
  const animation = element.animate(
    [{ transform: `translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY})` }, { transform: "none" }],
    {
      duration: (options.duration ?? FLIP_SECONDS) * 1000,
      easing: cssEase(options.ease ?? EASE_OUT),
    },
  );
  return { stop: () => animation.cancel(), finished: animation.finished };
}

/**
 * clip-path inset that shows only the part of `panel` under `from` — the start of the panel
 * "opening out of the card". Clamped at 0, so a card partly outside the panel still works.
 */
export function insetFrom(panel: Box, from: Box): string {
  const top = Math.max(0, from.top - panel.top);
  const left = Math.max(0, from.left - panel.left);
  const right = Math.max(0, panel.left + panel.width - (from.left + from.width));
  const bottom = Math.max(0, panel.top + panel.height - (from.top + from.height));
  return `inset(${top}px ${right}px ${bottom}px ${left}px)`;
}
