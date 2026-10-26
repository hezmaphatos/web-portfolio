"use client";

import { useBossLock } from "@/components/project/useBossLock";

type Props = { hp: number; projectId: number };

/**
 * The "HP 100" part of a card's boss sticker. Once the boss is defeated (save cookie) the number
 * is struck through — the same characters, so the sticker keeps its exact size.
 */
export function BossHp({ hp, projectId }: Props) {
  const { defeated } = useBossLock(projectId, true);

  return (
    <span
      className="hk-mono font-bold tracking-normal whitespace-nowrap"
      data-boss-hp
      data-defeated={defeated || undefined}
    >
      HP {hp}
      {defeated ? <span className="sr-only"> (defeated)</span> : null}
    </span>
  );
}
