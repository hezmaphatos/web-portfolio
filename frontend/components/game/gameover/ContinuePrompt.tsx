"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";

import { PixelDigits } from "./PixelDigits";

/** What NO says, in turn (the last one repeats). */
const QUIPS = [
  "Fine, stay here. The clock starts over.",
  "Still no? Bold strategy. Rewinding.",
  "The void appreciates the company.",
  "OK, OK. Infinite continues, then.",
] as const;

/**
 * "CONTINUE?" with a 9 → 0 arcade countdown (spec §4 /not-found mini interaction).
 *
 * The ticking is pure CSS (app/globals.css, "phase 7B"): the pixel-digit strip steps up once a
 * second with `steps()`, and at 0 "INSERT COIN" appears. Hovering or focusing the prompt pauses
 * every animation in it (`animation-play-state`), and nothing ever navigates on its own. So it
 * works without JavaScript too: YES is a plain link home, NO a fragment link whose :target shows
 * a line. With JavaScript, NO restarts the countdown (the key remounts the strip, which replays
 * its CSS animations) and says something new each time, politely announced.
 */
export function ContinuePrompt({ titleId }: { titleId: string }) {
  const [round, setRound] = useState(0);
  const [quip, setQuip] = useState<string | null>(null);

  const onNo = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setQuip(QUIPS[Math.min(round, QUIPS.length - 1)] ?? null);
    setRound(round + 1);
  };

  return (
    <div className="hk-go-prompt hk-panel" role="group" aria-labelledby={titleId}>
      <p id={titleId} className="hk-go-continue hk-pixel">
        Continue?
      </p>

      <div key={round} className="hk-go-counter" aria-hidden="true">
        <span className="hk-go-window">
          <PixelDigits className="hk-go-strip" />
        </span>
        <span className="hk-go-coin hk-pixel">
          <span>Insert coin</span>
        </span>
      </div>

      <div className="hk-go-choices">
        <Link href="/" className="hk-btn hk-btn-hot hk-go-choice">
          Yes<span className="sr-only">, back to Home</span>
        </Link>
        <a href="#hk-go-stay" className="hk-btn hk-go-choice" onClick={onNo}>
          No<span className="sr-only">, stay on this page</span>
        </a>
      </div>

      <p id="hk-go-stay" role="status" className="hk-go-quip">
        {quip ?? <span className="hk-go-quip-nojs">Fine, stay here.</span>}
      </p>
    </div>
  );
}
