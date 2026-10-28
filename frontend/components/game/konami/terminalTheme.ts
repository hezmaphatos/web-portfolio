"use client";

import { createElement } from "react";
import { create } from "zustand";

import { toast } from "@/components/game/toast/toast";
import { MEDIA } from "@/lib/gsap";
import { PREFS_KEY, useGameStore, usePrefsStore } from "@/lib/store";

/*
 * Terminal Mode (spec §5 badge "Konami"): a terminal theme on <html data-theme="terminal">.
 * The preference lives in localStorage (usePrefsStore.terminalMode, spec §5.2), the pre-paint head
 * script applies it before the first paint (components/game/splash/prepaint.ts) and
 * <StoreHydrator> keeps the attribute in sync afterwards. All colours come from the CSS tokens
 * (app/globals.css, "phase 7B" block); nothing here knows about colours.
 */

export const THEME_ATTR = "theme";
export const TERMINAL_THEME = "terminal";

/** Writes / removes `data-theme` on <html>. The admin never gets it (it has its own theme). */
export function applyTheme(on: boolean): void {
  const root = document.documentElement;
  if (on && !window.location.pathname.startsWith("/admin"))
    root.dataset[THEME_ATTR] = TERMINAL_THEME;
  else delete root.dataset[THEME_ATTR];
}

/** The stored preference, read synchronously (same JSON shape the pre-paint script reads). */
export function storedTerminalMode(): boolean {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    const stored = raw ? (JSON.parse(raw) as { state?: { terminalMode?: unknown } }) : null;
    return stored?.state?.terminalMode === true;
  } catch {
    return false;
  }
}

/** Bumped on every switch; <TerminalMode> replays the CRT flash for each new value. */
export const useThemeFlash = create<{ count: number; bump: () => void }>()((set, get) => ({
  count: 0,
  bump: () => set({ count: get().count + 1 }),
}));

const isStill = () =>
  document.documentElement.dataset.lite === "true" || window.matchMedia(MEDIA.reduce).matches;

/** Runs `fn` once the save cookie has been read (unlocking a badge earlier would be overwritten). */
function whenSaveReady(fn: () => void) {
  if (useGameStore.getState().hydrated) return fn();
  const stop = useGameStore.subscribe((state) => {
    if (!state.hydrated) return;
    stop();
    fn();
  });
}

const TERMINAL_ICON = createElement("span", { className: "hk-pixel text-[0.625rem]" }, ">_");

/**
 * Turns Terminal Mode on or off with the full feedback: theme swap (synchronous, under the flash),
 * CRT flash (not in Lite / reduced motion), toast, and the Konami badge the first time it is on.
 */
export function setTerminalMode(on: boolean): void {
  const prefs = usePrefsStore.getState();
  if (!prefs.hydrated) return; // the stored value is about to land; don't race it
  if (prefs.terminalMode === on) return;

  // The attribute flips in the same frame the flash overlay mounts, so the swap is hidden.
  applyTheme(on);
  prefs.setTerminalMode(on);
  if (!isStill()) useThemeFlash.getState().bump();

  toast(on ? "TERMINAL MODE: ON" : "TERMINAL MODE: OFF", { icon: TERMINAL_ICON });
  if (on) whenSaveReady(() => useGameStore.getState().unlockBadge("konami"));
}

export function toggleTerminalMode(): void {
  setTerminalMode(!usePrefsStore.getState().terminalMode);
}
