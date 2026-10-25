"use client";

import { useCallback, useSyncExternalStore } from "react";
import { create } from "zustand";

/*
 * Which skill node the Skill Tree is pointing at (spec §4.1 skills: "hover/klik node → highlight
 * project yang memakai skill itu"). Session-only UI state, never saved:
 * - `preview`: the node under the mouse or holding keyboard focus (temporary);
 * - `pinned`: the node the visitor clicked/tapped (stays lit while they scroll on to the projects).
 * The lit skill is `preview ?? pinned`.
 */

type TreeFocusState = {
  preview: number | null;
  pinned: number | null;
  setPreview: (skillId: number | null) => void;
  togglePin: (skillId: number) => void;
  unpin: () => void;
};

export const useTreeFocus = create<TreeFocusState>()((set, get) => ({
  preview: null,
  pinned: null,
  setPreview: (preview) => {
    if (get().preview !== preview) set({ preview });
  },
  togglePin: (skillId) => set({ pinned: get().pinned === skillId ? null : skillId }),
  unpin: () => set({ pinned: null }),
}));

export function litSkill(state: Pick<TreeFocusState, "preview" | "pinned">): number | null {
  return state.preview ?? state.pinned;
}

/** `window.matchMedia(query).matches`, live. False on the server and during hydration. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", callback);
      return () => list.removeEventListener("change", callback);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
