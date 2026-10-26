"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { refreshScrollTriggers, useMotionGate } from "@/components/chapters/shared/motion";
import { scrollToTarget } from "@/components/providers/SmoothScroll";
import { gsap, MEDIA, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { cn, pad2 } from "@/lib/utils";

import { handOffCardClick } from "./handoff";

/**
 * Where the showcase pins. Must stay equal to the @media query of the pinned layout in
 * app/globals.css (phase 6B block): CSS lays the pinned version out from the first paint,
 * this script only adds the motion on top.
 */
const PIN_QUERY = "(min-width: 1024px) and (min-height: 600px)";

type Props = {
  /** accent_color of each featured project, in track order. */
  accents: string[];
  labelledBy: string;
  className?: string;
  children: ReactNode;
};

/**
 * Scene A — the featured showcase (spec §6.1), client island around the server-rendered stage.
 *
 * Desktop (≥ 1024 × 600, motion on, ≥ 2 cartridges) — "pinned horizontal scroll":
 * - The PIN is CSS: the wrapper is (count + 1) × 100vh tall and the stage inside it is
 *   `position: sticky; top: 0; height: 100vh`, so it stays put for count × 100vh of scrolling
 *   (≈ 100vh per project) and then scrolls away by itself — the user is never trapped. The height
 *   is reserved from the first paint (no pin-spacer inserted after hydration: no layout shift, and
 *   deep links like /#contact land where they should), and sticky is composited by the browser,
 *   so it never jitters, whatever drives the scroll (Lenis, keys, scrollbar).
 * - The SCRUB is ScrollTrigger: one tween moves the track from x = 0 to x = −distance while the
 *   wrapper scrolls from "top top" to "bottom bottom" (= the sticky span). `scrub: true` ties it
 *   1:1 to the scroll (Lenis already smooths), `invalidateOnRefresh` re-reads the function-based
 *   distance after every refresh (resize, fonts), measured in a `refreshInit` listener.
 * - Active card: a focus line travels from the first card's centre (start) to the last card's
 *   centre (end); the card nearest to it is active → it lifts and scales up a little, the stage
 *   background (a separate layer) tweens to its accent_color, the counter shows "02 / 03".
 *   Text sits on ink/paper chips, so it stays AA on any accent.
 * - Keyboard: tabbing to a cartridge scrolls the page to where that cartridge is active.
 *
 * Everywhere else (phones, tablets, short windows, Lite, reduced motion): the phase-3 native
 * scroll-snap carousel; the counter follows the swiped card. `data-pin="on|off"` tells the CSS
 * which one JS chose (before hydration CSS decides from the media query + `html[data-lite]`).
 */
export function ShowcaseMotion({ accents, labelledBy, className, children }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const { ready, lite } = useMotionGate();
  const count = accents.length;

  // Card → Project Stage: remember the cover's rect for the shared-element transition.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    el.addEventListener("click", handOffCardClick);
    return () => el.removeEventListener("click", handOffCardClick);
  }, []);

  useGSAP(
    () => {
      const wrap = root.current;
      if (!ready || !wrap) return;
      const track = wrap.querySelector<HTMLElement>("[data-showcase-track]");
      const bg = wrap.querySelector<HTMLElement>("[data-showcase-bg]");
      const indexEl = wrap.querySelector<HTMLElement>("[data-showcase-index]");
      const rail = wrap.querySelector<HTMLElement>("[data-showcase-progress]");
      if (!track) return;
      const cards = gsap.utils.toArray<HTMLElement>("[data-card]", track);
      if (cards.length === 0) return;
      const setRail = rail ? gsap.quickSetter(rail, "scaleX") : () => {};

      let shown = -1; // forces the first write (a previous run may have left another number)
      const showIndex = (i: number) => {
        if (i === shown) return;
        shown = i;
        if (indexEl) indexEl.textContent = pad2(i + 1);
      };

      // ── Carousel: the counter + progress rail follow the native horizontal scroll ─────
      const carousel = () => {
        let frame = 0;
        const update = () => {
          frame = 0;
          const max = track.scrollWidth - track.clientWidth;
          if (max <= 1) {
            setRail(1);
            showIndex(0);
            return;
          }
          setRail(track.scrollLeft / max);
          // Snapped card = the one whose start is nearest the first card's resting place.
          const origin = cards[0].offsetLeft;
          let best = 0;
          let gap = Infinity;
          cards.forEach((card, i) => {
            const distance = Math.abs(card.offsetLeft - origin - track.scrollLeft);
            if (distance < gap) [best, gap] = [i, distance];
          });
          // At the far end the last cartridge can't reach the snap line (the end cap follows it).
          if (track.scrollLeft >= max - 2) best = cards.length - 1;
          showIndex(best);
        };
        const onScroll = () => {
          if (!frame) frame = requestAnimationFrame(update);
        };
        track.addEventListener("scroll", onScroll, { passive: true });
        update();
        return () => {
          track.removeEventListener("scroll", onScroll);
          cancelAnimationFrame(frame);
        };
      };

      // ── Pinned: sticky stage (CSS) + scrubbed track (ScrollTrigger) ──────────────────
      const pinned = () => {
        const n = cards.length;
        track.scrollLeft = 0; // it may have been swiped natively before hydration
        wrap.dataset.scrub = ""; // CSS: the track stops being a scroller, GSAP moves it

        // Layout numbers, in the track's own (untransformed) coordinates. offsetLeft/Width ignore
        // transforms, so the scaled cards and the moved track never skew them.
        let distance = 0;
        let centers: number[] = [];
        const measure = () => {
          const cap = track.lastElementChild as HTMLElement | null;
          const padEnd = parseFloat(getComputedStyle(track).paddingRight) || 0;
          const end = cap ? cap.offsetLeft + cap.offsetWidth + padEnd : track.scrollWidth;
          distance = Math.max(0, end - track.clientWidth);
          centers = cards.map((card) => card.offsetLeft + card.offsetWidth / 2);
        };
        measure();
        // "refreshInit" fires at the start of every ScrollTrigger.refresh(), before start/end and
        // the invalidated tween values are recalculated — the right moment to re-measure.
        ScrollTrigger.addEventListener("refreshInit", measure);

        let active = -1;
        const activate = (i: number, instant = false) => {
          if (i === active) return;
          active = i;
          const duration = instant ? 0 : 0.5;
          cards.forEach((card, j) => {
            const on = j === i;
            card.toggleAttribute("data-active", on);
            gsap.to(card, {
              scale: on ? 1.03 : 0.97,
              y: on ? -10 : 0,
              duration,
              ease: "power3.out",
              overwrite: "auto",
            });
          });
          if (bg) {
            // The one non-transform tween (spec §2 asks for the colour change): a solid layer.
            gsap.to(bg, {
              backgroundColor: accents[i],
              duration: instant ? 0 : 0.6,
              ease: "power2.out",
              overwrite: "auto",
            });
          }
          showIndex(i);
        };

        const sync = (progress: number) => {
          setRail(progress);
          const x = -progress * distance;
          // The focus line moves from the first card's centre (progress 0) to where the last
          // card's centre ends up (progress 1), so every card gets a fair share of the scroll.
          const first = centers[0];
          const focus = first + progress * (centers[n - 1] - distance - first);
          let best = 0;
          let gap = Infinity;
          centers.forEach((center, i) => {
            const d = Math.abs(center + x - focus);
            if (d < gap) [best, gap] = [i, d];
          });
          activate(best);
        };

        activate(0, true);

        const tween = gsap.fromTo(
          track,
          { x: 0 },
          {
            x: () => -distance, // function-based: re-evaluated on refresh (invalidateOnRefresh)
            ease: "none", // linear: the track position maps 1:1 to the scroll position
            scrollTrigger: {
              trigger: wrap,
              start: "top top", // the stage reaches the top: sticky kicks in
              end: "bottom bottom", // the wrapper's end reaches the bottom: sticky lets go
              scrub: true,
              invalidateOnRefresh: true,
              onUpdate: (self) => sync(self.progress),
              onRefresh: (self) => sync(self.progress),
            },
          },
        );

        // The stage background fades in as the stage rises into view (before the pin starts).
        if (bg) {
          gsap.fromTo(
            bg,
            { opacity: 0 },
            {
              opacity: 1,
              ease: "none",
              scrollTrigger: { trigger: wrap, start: "top 70%", end: "top top", scrub: true },
            },
          );
        }

        // Keyboard: Tab to a cartridge → scroll to where it is the active one (it may be off to
        // the side otherwise). Mouse clicks focus too, but without :focus-visible: ignored.
        const onFocus = (event: FocusEvent) => {
          const target = event.target instanceof Element ? event.target : null;
          if (!target?.matches(":focus-visible")) return;
          const st = tween.scrollTrigger;
          const item = target.closest("li");
          if (!st || !item) return;
          const i = cards.indexOf(item);
          const span = centers[n - 1] - centers[0];
          const progress = i < 0 ? 1 : span > 0 ? (centers[i] - centers[0]) / span : 0;
          const y = st.start + progress * (st.end - st.start);
          if (Math.abs(window.scrollY - y) > 4) scrollToTarget(y);
        };
        track.addEventListener("focusin", onFocus);

        return () => {
          ScrollTrigger.removeEventListener("refreshInit", measure);
          track.removeEventListener("focusin", onFocus);
          cards.forEach((card) => card.removeAttribute("data-active"));
          delete wrap.dataset.scrub;
        };
      };

      const mm = gsap.matchMedia();
      // matchMedia only calls back while at least one condition matches: `all` always does, so
      // the carousel branch runs too (and the callback re-runs whenever `pin` / `reduce` flip).
      mm.add({ all: "all", pin: PIN_QUERY, reduce: MEDIA.reduce }, (ctx) => {
        const { pin, reduce } = ctx.conditions as { pin: boolean; reduce: boolean };
        const on = pin && !reduce && !lite && cards.length >= 2;
        const before = wrap.dataset.pin;
        wrap.dataset.pin = on ? "on" : "off";
        // The page height may have changed (sticky span added/removed, or JS chose differently
        // from the first-paint CSS): re-measure every other trigger (batched, cheap).
        if (before !== wrap.dataset.pin) refreshScrollTriggers();
        return on ? pinned() : carousel();
      });

      return () => {
        delete wrap.dataset.pin;
      };
    },
    { scope: root, dependencies: [ready, lite], revertOnUpdate: true },
  );

  return (
    <div
      ref={root}
      role="region"
      aria-labelledby={labelledBy}
      className={cn("hk-showcase", className)}
      style={{ "--count": count } as React.CSSProperties}
      data-showcase
      data-pinnable={count >= 2 ? "" : undefined}
    >
      {children}
    </div>
  );
}
