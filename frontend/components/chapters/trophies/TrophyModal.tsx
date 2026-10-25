"use client";

import { ArrowUpRight, X } from "lucide-react";
import { animate, usePresence, type AnimationPlaybackControlsWithThen } from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef } from "react";

import { Media } from "@/components/ui/Media";
import { cn } from "@/lib/utils";
import type { Award } from "@/lib/types";

import { awardText } from "./award";
import { Medal, MEDALS } from "./Medal";

type Props = {
  award: Award;
  /** The card it was opened from: the panel grows out of it and shrinks back into it. */
  origin: HTMLElement | null;
  /** Lite / reduced motion: a plain fade, no zoom. */
  still: boolean;
  onClose: () => void;
};

type Box = { left: number; top: number; width: number; height: number };

/** Quart-out: quick start, soft landing (slow enough to see the card lift). */
const EASE_OUT = [0.25, 1, 0.5, 1] as const;
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

/** The transform that puts a box laid out at `to` exactly over `from` (FLIP "invert"). */
function invert(from: Box, to: Box) {
  return {
    x: from.left + from.width / 2 - (to.left + to.width / 2),
    y: from.top + from.height / 2 - (to.top + to.height / 2),
    scaleX: from.width / to.width,
    scaleY: from.height / to.height,
  };
}

const usable = (box: Box | null | undefined): box is Box =>
  !!box && box.width > 0 && box.height > 0;

/**
 * The trophy detail dialog (spec §4.1 trophies): the award, its certificate image (or the
 * generative placeholder) and the link. A child of <AnimatePresence> in <TrophyRoom>, which owns
 * the modal behaviour (scroll lock, inert page, focus trap, Esc, focus return).
 *
 * Shared-element feel without sharing a component: the panel is laid out at its final place,
 * then transformed to sit exactly on the card (FLIP) and animated back to identity, so the card
 * seems to lift off the shelf; closing shrinks it back onto the card. Transform + opacity only.
 */
export function TrophyModal({ award, origin, still, onClose }: Props) {
  const scope = useRef<HTMLDivElement>(null);
  /**
   * Motion's standalone animate(), tracked so an unmount stops whatever still runs. (useAnimate()
   * would do that too, but it reads the OS setting through useReducedMotion(), which logs a dev
   * warning on every reduced-motion device; `still` already covers that case here.)
   */
  const running = useRef<AnimationPlaybackControlsWithThen[]>([]);
  const [isPresent, safeToRemove] = usePresence();
  const closeButton = useRef<HTMLButtonElement>(null);
  /** The panel's untransformed box, measured once on open (the page cannot scroll meanwhile). */
  const layout = useRef<Box | null>(null);
  const titleId = useId();

  const { headline, facts, meta } = awardText(award);
  const gold = MEDALS.includes(award.placement);
  const kicker = [meta, award.year].filter(Boolean).join(" · ");

  useEffect(() => {
    const list = running.current;
    return () => list.forEach((controls) => controls.stop());
  }, []);

  // Enter. A layout effect: the starting transform is in place before the first paint.
  // Each run stops what it started (React's dev Strict Mode runs it twice on mount) and clears
  // the inline transform before measuring, so the panel is measured where the layout put it.
  useLayoutEffect(() => {
    const started: AnimationPlaybackControlsWithThen[] = [];
    const keep = (controls: AnimationPlaybackControlsWithThen) => {
      started.push(controls);
      running.current.push(controls);
    };
    const stop = () => started.forEach((controls) => controls.stop());
    const root = scope.current;
    const panel = root?.querySelector<HTMLElement>("[data-modal-panel]");
    if (!root || !panel) return;
    panel.style.transform = "";
    panel.style.opacity = "";
    const box = panel.getBoundingClientRect();
    layout.current = box;
    closeButton.current?.focus({ preventScroll: true });

    const parts = root.querySelectorAll<HTMLElement>("[data-modal-part]");
    const backdrop = root.querySelector<HTMLElement>("[data-modal-backdrop]");

    if (still) {
      const layers = backdrop ? [backdrop, panel] : [panel];
      layers.forEach((el) => (el.style.opacity = "0"));
      keep(animate(layers, { opacity: 1 }, { duration: 0.15 }));
      return stop;
    }

    const from = origin?.isConnected ? origin.getBoundingClientRect() : null;
    if (backdrop) backdrop.style.opacity = "0";
    parts.forEach((part) => (part.style.opacity = "0"));

    if (backdrop) keep(animate(backdrop, { opacity: 1 }, { duration: 0.3 }));
    if (usable(from) && usable(box)) {
      const start = invert(from, box);
      panel.style.transform = `translate(${start.x}px, ${start.y}px) scale(${start.scaleX}, ${start.scaleY})`;
      keep(
        animate(
          panel,
          {
            x: [start.x, 0],
            y: [start.y, 0],
            scaleX: [start.scaleX, 1],
            scaleY: [start.scaleY, 1],
          },
          { duration: 0.55, ease: EASE_OUT },
        ),
      );
    } else {
      panel.style.opacity = "0";
      keep(animate(panel, { opacity: [0, 1], y: [24, 0] }, { duration: 0.3, ease: EASE_OUT }));
    }
    // The content fades in once the frame is most of the way there (it is distorted before).
    keep(animate(parts, { opacity: 1 }, { delay: 0.18, duration: 0.25 }));
    return stop;
    // Runs once per opened dialog (the dialog is keyed by award).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Exit: AnimatePresence keeps the dialog mounted until safeToRemove().
  useEffect(() => {
    if (isPresent) return;
    const root = scope.current;
    const panel = root?.querySelector<HTMLElement>("[data-modal-panel]");
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      safeToRemove?.();
    };
    if (!root || !panel) return finish();
    const keep = (controls: AnimationPlaybackControlsWithThen) => {
      running.current.push(controls);
      return controls;
    };

    const run = async () => {
      if (still) {
        await keep(animate(root, { opacity: 0 }, { duration: 0.12 }));
        return;
      }
      const parts = root.querySelectorAll<HTMLElement>("[data-modal-part]");
      const backdrop = root.querySelector<HTMLElement>("[data-modal-backdrop]");
      const to = origin?.isConnected ? origin.getBoundingClientRect() : null;
      const box = layout.current;
      keep(animate(parts, { opacity: 0 }, { duration: 0.1 }));
      if (backdrop) keep(animate(backdrop, { opacity: 0 }, { duration: 0.34 }));
      if (usable(to) && usable(box)) {
        await keep(animate(panel, invert(to, box), { duration: 0.34, ease: EASE_IN_OUT }));
        await keep(animate(panel, { opacity: 0 }, { duration: 0.08 }));
      } else {
        await keep(animate(panel, { opacity: 0, scale: 0.96 }, { duration: 0.18 }));
      }
    };
    run().then(finish, finish);
  }, [isPresent, safeToRemove, still, origin]);

  return (
    <div ref={scope} className="hk-modal">
      <div data-modal-backdrop className="hk-modal-backdrop" aria-hidden="true" onClick={onClose} />
      <div className="hk-modal-frame">
        <div
          data-modal-panel
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={cn("hk-modal-panel", gold && "is-gold")}
        >
          <button
            ref={closeButton}
            type="button"
            data-modal-part
            className="hk-modal-close"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
          >
            <X aria-hidden="true" className="size-5" strokeWidth={2.5} />
          </button>

          {/* data-lenis-prevent: Lenis is stopped while the dialog is open and would otherwise
              swallow the wheel; this lets a tall dialog scroll natively inside itself. */}
          <div data-modal-part data-lenis-prevent className="hk-modal-body">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-8">
              <div className="min-w-0">
                <p className={cn("hk-pixel pr-24 text-xs", gold ? "text-lime" : "text-ink-2")}>
                  {kicker}
                </p>
                <h2
                  id={titleId}
                  className={cn(
                    "mt-3",
                    gold
                      ? "hk-display hk-condensed text-[clamp(2.25rem,6vw,3.5rem)] uppercase"
                      : "hk-display text-[clamp(1.875rem,5vw,2.75rem)] leading-[0.95]",
                  )}
                >
                  {headline}
                </h2>
                {facts.length > 0 ? (
                  <p className={cn("mt-4 font-semibold", gold && "text-lg")}>{facts.join(" · ")}</p>
                ) : null}
                {award.description ? (
                  <p className={cn("mt-2", gold ? "opacity-90" : "text-ink-2")}>
                    {award.description}
                  </p>
                ) : null}
                {award.url ? (
                  <a
                    href={award.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn("hk-btn mt-6", gold ? "hk-btn-hot" : "hk-btn-ink")}
                  >
                    View credential
                    <ArrowUpRight aria-hidden="true" className="size-4" />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : null}
              </div>

              <figure className="relative min-w-0">
                {gold ? (
                  <div className="hk-modal-medal">
                    <Medal placement={award.placement} className="w-full -rotate-6" />
                  </div>
                ) : null}
                <Media
                  media={award.image}
                  alt={`Certificate: ${headline}`}
                  seed={award.title}
                  ratio={4 / 3}
                  sizes="(min-width: 768px) 28rem, 90vw"
                  className={cn("border-2", gold ? "border-paper" : "border-ink")}
                />
                <figcaption className="hk-pixel mt-2 text-[0.6875rem] opacity-75">
                  Certificate{award.year ? ` · ${award.year}` : ""}
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
