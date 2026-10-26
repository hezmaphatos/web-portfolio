"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { useMotionGate, useMounted } from "@/components/chapters/shared/motion";
import { useStill } from "@/components/ui/useStill";
import { gsap, MEDIA, SplitText, useGSAP } from "@/lib/gsap";

import { useStageModal } from "../modal/context";
import { cardRectFor, flipFrom } from "../modal/flip";
import { useProjectView } from "./useProjectView";

type Props = {
  projectId: number;
  slug: string;
  accent: string;
  /** Id of the stage <h1>. */
  titleId: string;
  /** Send the view count (off for admin previews and drafts). */
  countView: boolean;
};

/**
 * Client island at the top of every Project Stage (page and modal). Renders nothing; it adds
 * the opening to the server-rendered stage around it ([data-stage]):
 * - the view count (once per opening);
 * - the shared-element hand-off: inside the modal it tells the shell (which opens out of the
 *   clicked card and flies [data-stage-cover] home); on the full page it flies the cover itself;
 * - the title (SplitText): letters rise in when the stage is mounted on the client (modal,
 *   next/previous); after a server render the title is already on screen, so it only gets a
 *   small hop that never hides it (no flash, LCP untouched). Lite / reduced motion: nothing.
 */
export function StageIntro({ projectId, slug, accent, titleId, countView }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const modal = useStageModal();
  const mounted = useMounted();
  // useMounted() is false while hydrating server HTML, true when React creates this on the
  // client; the first render's value says which one this stage is.
  const [clientMount] = useState(mounted);
  const { ready, lite } = useMotionGate();
  const still = useStill();
  const stillRef = useRef(still);

  useProjectView(slug, countView);

  useLayoutEffect(() => {
    stillRef.current = still;
  }, [still]);

  // Every mount and Activity re-show: hand the stage to the modal (or fly the cover here).
  // A layout effect, so the first painted frame already shows the starting state.
  useLayoutEffect(() => {
    const stage = ref.current?.closest<HTMLElement>("[data-stage]") ?? null;
    const cover = stage?.querySelector<HTMLElement>("[data-stage-cover]") ?? null;
    const from = cardRectFor(projectId);
    if (modal) {
      modal.announce({ titleId, accent, root: stage, cover, from });
      return;
    }
    if (!from || !cover || stillRef.current) return;
    const flight = flipFrom(cover, from);
    return () => flight?.stop();
  }, [modal, projectId, titleId, accent]);

  useGSAP(
    () => {
      if (!ready) return;
      const title = ref.current
        ?.closest("[data-stage]")
        ?.querySelector<HTMLElement>("[data-stage-title]");
      if (!title) return;

      const mm = gsap.matchMedia();
      mm.add(
        { motionOk: "(prefers-reduced-motion: no-preference)", reduce: MEDIA.reduce },
        (context) => {
          if (lite || context.conditions?.reduce) return;
          // words + chars: words stay unbreakable, so the title wraps exactly as before the split.
          // aria "auto": the <h1> gets an aria-label, the letter spans are hidden from readers.
          const split = SplitText.create(title, { type: "words,chars", aria: "auto" });
          const done = () => split.revert(); // plain text nodes again (kerning, text-wrap)
          if (clientMount) {
            gsap.from(split.chars, {
              yPercent: 80,
              opacity: 0,
              rotation: () => gsap.utils.random(-12, 12),
              duration: 0.7,
              ease: "back.out(1.7)",
              stagger: 0.022,
              delay: modal ? 0.14 : 0,
              onComplete: done,
            });
          } else {
            gsap.to(split.chars, {
              keyframes: { yPercent: [0, -14, 0], easeEach: "power2.inOut" },
              duration: 0.45,
              stagger: 0.025,
              onComplete: done,
            });
          }
        },
      );
      return () => mm.revert();
    },
    // `lite` is final once `ready` (prefs read); toggling Lite later must not replay the intro.
    { dependencies: [ready], revertOnUpdate: true },
  );

  return <span ref={ref} hidden data-stage-intro />;
}
