"use client";

import { useRef, useState, type ReactNode } from "react";

import { useMotionGate } from "@/components/chapters/shared/motion";
import { completeStageHint, useStageHint } from "@/components/game/useStageHint";
import { gsap, MEDIA, useGSAP } from "@/lib/gsap";

type Props = {
  /** Portrait face (server-rendered <Media>). */
  front: ReactNode;
  /** Pixel-avatar face (server-rendered <Media>). */
  back: ReactNode;
  /** sections.hint of About ("Click the portrait card to flip it. …"). */
  hint: string | null;
};

/**
 * The flipping portrait of the character card (spec §4.1 about): portrait ⇄ pixel avatar.
 * A real toggle button (aria-pressed) covers the picture, so mouse, touch and keyboard all flip
 * it. The two faces are a true 3D card — the back face is rotated 180° and hidden while it
 * faces away (backface-visibility) — and GSAP turns the card with rotationY (transform only).
 * Lite / reduced motion: the faces swap instantly. Without JS a <noscript> style in AboutChapter
 * shows the avatar as a small inset instead.
 */
export function FlipCard({ front, back, hint }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);
  const { lite } = useMotionGate();

  useStageHint("about", hint, root);

  const { contextSafe } = useGSAP({ scope: root });

  // contextSafe: tweens made in an event handler join the useGSAP context (reverted on unmount).
  // It is wrapped at click time, so nothing reads the ref during render.
  const turn = (toBack: boolean) =>
    contextSafe(() => {
      const card = root.current?.querySelector("[data-flip-inner]");
      if (!card) return;
      const instant = lite || window.matchMedia(MEDIA.reduce).matches;
      gsap.killTweensOf(card);
      if (instant) {
        gsap.set(card, { rotationY: toBack ? 180 : 0 });
        return;
      }
      gsap
        .timeline()
        .to(card, {
          rotationY: toBack ? 180 : 0,
          duration: 0.75,
          ease: "back.out(1.3)", // overshoots a few degrees and settles, like a card slapped down
        })
        // A small lift mid-turn sells the 3D: up and back down, in parallel with the turn.
        .to(card, { z: 60, duration: 0.3, ease: "power2.out", yoyo: true, repeat: 1 }, 0);
    })();

  const toggle = () => {
    const next = !flipped;
    setFlipped(next);
    turn(next);
    completeStageHint("about");
  };

  return (
    <div ref={root} className="hk-flip">
      <div data-flip-inner className="hk-flip-inner">
        <div data-flip-front className="hk-flip-face border-ink relative border-2">
          {front}
        </div>
        <div data-flip-back className="hk-flip-face hk-flip-back">
          {back}
        </div>
      </div>
      <button
        type="button"
        className="hk-flip-btn"
        aria-pressed={flipped}
        aria-label="Show the pixel avatar"
        onClick={toggle}
      >
        <span aria-hidden="true" className="hk-flip-tag hk-pixel">
          {flipped ? "◂ Photo" : "Flip ▸"}
        </span>
      </button>
    </div>
  );
}
