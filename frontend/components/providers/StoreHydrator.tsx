"use client";

import { useEffect } from "react";

import { useGameStore, useLiteMode, usePrefsStore } from "@/lib/store";

type Props = {
  /** Every skill / project id the site currently has: ids in an old save that are gone get dropped. */
  skillIds: number[];
  projectIds: number[];
};

/**
 * Reads the save cookie and the preferences after mount (both stores use skipHydration), so the
 * server HTML — always the locked, default state — is what the first client render matches.
 * Also mirrors Lite mode onto <html data-lite> for CSS.
 */
export function StoreHydrator({ skillIds, projectIds }: Props) {
  const lite = useLiteMode();

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

  return null;
}
