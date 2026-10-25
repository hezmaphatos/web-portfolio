"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { refreshScrollTriggers, useMotionGate } from "@/components/chapters/shared/motion";
import { gsap, MEDIA, useGSAP } from "@/lib/gsap";

import { useMediaQuery } from "./treeFocus";

type Props = {
  /** id of the branch's [data-branch-body] list. */
  bodyId: string;
  /** Position of the branch in the tree: the first one starts open on phones. */
  index: number;
  className?: string;
  /** The heading content (diamond, category name, count), server-rendered. */
  children: ReactNode;
};

/**
 * Heading of a skill branch. On phones (< 768 px, spec §4.1 "Mobile: kartu kategori yang bisa
 * di-collapse") it becomes the button of a collapsible category card (aria-expanded): collapsed by
 * default except the first, all open in Lite mode — like the Quest Log. The open state lives on
 * the branch as `data-open`, which the CSS uses to hide [data-branch-body] (phones only).
 * Server HTML, no JS and desktop: a plain heading, every branch open.
 */
export function BranchToggle({ bodyId, index, className, children }: Props) {
  const ref = useRef<HTMLHeadingElement>(null);
  const { ready, lite } = useMotionGate();
  const mobile = useMediaQuery(MEDIA.mobile);
  const enhanced = ready && mobile;

  // null = untouched: follow the default (open in Lite, otherwise only the first branch).
  const [choice, setChoice] = useState<boolean | null>(null);
  const open = choice ?? (lite || index === 0);

  useEffect(() => {
    const branch = ref.current?.closest<HTMLElement>("[data-branch]");
    if (!branch) return;
    const next = enhanced ? String(open) : undefined;
    if (branch.dataset.open === next) return;
    if (next === undefined) delete branch.dataset.open;
    else branch.dataset.open = next;
    refreshScrollTriggers();
  }, [enhanced, open]);

  const { contextSafe } = useGSAP({ scope: ref });

  // Opening: the list appears (layout, instant) and fades/slides in; closing is instant.
  const toggle = () =>
    contextSafe(() => {
      const next = !open;
      setChoice(next);
      const body = document.getElementById(bodyId);
      const animate = !lite && !window.matchMedia(MEDIA.reduce).matches;
      if (!next || !body || !animate) return;
      gsap.fromTo(
        body,
        { opacity: 0, y: -10 },
        { opacity: 1, y: 0, duration: 0.3, ease: "power2.out", clearProps: "opacity,transform" },
      );
    })();

  return (
    <h3 ref={ref} className={className}>
      {enhanced ? (
        <button
          type="button"
          className="hk-branch-toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={toggle}
        >
          {children}
          <span aria-hidden="true" className="hk-branch-sign hk-pixel">
            {open ? "−" : "+"}
          </span>
        </button>
      ) : (
        children
      )}
    </h3>
  );
}
