"use client";

import { useEffect } from "react";

import { applyTheme } from "@/components/game/konami/terminalTheme";
import { useGameStore, useLiteMode, usePrefsStore } from "@/lib/store";

type Props = {
  /** Every skill / project id the site currently has: ids in an old save that are gone get dropped. */
  skillIds: number[];
  projectIds: number[];
};

/**
 * Reads the save cookie and the preferences after mount (both stores use skipHydration), so the
 * server HTML — always the locked, default state — is what the first client render matches.
 * Also mirrors Lite mode onto <html data-lite> and Terminal Mode onto <html data-theme> for CSS.
 */
export function StoreHydrator({ skillIds, projectIds }: Props) {
  const lite = useLiteMode();
  const prefsReady = usePrefsStore((state) => state.hydrated);
  const terminalMode = usePrefsStore((state) => state.terminalMode);

  useEffect(() => {
    void usePrefsStore.persist.rehydrate();
    void Promise.resolve(useGameStore.persist.rehydrate()).then(() => {
      useGameStore.getState().sanitize({ skillIds, projectIds });
    });
    // Ids come from the cached home payload; they only change on a new deploy/revalidation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.dataset.lite = lite ? "true" : "false";
  }, [lite]);

  // Only once the stored prefs are in: before that `terminalMode` is the default (false) and would
  // strip the theme the pre-paint script applied — a flash of the paper theme.
  useEffect(() => {
    if (prefsReady) applyTheme(terminalMode);
  }, [prefsReady, terminalMode]);

  return null;
}
