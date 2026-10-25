"use client";

import { createContext, useContext, type ReactNode } from "react";

/** Site-wide game settings from the admin (site_settings), available to every client island. */
type GameConfig = {
  /** Share of a boss project's tech stack visible before the boss is defeated (spec §6.4). */
  techVisiblePercent: number;
};

const GameConfigContext = createContext<GameConfig>({ techVisiblePercent: 50 });

export function GameConfigProvider({
  techVisiblePercent,
  children,
}: GameConfig & { children: ReactNode }) {
  return <GameConfigContext value={{ techVisiblePercent }}>{children}</GameConfigContext>;
}

export const useGameConfig = () => useContext(GameConfigContext);
