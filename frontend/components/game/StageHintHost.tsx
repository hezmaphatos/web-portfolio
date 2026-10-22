"use client";

import { useEffect, useRef, useState } from "react";

import { StageHint } from "@/components/game/StageHint";
import { HINT_AUTO_CLOSE_MS } from "@/lib/hints";
import { useHintStore, type ActiveHint } from "@/lib/store";

/**
 * Renders the active stage hint (spec §5.3), mounted once in the site layout. Whoever opens a
 * hint — a stage (useStageHint), the "?" next to a chapter title, the HUD Help button — only
 * calls useHintStore.show(); this host owns the card, the 7 s auto-close (paused while the
 * pointer or keyboard focus is on the card) and the screen-reader announcement.
 */
export function StageHintHost() {
  const active = useHintStore((state) => state.active);
  const dismiss = useHintStore((state) => state.dismiss);

  // The last hint stays on the card while it fades out; `serial` restarts the timer bar.
  const [shown, setShown] = useState<{ hint: ActiveHint | null; serial: number }>({
    hint: null,
    serial: 0,
  });
  if (active && active !== shown.hint) setShown({ hint: active, serial: shown.serial + 1 });

  // Paused for one specific hint: a new hint always starts with a running timer.
  const [pausedFor, setPausedFor] = useState<ActiveHint | null>(null);
  const paused = active !== null && pausedFor === active;

  // Auto-close: 7 s of unpaused time per hint (manual ones too — they only skip the
  // "scrolled away" rule in useStageHint).
  const remaining = useRef(HINT_AUTO_CLOSE_MS);
  useEffect(() => {
    remaining.current = HINT_AUTO_CLOSE_MS;
  }, [active]);
  useEffect(() => {
    if (!active || paused) return;
    const started = performance.now();
    const timer = setTimeout(dismiss, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (performance.now() - started));
    };
  }, [active, paused, dismiss]);

  return (
    <div className="hk-hint-host">
      {/* Always in the DOM, so screen readers announce new text politely (role="status"). */}
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {active ? `Hint: ${active.text}` : ""}
      </p>
      <StageHint
        hint={shown.hint}
        open={active !== null}
        paused={paused}
        serial={shown.serial}
        onClose={dismiss}
        onPause={(pause) => setPausedFor(pause ? active : null)}
      />
    </div>
  );
}
