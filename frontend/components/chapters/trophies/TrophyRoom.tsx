"use client";

import { AnimatePresence } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { useMotionGate, useMounted } from "@/components/chapters/shared/motion";
import { completeStageHint, useStageHint } from "@/components/game/useStageHint";
import { lockScroll } from "@/components/providers/SmoothScroll";
import { inertOutside, trapTab } from "@/components/ui/focus";
import { useStill } from "@/components/ui/useStill";
import { gsap, MEDIA, useGSAP } from "@/lib/gsap";
import { useHintStore } from "@/lib/store";
import type { Award } from "@/lib/types";

import { TrophyModal } from "./TrophyModal";

type RoomApi = { openAward: (awardId: number, trigger: HTMLElement) => void };

const RoomContext = createContext<RoomApi | null>(null);

/** For <AwardOpener>: null outside a <TrophyRoom>. */
export function useTrophyRoom(): RoomApi | null {
  return useContext(RoomContext);
}

type Props = {
  awards: Award[];
  /** sections.hint of Trophies ("Hover (or tap) a trophy to take a closer look."). */
  hint: string | null;
  className?: string;
  children: ReactNode;
};

type OpenAward = { award: Award; trigger: HTMLElement; card: HTMLElement | null };

/** Maximum tilt in degrees (around the horizontal / vertical axis). */
const TILT_X = 8;
const TILT_Y = 11;
/** Pointer moves over a card before the hover counts as "took a closer look" (not a fly-by). */
const HINT_MOVES = 10;

/**
 * The interactive layer of the Trophy Room (spec §4.1 trophies), around the server-rendered shelf:
 * - [data-tilt] cards tilt in 3D under a fine pointer (CSS transforms driven by GSAP quickTo,
 *   never three.js); gold cards also get a foil glint ([data-foil]). Off in Lite / reduced motion
 *   and on touch screens; every card settles back when the pointer leaves.
 * - <AwardOpener> buttons open the detail dialog (<TrophyModal>, Motion AnimatePresence),
 *   which is modal: scroll locked, the rest of the page inert, Tab trapped, Esc / ✕ / backdrop
 *   close it, and focus returns to the card's button.
 * - the Trophies stage hint, completed by the first real tilt or the first opened trophy.
 */
export function TrophyRoom({ awards, hint, className, children }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const resetTilt = useRef(new Map<HTMLElement, () => void>());
  const { ready, lite } = useMotionGate();
  const still = useStill();
  const mounted = useMounted();
  const [open, setOpen] = useState<OpenAward | null>(null);

  useStageHint("trophies", hint, root);

  useGSAP(
    () => {
      const shelf = root.current;
      if (!ready || lite || !shelf) return;
      const mm = gsap.matchMedia();
      mm.add({ fine: MEDIA.finePointer, reduce: MEDIA.reduce }, (ctx) => {
        const { fine, reduce } = ctx.conditions as { fine: boolean; reduce: boolean };
        if (!fine || reduce) return;
        const offs: Array<() => void> = [];

        for (const card of gsap.utils.toArray<HTMLElement>("[data-tilt]", shelf)) {
          const foil = card.querySelector<HTMLElement>("[data-foil]");
          // perspective() inside the card's own transform: no wrapper element needed.
          gsap.set(card, { transformPerspective: 900 });
          const rotateX = gsap.quickTo(card, "rotationX", { duration: 0.5, ease: "power3.out" });
          const rotateY = gsap.quickTo(card, "rotationY", { duration: 0.5, ease: "power3.out" });
          const foilX = foil
            ? gsap.quickTo(foil, "xPercent", { duration: 0.5, ease: "power3.out" })
            : null;
          let moves = 0;

          const reset = () => {
            rotateX(0);
            rotateY(0);
            if (foil) gsap.to(foil, { opacity: 0, duration: 0.3, overwrite: "auto" });
          };
          const enter = (event: PointerEvent) => {
            if (event.pointerType !== "mouse") return;
            moves = 0;
            if (foil) gsap.to(foil, { opacity: 1, duration: 0.25, overwrite: "auto" });
          };
          const move = (event: PointerEvent) => {
            if (event.pointerType !== "mouse") return;
            // The list item is never tilted itself, so its box is a stable reference.
            const box = (card.parentElement ?? card).getBoundingClientRect();
            const px = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) - 0.5;
            const py = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)) - 0.5;
            rotateX(-py * 2 * TILT_X); // pointer at the top edge → top leans back
            rotateY(px * 2 * TILT_Y);
            foilX?.(-100 + (px + 0.5) * 380); // the glint sweeps across with the pointer
            moves += 1;
            if (moves === HINT_MOVES) completeStageHint("trophies");
          };

          card.addEventListener("pointerenter", enter);
          card.addEventListener("pointermove", move);
          card.addEventListener("pointerleave", reset);
          resetTilt.current.set(card, reset);
          offs.push(() => {
            card.removeEventListener("pointerenter", enter);
            card.removeEventListener("pointermove", move);
            card.removeEventListener("pointerleave", reset);
            resetTilt.current.delete(card);
          });
        }
        return () => offs.forEach((off) => off());
      });
    },
    { scope: root, dependencies: [ready, lite], revertOnUpdate: true },
  );

  const openAward = useCallback(
    (awardId: number, trigger: HTMLElement) => {
      const award = awards.find((item) => item.id === awardId);
      if (!award) return;
      const card = trigger.closest<HTMLElement>("[data-tilt]");
      if (card) resetTilt.current.get(card)?.();
      completeStageHint("trophies");
      useHintStore.getState().dismiss(); // nothing floats over the dialog
      setOpen({ award, trigger, card });
    },
    [awards],
  );

  const close = useCallback(() => setOpen(null), []);
  const api = useMemo(() => ({ openAward }), [openAward]);

  // Modal behaviour while a trophy is open. The cleanup runs as soon as it closes (the panel
  // may still be animating out), so the page is usable and focus is back on the card at once.
  const trigger = open?.trigger ?? null;
  useEffect(() => {
    const host = layer.current;
    if (!trigger || !host) return;
    const releaseScroll = lockScroll();
    const restoreInert = inertOutside([host]);
    const root = document.documentElement;
    root.dataset.overlay = "dialog"; // tints the scrollbar gutter the lock leaves (CSS)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(null);
        return;
      }
      const dialog = host.querySelector<HTMLElement>("[role='dialog']");
      if (dialog) trapTab(event, dialog);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (root.dataset.overlay === "dialog") delete root.dataset.overlay;
      restoreInert();
      releaseScroll();
      if (trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [trigger]);

  return (
    <RoomContext.Provider value={api}>
      <div ref={root} className={className}>
        {children}
      </div>
      {mounted
        ? createPortal(
            <div ref={layer} className="hk-modal-layer">
              <AnimatePresence>
                {open ? (
                  <TrophyModal
                    key={open.award.id}
                    award={open.award}
                    origin={open.card}
                    still={still}
                    onClose={close}
                  />
                ) : null}
              </AnimatePresence>
            </div>,
            document.body,
          )
        : null}
    </RoomContext.Provider>
  );
}
