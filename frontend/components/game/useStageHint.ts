"use client";

import { useEffect, type RefObject } from "react";

import { HINT_DELAY_MS, HINT_VISIBLE_RATIO, shouldAutoShowHint } from "@/lib/hints";
import { useGameStore, useHintStore, useHudStore } from "@/lib/store";

/*
 * Stage hints (spec §5.3), the stage side. A stage calls useStageHint(key, text, ref) once:
 * - its text is registered for the HUD Help (?) button and the "?" next to the chapter title;
 * - the hint opens by itself ±600 ms after the stage is ≥ 40 % visible, only if this save has
 *   never seen it (cookie `hints`, read after hydration) and the splash is over;
 * - an auto-opened hint closes again when its stage scrolls out of view (a hint opened with
 *   Help / "?" does not — it waits for the 7 s timer, ✕ or the action);
 * - completeStageHint(key) = "the visitor did what the hint asks": it closes and never auto-opens.
 * The card itself (timer, ✕, pause on hover) is <StageHintHost>.
 */

/** Stages completed during this visit: they never auto-open again, even before hydration ends. */
const completed = new Set<string>();

/** The visitor did the action a hint asks for: close it and remember it in the save. */
export function completeStageHint(key: string): void {
  completed.add(key);
  const game = useGameStore.getState();
  if (game.hydrated) {
    game.markHintSeen(key);
  } else {
    // A write before the cookie was read would be overwritten by it, so wait for hydration.
    const unsubscribe = useGameStore.subscribe((state) => {
      if (!state.hydrated) return;
      unsubscribe();
      state.markHintSeen(key);
    });
  }
  const { active, dismiss } = useHintStore.getState();
  if (active?.key === key) dismiss();
}

/**
 * How much of a stage is on screen, 0–1. A chapter taller than the viewport can never be 40 %
 * visible by area, so its visible height is measured against the viewport instead.
 */
export function visibleRatio(visibleHeight: number, stageHeight: number, viewport: number): number {
  const base = Math.min(stageHeight, viewport);
  return base > 0 ? visibleHeight / base : 0;
}

/** 1 % steps: precise enough for tall chapters, where 1 % of the area is only a few pixels. */
const THRESHOLDS = Array.from({ length: 101 }, (_, i) => i / 100);

/**
 * Registers a stage's hint and opens it once (see the top of this file). `ref` may point at any
 * element inside the stage; the closest `[data-chapter]` is what is measured.
 */
export function useStageHint(
  key: string,
  text: string | null | undefined,
  ref: RefObject<HTMLElement | null>,
): void {
  const register = useHintStore((state) => state.register);

  useEffect(() => {
    if (text) register(key, text);
  }, [key, text, register]);

  useEffect(() => {
    const node = ref.current;
    const stage = node?.closest<HTMLElement>("[data-chapter]") ?? node;
    if (!stage || !text) return;

    let visible = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const eligible = () => {
      const game = useGameStore.getState();
      const { active } = useHintStore.getState();
      return (
        game.hydrated && // the cookie decides "seen", so never guess before it is read
        useHudStore.getState().boot === "done" && // not under the splash
        !completed.has(key) &&
        shouldAutoShowHint(game.hints, key) &&
        active?.key !== key &&
        !active?.manual // never replace a hint the visitor asked for
      );
    };

    const cancel = () => {
      clearTimeout(timer);
      timer = undefined;
    };

    const open = () => {
      timer = undefined;
      if (!visible || !eligible()) return;
      const hints = useHintStore.getState();
      hints.show({ key, text: hints.texts[key] ?? text, manual: false });
      useGameStore.getState().markHintSeen(key); // once per stage, from now on
    };

    // Called on every visibility or store change: arms the 600 ms delay or cancels it.
    const evaluate = () => {
      if (visible && eligible()) {
        if (timer === undefined) timer = setTimeout(open, HINT_DELAY_MS);
      } else {
        cancel();
      }
    };

    const closeIfAuto = () => {
      const { active, dismiss } = useHintStore.getState();
      if (active?.key === key && !active.manual) dismiss();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        const viewport = entry.rootBounds?.height ?? window.innerHeight;
        const ratio = visibleRatio(
          entry.intersectionRect.height,
          entry.boundingClientRect.height,
          viewport,
        );
        const now = ratio >= HINT_VISIBLE_RATIO;
        if (now === visible) return;
        visible = now;
        if (!visible) closeIfAuto(); // scrolled on: this hint is about a stage that is gone
        evaluate();
      },
      { threshold: THRESHOLDS },
    );
    observer.observe(stage);

    const unsubscribers = [
      useGameStore.subscribe(evaluate),
      useHudStore.subscribe(evaluate),
      useHintStore.subscribe(evaluate),
    ];

    return () => {
      observer.disconnect();
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      cancel();
      closeIfAuto();
    };
  }, [key, text, ref]);
}
