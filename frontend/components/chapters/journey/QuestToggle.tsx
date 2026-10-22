"use client";

import { useEffect, useRef, useState } from "react";

import { refreshScrollTriggers, useMotionGate } from "@/components/chapters/shared/motion";
import { completeStageHint } from "@/components/game/useStageHint";
import { MEDIA, useGSAP } from "@/lib/gsap";

import { toggleQuestEntry } from "./layout";

type Props = {
  titleId: string;
  /** id of the entry's [data-accordion-body]; null when the entry has nothing to fold. */
  bodyId: string | null;
  title: string;
  /** Position in the log: the first entry starts open. */
  index: number;
};

/**
 * The title of a quest entry, which becomes its accordion button once JavaScript runs
 * (WAI-ARIA accordion: a heading that contains a button with aria-expanded/aria-controls).
 * Server HTML and Lite mode: every entry is open, the title is plain text. With motion on:
 * collapsed by default, the first entry open. The open state lives on the entry as
 * `data-open`, which the CSS uses to hide [data-accordion-body].
 */
export function QuestToggle({ titleId, bodyId, title, index }: Props) {
  const ref = useRef<HTMLHeadingElement>(null);
  const { ready, lite } = useMotionGate();
  const enhanced = ready && bodyId !== null;

  // null = the visitor hasn't touched it: follow the default (open in Lite, else only the first).
  const [choice, setChoice] = useState<boolean | null>(null);
  const open = choice ?? (lite || index === 0);
  const animating = useRef(false);

  const { contextSafe } = useGSAP({ scope: ref });

  // Default / Lite changes are applied instantly; a click animates (and owns the DOM meanwhile).
  useEffect(() => {
    const entry = ref.current?.closest<HTMLElement>("[data-accordion]");
    if (!enhanced || !entry || animating.current) return;
    if (entry.dataset.open === String(open)) return;
    entry.dataset.open = String(open);
    refreshScrollTriggers();
  }, [enhanced, open]);

  // Wrapped in contextSafe at click time: the timeline joins this component's GSAP context.
  const toggle = () =>
    contextSafe(() => {
      const entry = ref.current?.closest<HTMLElement>("[data-accordion]");
      if (!entry) return;
      const next = !open;
      const animate = !lite && !window.matchMedia(MEDIA.reduce).matches;
      animating.current = true;
      setChoice(next);
      toggleQuestEntry(entry, next, animate, () => {
        animating.current = false;
      });
      completeStageHint("journey");
    })();

  return (
    <h3 ref={ref} id={titleId} className="pr-12 text-2xl leading-tight font-bold md:text-[1.75rem]">
      {enhanced ? (
        <button
          type="button"
          className="hk-quest-toggle"
          aria-expanded={open}
          aria-controls={bodyId ?? undefined}
          onClick={toggle}
        >
          {title}
          <span aria-hidden="true" className="hk-quest-sign hk-pixel">
            {open ? "−" : "+"}
          </span>
        </button>
      ) : (
        title
      )}
    </h3>
  );
}
