"use client";

import { create } from "zustand";

import { CURIOUS_TARGET } from "@/lib/badges";

/*
 * The Curious counter: which projects this visitor opened (a Project Stage shown, page or modal).
 * The save cookie's format is fixed by spec §5.2, so the counter lives in localStorage
 * (`p1_opened`, a JSON list of slugs) — a counter, not progress: the badge itself goes into
 * the cookie. Only CURIOUS_TARGET distinct slugs are kept (all the badge needs). Blocked storage
 * → an in-memory list for this page session. Reset save / NEW GAME clear it (BadgeWatcher).
 */

export const OPENED_KEY = "p1_opened";

function readStorage(): string[] {
  try {
    const raw = window.localStorage.getItem(OPENED_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return [...new Set(list.filter((item): item is string => typeof item === "string"))].slice(
      0,
      CURIOUS_TARGET,
    );
  } catch {
    return [];
  }
}

function writeStorage(slugs: string[]): void {
  try {
    if (slugs.length === 0) window.localStorage.removeItem(OPENED_KEY);
    else window.localStorage.setItem(OPENED_KEY, JSON.stringify(slugs));
  } catch {
    // storage blocked: the in-memory list below still counts for this session
  }
}

type OpenedState = { slugs: string[]; loaded: boolean };

export const useOpenedStore = create<OpenedState>()(() => ({ slugs: [], loaded: false }));

/** Reads the stored list once (client only; the server and the first render count 0). */
export function loadOpened(): void {
  if (useOpenedStore.getState().loaded) return;
  useOpenedStore.setState({ slugs: readStorage(), loaded: true });
}

/** Counts one opened project (idempotent per slug). */
export function recordProjectOpen(slug: string): void {
  loadOpened();
  const { slugs } = useOpenedStore.getState();
  if (slugs.includes(slug) || slugs.length >= CURIOUS_TARGET) return;
  const next = [...slugs, slug];
  writeStorage(next);
  useOpenedStore.setState({ slugs: next });
}

export function clearOpened(): void {
  writeStorage([]);
  useOpenedStore.setState({ slugs: [], loaded: true });
}
