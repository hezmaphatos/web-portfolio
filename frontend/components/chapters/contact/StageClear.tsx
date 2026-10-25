"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useRef } from "react";

import { gsap, useGSAP } from "@/lib/gsap";

type Props = {
  /** The sender's name and address, echoed back. */
  name: string;
  email: string;
  /** The Messenger badge was unlocked by this message (first message of this save). */
  newBadge: boolean;
  /** Messages sent in this visit (the "score"). */
  count: number;
  /** Lite / reduced motion: the panel is simply there, no banner drop, no pixel burst. */
  still: boolean;
  onAgain: () => void;
};

const WORDS = ["Stage", "Clear"];
/** Pixel confetti: a fixed number of squares, colours cycled (lime would vanish on the panel). */
const PIXELS = 30;
const PIXEL_COLORS = ["var(--hot)", "var(--volt)", "var(--ink)", "var(--paper)"];

/**
 * The "STAGE CLEAR" result screen after a sent message (spec §4.1 contact): the chapter's one big
 * motion moment. The banner letters drop in on stepped (8-bit) easing, a bar slams under them, a
 * burst of pixel squares flies out, then the details slide up. GSAP, transform + opacity only.
 * It takes the form's place in the same grid cell, so nothing below moves. On mount the heading
 * takes the focus (the form under it went inert), so keyboard and screen reader users land here.
 */
export function StageClear({ name, email, newBadge, count, still, onAgain }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstName = name.trim().split(/\s+/)[0] ?? name;

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  useGSAP(
    () => {
      if (still) return;
      const timeline = gsap.timeline();
      timeline
        .from("[data-clear-letter]", {
          yPercent: -140,
          opacity: 0,
          duration: 0.4,
          ease: "steps(5)",
          stagger: 0.05,
        })
        .from("[data-clear-bar]", { scaleX: 0, duration: 0.3, ease: "power4.out" }, 0.42)
        .from(
          "[data-clear-rest]",
          { y: 18, opacity: 0, duration: 0.35, stagger: 0.07, ease: "power2.out" },
          0.75,
        );

      // The burst: every square leaves the banner's centre on its own random heading.
      // Fully opaque in flight; each one only blinks out at the end of its trip.
      gsap.utils.toArray<HTMLElement>("[data-clear-pixel]").forEach((pixel) => {
        const angle = gsap.utils.random(0, Math.PI * 2);
        const distance = gsap.utils.random(120, 360);
        const duration = gsap.utils.random(0.8, 1.3);
        timeline
          .fromTo(
            pixel,
            { x: 0, y: 0, opacity: 1, rotation: 0, scale: gsap.utils.random(0.7, 1.5) },
            {
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance * 0.7,
              rotation: gsap.utils.random(-180, 180),
              duration,
              ease: "power3.out",
            },
            0.5,
          )
          .to(pixel, { opacity: 0, duration: 0.25, ease: "steps(3)" }, 0.5 + duration * 0.7);
      });
      // Sound (phase 7): the "stage clear" jingle starts with the burst.
    },
    { scope: root, dependencies: [] },
  );

  return (
    <div ref={root} className="hk-clear">
      <p className="hk-pixel text-xs">
        <span aria-hidden="true">▸ </span>Final stage · Message sent
      </p>
      {/* w-fit: the burst's origin (50 % / 50 %) is the middle of the banner itself. */}
      <div className="relative w-fit">
        {still ? null : (
          <div aria-hidden="true" className="hk-clear-burst">
            {Array.from({ length: PIXELS }, (_, i) => (
              <span
                key={i}
                data-clear-pixel
                className="hk-clear-pixel"
                style={{ background: PIXEL_COLORS[i % PIXEL_COLORS.length] }}
              />
            ))}
          </div>
        )}
        <h3 ref={heading} tabIndex={-1} data-focus-target className="hk-clear-title hk-pixel">
          <span className="sr-only">Stage clear!</span>
          <span aria-hidden="true" className="block">
            {WORDS.map((word) => (
              <span key={word} className="block whitespace-nowrap">
                {Array.from(word).map((letter, i) => (
                  <span key={i} data-clear-letter className="inline-block">
                    {letter}
                  </span>
                ))}
              </span>
            ))}
          </span>
        </h3>
      </div>
      <span aria-hidden="true" data-clear-bar className="hk-clear-bar" />

      <p data-clear-rest className="mt-5 max-w-prose text-lg leading-snug">
        Thanks, {firstName}! Your message is in my inbox. I&apos;ll reply to{" "}
        <strong className="font-bold wrap-anywhere">{email}</strong>.
      </p>
      <div data-clear-rest className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-4">
        <ul className="hk-mono flex flex-wrap gap-2 text-xs font-bold">
          <li className="hk-clear-stat">Messages sent · {count}</li>
          {newBadge ? <li className="hk-clear-stat">Badge unlocked · Messenger</li> : null}
        </ul>
        <button type="button" className="hk-btn hk-btn-ink" onClick={onAgain}>
          <RotateCcw aria-hidden="true" className="size-4" />
          Send another
        </button>
      </div>
    </div>
  );
}
