"use client";

import { useGameStore } from "@/lib/store";

/**
 * Lock state of one boss project (spec §6.4), from the save cookie. Before the cookie is read
 * (server render, first client render) every boss is locked, so the HTML never depends on the
 * visitor and hydration never mismatches. Projects without a boss are never locked.
 */
export function useBossLock(projectId: number, bossEnabled: boolean) {
  const hydrated = useGameStore((state) => state.hydrated);
  const beaten = useGameStore((state) => state.defeated.includes(projectId));
  const defeated = bossEnabled && hydrated && beaten;
  return { hydrated, defeated, locked: bossEnabled && !defeated };
}
