"use client";

import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { scrollToTarget, useLenis } from "@/components/providers/SmoothScroll";
import { focusElement } from "@/components/ui/focus";
import { useStill } from "@/components/ui/useStill";
import { gsap, useGSAP } from "@/lib/gsap";
import { sfx } from "@/lib/sound";

/** Scroll time of the rewind (s): the whole level flies past under the tape effect. */
const REWIND_S = 1.05;

const focusHero = () => {
  const target = document.getElementById("hero-title") ?? document.getElementById("main");
  if (target) focusElement(target);
};

/** Ease-in-out cubic: the tape spins up, races, slows into the start. */
const tapeEase = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * The footer's "Play again" (spec §4.1 contact): back to the top of the level. A real
 * `<a href="#main">`, so it works without JavaScript. With JS it "rewinds the tape": a VHS overlay
 * (rolling scanlines, tracking-error bands, a ◂◂ REW read-out with a running counter) opens like a
 * CRT band while Lenis races the page back to the top underneath, then collapses to a line and
 * hands keyboard focus to the Hero title. Overlay only: transform / opacity / clip-path; it never
 * takes the pointer. Lite / reduced motion (or already at the top): a plain jump.
 */
export function PlayAgainLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const lenis = useLenis();
  const still = useStill();
  const [rewinding, setRewinding] = useState(false);

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    // Lenis listens for anchor clicks on window and would start its own scroll to #main.
    event.stopPropagation();
    if (rewinding) return;

    if (still || !lenis || window.scrollY < 80) {
      if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
      else scrollToTarget(0);
      focusHero();
      return;
    }

    sfx.rewind();
    setRewinding(true);
    lenis.scrollTo(0, {
      duration: REWIND_S,
      easing: tapeEase,
      lock: true,
      force: true,
    });
  };

  return (
    <>
      <a href="#main" data-play-again data-sfx="off" className={className} onClick={onClick}>
        {children}
      </a>
      {rewinding
        ? createPortal(<RewindOverlay onDone={() => setRewinding(false)} />, document.body)
        : null}
    </>
  );
}

/** Seconds of "tape" per scrolled pixel, for the counter read-out. */
const TAPE_PER_PX = 1 / 40;

function timecode(px: number): string {
  const total = Math.max(0, Math.round(px * TAPE_PER_PX));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function RewindOverlay({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const doneRef = useRef(onDone);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const html = document.documentElement;
      html.dataset.overlay = "rewind"; // hides a stage hint that would pop up on the way
      const update = () => {
        if (counter.current) counter.current.textContent = timecode(window.scrollY);
      };
      update();
      gsap.ticker.add(update);

      const loops = [
        gsap.fromTo(
          "[data-rewind-lines]",
          { y: 0 },
          { y: -8, duration: 0.12, ease: "none", repeat: -1 },
        ),
        gsap.fromTo(
          "[data-rewind-band]",
          { y: 0 },
          {
            // From just below the screen to just above it (the bands start under the bottom edge).
            y: () => -window.innerHeight * 1.3,
            duration: 0.42,
            ease: "none",
            stagger: { each: 0.17, repeat: -1 },
          },
        ),
        gsap.to("[data-rewind-blink]", {
          opacity: 0.25,
          duration: 0.18,
          ease: "steps(1)",
          repeat: -1,
          yoyo: true,
        }),
      ];

      const finish = () => {
        gsap.ticker.remove(update);
        loops.forEach((tween) => tween.kill());
        if (html.dataset.overlay === "rewind") delete html.dataset.overlay;
        focusHero();
        doneRef.current();
      };

      gsap
        .timeline({ onComplete: finish })
        .fromTo(
          el,
          { clipPath: "inset(50% 0% 50% 0%)", opacity: 1 },
          { clipPath: "inset(0% 0% 0% 0%)", duration: 0.18, ease: "power2.out" },
        )
        // The read-out switches to PLAY as the page lands on the Hero.
        .call(
          () => {
            if (label.current) label.current.textContent = "▸ Play";
            loops[2]?.pause(0);
          },
          [],
          REWIND_S,
        )
        .to(
          el,
          { clipPath: "inset(50% 0% 50% 0%)", duration: 0.22, ease: "power3.in" },
          REWIND_S + 0.14,
        )
        .to(el, { opacity: 0, duration: 0.08 }, ">-0.04");

      return () => {
        gsap.ticker.remove(update);
        if (html.dataset.overlay === "rewind") delete html.dataset.overlay;
      };
    },
    { scope: root, dependencies: [] },
  );

  return (
    <div ref={root} className="hk-rewind" aria-hidden="true">
      <div className="hk-rewind-tint" />
      <div data-rewind-lines className="hk-rewind-lines" />
      <div className="hk-rewind-bands">
        <span data-rewind-band className="hk-rewind-band" />
        <span data-rewind-band className="hk-rewind-band is-thin" />
        <span data-rewind-band className="hk-rewind-band" />
      </div>
      <p className="hk-rewind-osd hk-pixel">
        <span ref={label} data-rewind-blink>
          ◂◂ Rew
        </span>
      </p>
      <p className="hk-rewind-counter hk-pixel">
        <span>SP</span>
        <span ref={counter} className="hk-mono">
          0:00:00
        </span>
      </p>
    </div>
  );
}
