"use client";

import { BOSS_TUTORIAL } from "@/lib/hints";

type Props = {
  /** Current tutorial step (0–2), or null when the tutorial is not running. */
  step: number | null;
  onSkip: () => void;
};

/**
 * The first-visit boss tutorial (spec §5.3): three coach marks in a row — ① the loadout, ② the
 * slots, ③ the boss. Not a modal: a small card on the Arena stage (which holds nothing
 * clickable), pointing at its target, which gets a dashed outline ([data-coach] on the Arena).
 * The Arena advances it when the visitor does the action; "Skip tutorial" ends it. The status
 * line is always in the DOM, so each new step is announced politely without taking focus.
 */
export function CoachMark({ step, onSkip }: Props) {
  const mark = step === null ? null : BOSS_TUTORIAL[step];

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {mark ? `Tutorial ${(step ?? 0) + 1} of ${BOSS_TUTORIAL.length}: ${mark.text}` : ""}
      </p>
      {mark ? (
        <div className="hk-coach" data-target={mark.target} data-coach-card>
          <p aria-hidden="true" className="hk-pixel text-[0.55rem] leading-none">
            Tutorial {(step ?? 0) + 1}/{BOSS_TUTORIAL.length}
          </p>
          <p aria-hidden="true" className="mt-1 text-[0.8125rem] leading-snug font-bold">
            {mark.text}
          </p>
          <button type="button" className="hk-coach-skip" onClick={onSkip}>
            Skip tutorial
          </button>
        </div>
      ) : null}
    </>
  );
}
