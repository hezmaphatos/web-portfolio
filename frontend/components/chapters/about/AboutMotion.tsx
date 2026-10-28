"use client";

import { useRef, type ReactNode } from "react";

import { setupCounters } from "@/components/chapters/shared/countUp";
import { useMotionGate } from "@/components/chapters/shared/motion";
import { gsap, MEDIA, SplitText, useGSAP } from "@/lib/gsap";

type Props = { className?: string; children: ReactNode };

/**
 * Motion for the About text column (spec §4.1 about), on top of server-rendered content:
 * - [data-bio-scrub]: the bio lights up word by word, tied to the scroll position (scrub);
 * - [data-counter]: the stat cards count up once when they come into view.
 * Lite / reduced motion: nothing runs; the text is just there at full strength.
 */
export function AboutMotion({ className, children }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const { ready, lite } = useMotionGate(root);

  useGSAP(
    () => {
      const column = root.current;
      if (!ready || lite || !column) return;
      const mm = gsap.matchMedia();
      mm.add(
        { motionOk: "(prefers-reduced-motion: no-preference)", reduce: MEDIA.reduce },
        (ctx) => {
          if (ctx.conditions?.reduce) return;

          const bio = column.querySelector<HTMLElement>("[data-bio-scrub]");
          if (bio) {
            // aria "none": leave the paragraph alone for screen readers; the word <span>s are
            // only there so each word can get its own opacity.
            const split = SplitText.create(bio, { type: "words", tag: "span", aria: "none" });
            // Words never drop below 0.65: even before you scroll through it the bio keeps AA
            // contrast (≥ 4.5:1 on the chapter background; 0.22 was 1.6:1).
            gsap.fromTo(
              split.words,
              { opacity: 0.65 },
              {
                opacity: 1,
                ease: "none",
                stagger: 0.12, // with scrub, stagger spreads the words across the scroll distance
                scrollTrigger: {
                  trigger: bio,
                  start: "top 82%", // the bio's top reaches 82 % of the viewport height…
                  end: "bottom 52%", // …until its bottom is just past the middle
                  scrub: 0.4, // follow the scrollbar, smoothed by 0.4 s
                },
              },
            );
          }

          return setupCounters(column);
        },
      );
    },
    { scope: root, dependencies: [ready, lite], revertOnUpdate: true },
  );

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
