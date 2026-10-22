"use client";

import { useRef, type ReactNode } from "react";

import { setupCounters } from "@/components/chapters/shared/countUp";
import { refreshScrollTriggers, useMotionGate } from "@/components/chapters/shared/motion";
import { completeStageHint, useStageHint } from "@/components/game/useStageHint";
import { Flip, gsap, MEDIA, ScrollTrigger, useGSAP } from "@/lib/gsap";

import { finishRunningLayout, setRunningLayout } from "./layout";

type Props = { className?: string; hint: string | null; children: ReactNode };

/**
 * Client island of Chapter 3 — QUEST LOG (spec §4.1 journey), wrapping server-rendered content:
 * - filter tabs: the radios keep working without JS (CSS `:has(:checked)`); with JS the wrapper
 *   gets `data-filter`, which the CSS follows instead, so the old layout can be recorded first
 *   and Flip animates the reorder;
 * - [data-progress-rail] fills (scaleY) as you scroll through [data-quest-log];
 * - the entry crossing the viewport's middle gets `data-active` (its sticky [data-period]
 *   lights up);
 * - [data-counter] metrics count up; the stage hint is registered here.
 */
export function JourneyMotion({ className, hint, children }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const { ready, lite } = useMotionGate();

  useStageHint("journey", hint, root);

  useGSAP(
    (_context, contextSafe) => {
      const wrap = root.current;
      if (!ready || !wrap || !contextSafe) return;

      // ── Filter ──────────────────────────────────────────────────────────
      const radios = Array.from(
        wrap.querySelectorAll<HTMLInputElement>('input[name="quest-filter"]'),
      );
      const checked = radios.find((radio) => radio.checked);
      wrap.dataset.filter = checked?.value ?? "all"; // from now on CSS follows this attribute

      const onChange = contextSafe((event: Event) => {
        const value = (event.target as HTMLInputElement).value;
        const entries = Array.from(wrap.querySelectorAll<HTMLElement>("[data-accordion]"));
        finishRunningLayout();
        completeStageHint("journey");
        const animate = !lite && !window.matchMedia(MEDIA.reduce).matches;

        // FLIP: First (record where every entry is) → Last (apply the filter) → Invert + Play
        // (Flip.from moves each entry back to where it was with transforms, then animates them
        // to their new place).
        const state = animate ? Flip.getState(entries) : null;
        wrap.dataset.filter = value;
        if (!state) {
          refreshScrollTriggers();
          return;
        }
        const timeline = Flip.from(state, {
          duration: 0.55,
          ease: "power3.inOut",
          // Leaving entries are taken out of the flow (absolute) while they fade, so the ones
          // that stay can already move into their final places.
          absoluteOnLeave: true,
          onEnter: (elements) =>
            gsap.fromTo(
              elements,
              { opacity: 0, y: 32 },
              {
                opacity: 1,
                y: 0,
                duration: 0.45,
                delay: 0.12,
                ease: "power2.out",
                clearProps: "opacity,transform",
              },
            ),
          onLeave: (elements) => gsap.to(elements, { opacity: 0, scale: 0.96, duration: 0.25 }),
          onComplete: refreshScrollTriggers,
        });
        setRunningLayout(timeline);
      });
      radios.forEach((radio) => radio.addEventListener("change", onChange));

      // ── Scroll motion ───────────────────────────────────────────────────
      const mm = gsap.matchMedia();
      mm.add(
        { motionOk: "(prefers-reduced-motion: no-preference)", reduce: MEDIA.reduce },
        (ctx) => {
          if (lite || ctx.conditions?.reduce) return;

          const log = wrap.querySelector<HTMLElement>("[data-quest-log]");
          const rail = wrap.querySelector<HTMLElement>("[data-progress-rail]");
          if (log && rail) {
            gsap.fromTo(
              rail,
              { scaleY: 0 },
              {
                scaleY: 1,
                ease: "none", // linear: the fill tracks the scroll position 1:1
                scrollTrigger: { trigger: log, start: "top 60%", end: "bottom 60%", scrub: true },
              },
            );
          }

          // "Active period": the last visible entry whose top has crossed the line at 55 % of the
          // viewport — it stays active across the gap to the next one, and hidden (filtered)
          // entries are simply skipped, so the filter never needs new triggers.
          const entries = Array.from(wrap.querySelectorAll<HTMLElement>("[data-accordion]"));
          let current: HTMLElement | null = null;
          const pick = (inside: boolean) => {
            let next: HTMLElement | null = null;
            if (inside) {
              const line = window.innerHeight * 0.55;
              for (const entry of entries) {
                const box = entry.getBoundingClientRect();
                if (box.height > 0 && box.top <= line) next = entry;
              }
            }
            if (next === current) return;
            current?.removeAttribute("data-active");
            next?.setAttribute("data-active", "");
            current = next;
          };
          if (log) {
            ScrollTrigger.create({
              trigger: log,
              start: "top 55%",
              end: "bottom 55%",
              onUpdate: (self) => pick(self.isActive),
              onToggle: (self) => pick(self.isActive),
              onRefresh: (self) => pick(self.isActive), // after a filter/accordion re-measure
            });
          }

          const restoreCounters = setupCounters(wrap);
          return () => {
            restoreCounters();
            entries.forEach((entry) => entry.removeAttribute("data-active"));
          };
        },
      );

      return () => {
        radios.forEach((radio) => radio.removeEventListener("change", onChange));
        finishRunningLayout();
        delete wrap.dataset.filter; // back to the CSS-only filter (same radio state)
      };
    },
    { scope: root, dependencies: [ready, lite], revertOnUpdate: true },
  );

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
