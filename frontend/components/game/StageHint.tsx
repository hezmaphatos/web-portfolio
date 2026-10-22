"use client";

import { X } from "lucide-react";
import type { FocusEvent } from "react";

import { HINT_AUTO_CLOSE_MS } from "@/lib/hints";
import type { ActiveHint } from "@/lib/store";

type Props = {
  /** The hint on the card (kept while it fades out, so the text never blanks mid-exit). */
  hint: ActiveHint | null;
  open: boolean;
  paused: boolean;
  /** Restarts the timer bar for each new hint. */
  serial: number;
  onClose: () => void;
  onPause: (paused: boolean) => void;
};

const STAGE_NAMES: Record<string, string> = {
  hero: "Player one",
  about: "Character select",
  journey: "Quest log",
  skills: "Skill tree",
  projects: "Level select",
  trophies: "Trophy room",
  contact: "Final stage",
  boss: "Boss",
};

/** "Grab the sticker and throw it. Scroll down…" → the order, then the extra sentence. */
function splitHint(text: string): [string, string | null] {
  const [lead, ...rest] = text.trim().split(/(?<=[.!?])\s+/);
  return [lead ?? text, rest.length > 0 ? rest.join(" ") : null];
}

/**
 * The hint card (spec §5.3): a small HUD-style card in the bottom-left corner (bottom, above the
 * safe area, on phones). Not a modal: it never takes focus, only the card itself catches the
 * pointer, and its text reaches screen readers through the live region in <StageHintHost>
 * (so this copy is aria-hidden; the buttons stay reachable).
 */
export function StageHint({ hint, open, paused, serial, onClose, onPause }: Props) {
  const [lead, extra] = hint ? splitHint(hint.text) : ["", null];
  const stage = hint ? (STAGE_NAMES[hint.key] ?? hint.key) : "";

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onPause(false);
  };

  return (
    <div
      className="hk-hint"
      data-state={open ? "open" : "closed"}
      data-paused={paused || undefined}
      onPointerEnter={() => onPause(true)}
      onPointerLeave={() => onPause(false)}
      onFocus={() => onPause(true)}
      onBlur={onBlur}
    >
      <span aria-hidden="true" className="hk-hint-icon hk-pixel">
        ?
      </span>
      <div aria-hidden="true" className="min-w-0 flex-1">
        <p className="hk-pixel text-lime pt-0.5 pr-9 text-[0.65rem] leading-tight">
          Hint <span className="text-paper/70">▸ {stage}</span>
        </p>
        <p className="mt-2 text-[0.95rem] leading-snug font-semibold">{lead}</p>
        {extra ? <p className="text-paper/80 mt-1 text-sm leading-snug">{extra}</p> : null}
      </div>
      <button type="button" className="hk-hint-close" aria-label="Close hint" onClick={onClose}>
        <X aria-hidden="true" className="size-4" strokeWidth={3} />
      </button>
      {open ? (
        <span
          key={serial}
          aria-hidden="true"
          className="hk-hint-timer"
          style={{ animationDuration: `${HINT_AUTO_CLOSE_MS}ms` }}
        />
      ) : null}
    </div>
  );
}
