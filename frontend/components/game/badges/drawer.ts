"use client";

import { create } from "zustand";

/*
 * Shared state between the HUD's Badges button and the drawer (both mounted once, apart):
 * - phase: closed → open → closing (exit animation) → closed;
 * - trigger: the element that opened it (focus goes back there on close);
 * - opens: counts openings (the Reset save confirm step starts fresh each time);
 * - pulse: bumped by the watcher when a badge toast shows (the HUD button does a small pop).
 */

export type DrawerPhase = "closed" | "open" | "closing";

type DrawerState = {
  phase: DrawerPhase;
  trigger: HTMLElement | null;
  opens: number;
  pulse: number;
};

export const useBadgeDrawer = create<DrawerState>()(() => ({
  phase: "closed",
  trigger: null,
  opens: 0,
  pulse: 0,
}));

export function openBadgeDrawer(trigger: HTMLElement | null): void {
  const state = useBadgeDrawer.getState();
  if (state.phase === "open") return;
  useBadgeDrawer.setState({ phase: "open", trigger, opens: state.opens + 1 });
}

export function closeBadgeDrawer(): void {
  if (useBadgeDrawer.getState().phase === "open") useBadgeDrawer.setState({ phase: "closing" });
}

/** The exit animation finished. */
export function badgeDrawerClosed(): void {
  if (useBadgeDrawer.getState().phase === "closing") useBadgeDrawer.setState({ phase: "closed" });
}

export function pulseBadgeButton(): void {
  useBadgeDrawer.setState({ pulse: useBadgeDrawer.getState().pulse + 1 });
}
