"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

/** Site-wide game settings from the admin (site_settings), available to every client island. */
type GameConfig = {
  /** Share of a boss project's tech stack visible before the boss is defeated (spec §6.4). */
  techVisiblePercent: number;
  /**
   * Ids of the featured projects that are bosses (lib/badges featuredBossIds): the Collector
   * badge's target set. A Project Stage only knows its own project, so the layout hands it down.
   */
  featuredBossIds: number[];
};

const GameConfigContext = createContext<GameConfig>({
  techVisiblePercent: 50,
  featuredBossIds: [],
});

export function GameConfigProvider({
  techVisiblePercent,
  featuredBossIds,
  children,
}: GameConfig & { children: ReactNode }) {
  // The ids arrive as a fresh array on every layout render; their content is what matters.
  const featuredKey = featuredBossIds.join(",");
  const value = useMemo(
    () => ({
      techVisiblePercent,
      featuredBossIds: featuredKey ? featuredKey.split(",").map(Number) : [],
    }),
    [techVisiblePercent, featuredKey],
  );
  return <GameConfigContext value={value}>{children}</GameConfigContext>;
}

export const useGameConfig = () => useContext(GameConfigContext);
