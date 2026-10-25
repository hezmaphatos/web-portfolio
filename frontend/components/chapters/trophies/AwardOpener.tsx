"use client";

import type { ReactNode } from "react";

import { useMounted } from "@/components/chapters/shared/motion";

import { useTrophyRoom } from "./TrophyRoom";

type Props = { awardId: number; children: ReactNode };

/**
 * A trophy card's title, which becomes the button that opens its detail dialog once JavaScript
 * runs (server HTML / no JS: plain text, nothing that pretends to work). The button's ::after
 * stretches over the whole card, so a click anywhere on it opens the dialog; Enter / Space work
 * because it is a real <button>. Same font and wrapping as the text, so the swap never shifts.
 */
export function AwardOpener({ awardId, children }: Props) {
  const room = useTrophyRoom();
  const mounted = useMounted();
  if (!mounted || !room) return <>{children}</>;

  return (
    <button
      type="button"
      className="hk-award-open"
      aria-haspopup="dialog"
      onClick={(event) => room.openAward(awardId, event.currentTarget)}
    >
      {children}
    </button>
  );
}
