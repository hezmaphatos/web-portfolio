"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist, type PersistStorage } from "zustand/middleware";

import {
  LOADOUT_SIZE,
  SAVE_COOKIE,
  SAVE_VERSION,
  clearSaveCookie,
  newSave,
  readSaveCookie,
  sanitizeSave,
  serializeSave,
  withVisited,
  writeSaveCookie,
  type SaveFile,
} from "@/lib/save";
import type { SectionKey } from "@/lib/types";

/*
 * Client state. Two persisted stores, split on purpose (spec §5.2):
 * - useGameStore: game progress → the `p1_save` cookie (7 days, sliding), via lib/save.ts.
 * - usePrefsStore: preferences (Lite, Sound, Terminal Mode) → localStorage.
 * Both use `skipHydration`: the server always renders the default (locked) state and
 * <StoreHydrator> rehydrates after mount, so there is no hydration mismatch.
 */

// ── Game progress (cookie) ───────────────────────────────────────────────

const SAVE_FIELDS = ["v", "loadout", "defeated", "badges", "hints", "visited", "t"] as const;

function pickSave(state: SaveFile): SaveFile {
  return Object.fromEntries(SAVE_FIELDS.map((key) => [key, state[key]])) as SaveFile;
}

function isEmpty(save: SaveFile): boolean {
  return (
    save.loadout.length === 0 &&
    save.defeated.length === 0 &&
    save.badges.length === 0 &&
    save.hints.length === 0 &&
    save.visited === 0
  );
}

let lastWritten: string | null = null;
let cookieBlocked = false;

/** True when the browser refused the save cookie: progress then lives in memory only. */
export const isSaveCookieBlocked = () => cookieBlocked;

const cookieStorage: PersistStorage<SaveFile> = {
  getItem: () => {
    const save = readSaveCookie();
    if (!save) return null;
    lastWritten = serializeSave(save);
    return { state: save, version: SAVE_VERSION };
  },
  setItem: (_name, { state }) => {
    const save = pickSave(state);
    const value = serializeSave(save);
    // Persist writes on every state change; only real progress changes touch the cookie
    // (each write renews its 7 days) and an untouched new game never creates one.
    if (value === lastWritten || (lastWritten === null && isEmpty(save))) return;
    cookieBlocked = !writeSaveCookie(save);
    lastWritten = value;
  },
  removeItem: () => {
    clearSaveCookie();
    lastWritten = null;
  },
};

type GameState = SaveFile & {
  /** False until the cookie has been read on the client (render the locked state until then). */
  hydrated: boolean;
};

type GameActions = {
  /** Replaces the whole loadout (≤ 4 skill ids, slot order). */
  setLoadout: (skillIds: number[]) => void;
  /** Puts a skill into a slot; if it was in another slot the two swap. */
  equip: (slot: number, skillId: number) => void;
  unequip: (slot: number) => void;
  /** Returns true when this boss was not defeated before (first defeat). */
  defeat: (projectId: number) => boolean;
  /** Returns true when the badge is new. */
  unlockBadge: (badge: string) => boolean;
  markHintSeen: (key: string) => void;
  visit: (chapter: SectionKey) => void;
  /** NEW GAME / Reset save: clears the cookie and every bit of progress. */
  reset: () => void;
  /** Drops ids the site no longer has (after hydrating). */
  sanitize: (known: { skillIds: number[]; projectIds: number[] }) => void;
};

export type GameStore = GameState & GameActions;

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...newSave(0),
      hydrated: false,

      setLoadout: (skillIds) => set({ loadout: [...new Set(skillIds)].slice(0, LOADOUT_SIZE) }),

      // The loadout is a compact list (no holes): slots fill left to right, empty ones trail.
      equip: (slot, skillId) => {
        if (slot < 0 || slot >= LOADOUT_SIZE) return;
        const loadout = [...get().loadout];
        const from = loadout.indexOf(skillId);
        if (slot >= loadout.length) {
          if (from !== -1) loadout.splice(from, 1);
          loadout.push(skillId); // into the first empty slot
        } else if (from === -1) {
          loadout[slot] = skillId; // replace
        } else {
          [loadout[from], loadout[slot]] = [loadout[slot], loadout[from]]; // swap
        }
        set({ loadout: loadout.slice(0, LOADOUT_SIZE) });
      },

      unequip: (slot) => set({ loadout: get().loadout.filter((_, index) => index !== slot) }),

      defeat: (projectId) => {
        if (get().defeated.includes(projectId)) return false;
        set({ defeated: [...get().defeated, projectId] });
        return true;
      },

      unlockBadge: (badge) => {
        if (get().badges.includes(badge)) return false;
        set({ badges: [...get().badges, badge] });
        return true;
      },

      markHintSeen: (key) => {
        if (!get().hints.includes(key)) set({ hints: [...get().hints, key] });
      },

      visit: (chapter) => {
        const next = withVisited(get(), chapter);
        if (next.visited !== get().visited) set({ visited: next.visited });
      },

      reset: () => {
        useGameStore.persist.clearStorage();
        set({ ...newSave(Date.now()) });
      },

      sanitize: (known) => {
        const clean = sanitizeSave(pickSave(get()), known);
        if (
          clean.loadout.length !== get().loadout.length ||
          clean.defeated.length !== get().defeated.length
        ) {
          set({ loadout: clean.loadout, defeated: clean.defeated });
        }
      },
    }),
    {
      name: SAVE_COOKIE,
      version: SAVE_VERSION,
      storage: cookieStorage,
      skipHydration: true,
      partialize: (state) => pickSave(state) as unknown as GameStore,
      onRehydrateStorage: () => (state) => {
        // No (valid) cookie: a new game, created now.
        if (state && state.t === 0) useGameStore.setState({ t: Date.now() });
        useGameStore.setState({ hydrated: true });
      },
    },
  ),
);

/** "Has the visitor a save worth continuing?" (splash: CONTINUE / NEW GAME). */
export function hasProgress(state: SaveFile): boolean {
  return !isEmpty(state);
}

// ── Preferences (localStorage) ───────────────────────────────────────────

export type LitePref = "auto" | "on" | "off";

type PrefsState = {
  /** auto = follow prefers-reduced-motion / Save-Data (spec §5). */
  lite: LitePref;
  /** null = follow the site default (site.sound_default). */
  sound: boolean | null;
  terminalMode: boolean;
  hydrated: boolean;
  setLite: (lite: LitePref) => void;
  setSound: (sound: boolean) => void;
  setTerminalMode: (on: boolean) => void;
};

export const PREFS_KEY = "p1_prefs";

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      lite: "auto",
      sound: null,
      terminalMode: false,
      hydrated: false,
      setLite: (lite) => set({ lite }),
      setSound: (sound) => set({ sound }),
      setTerminalMode: (terminalMode) => set({ terminalMode }),
    }),
    {
      name: PREFS_KEY,
      // localStorage may throw (private mode, blocked storage): fall back to memory silently.
      storage: createJSONStorage(() => {
        try {
          const probe = "__hk";
          window.localStorage.setItem(probe, probe);
          window.localStorage.removeItem(probe);
          return window.localStorage;
        } catch {
          const memory = new Map<string, string>();
          return {
            getItem: (key) => memory.get(key) ?? null,
            setItem: (key, value) => void memory.set(key, value),
            removeItem: (key) => void memory.delete(key),
          };
        }
      }),
      skipHydration: true,
      partialize: (state) => ({
        lite: state.lite,
        sound: state.sound,
        terminalMode: state.terminalMode,
      }),
      onRehydrateStorage: () => () => usePrefsStore.setState({ hydrated: true }),
    },
  ),
);

// ── Lite mode ────────────────────────────────────────────────────────────

function subscribeMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/** prefers-reduced-motion or Save-Data → Lite by default. False on the server. */
export function systemPrefersLite(): boolean {
  if (typeof window === "undefined") return false;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData =
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ===
    true;
  return reduced || saveData;
}

/**
 * Whether the site runs in Lite mode: no Lenis, parallax, custom cursor, avatar path or 3D;
 * simple fades only (spec §5). Server render = not Lite; the head script sets
 * `<html data-lite>` before paint so CSS can already hide motion-only parts.
 */
export function useLiteMode(): boolean {
  const pref = usePrefsStore((state) => state.lite);
  const system = useSyncExternalStore(subscribeMotion, systemPrefersLite, () => false);
  if (pref === "on") return true;
  if (pref === "off") return false;
  return system;
}

// ── HUD + hints (session only, not persisted) ────────────────────────────

type HudState = {
  /** Chapter currently in view (drives LV in the HUD and the Help button). */
  activeChapter: SectionKey | null;
  setActiveChapter: (key: SectionKey | null) => void;
  /**
   * Splash state: "pending" until the boot screen decides, "playing" while it is up,
   * "done" once the Hero is revealed (or the splash was skipped/not shown). Hero intro
   * animations wait for "done" (or start during the wipe, see the splash).
   */
  boot: "pending" | "playing" | "done";
  setBoot: (boot: HudState["boot"]) => void;
};

export const useHudStore = create<HudState>()((set) => ({
  activeChapter: null,
  setActiveChapter: (activeChapter) => set({ activeChapter }),
  boot: "pending",
  setBoot: (boot) => set({ boot }),
}));

export type ActiveHint = {
  /** Stage key: a chapter key, or `boss` / `boss-tutorial` on Project Stages. */
  key: string;
  text: string;
  /** Opened by the visitor (Help / "?"): don't auto-dismiss on the first scroll. */
  manual: boolean;
};

type HintState = {
  active: ActiveHint | null;
  /** Hint text per stage key, registered by each mounted stage (for Help / "?"). */
  texts: Record<string, string>;
  register: (key: string, text: string) => void;
  show: (hint: ActiveHint) => void;
  dismiss: () => void;
};

export const useHintStore = create<HintState>()((set, get) => ({
  active: null,
  texts: {},
  register: (key, text) => {
    if (get().texts[key] !== text) set({ texts: { ...get().texts, [key]: text } });
  },
  show: (active) => set({ active }),
  dismiss: () => set({ active: null }),
}));
