"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Fired after we rewrite the hash ourselves (history.replaceState fires no `hashchange`). */
const HASH_EVENT = "admin:hash-tab";

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener(HASH_EVENT, onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener(HASH_EVENT, onChange);
  };
}

const readHash = () => decodeURIComponent(window.location.hash.slice(1));
const serverHash = () => "";

/**
 * Tab state kept in the URL hash (`/admin/projects/3#boss`), so a reload or a shared link opens
 * the same tab. Changing tabs replaces the history entry (Back leaves the page, not the tab).
 * The server render (no hash) shows `fallback`; the real tab appears right after hydration.
 */
export function useHashTab<T extends string>(
  tabs: readonly T[],
  fallback: T,
): [tab: T, setTab: (tab: T) => void] {
  const hash = useSyncExternalStore(subscribe, readHash, serverHash);
  const tab = (tabs as readonly string[]).includes(hash) ? (hash as T) : fallback;

  const setTab = useCallback(
    (next: T) => {
      const { pathname, search } = window.location;
      // Next.js keeps its router state when replaceState is called (docs: Native History API).
      window.history.replaceState(null, "", next === fallback ? pathname + search : `#${next}`);
      window.dispatchEvent(new Event(HASH_EVENT));
    },
    [fallback],
  );

  return [tab, setTab];
}
