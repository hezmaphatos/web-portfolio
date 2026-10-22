"use client";

import Lenis from "lenis";
import { useEffect, type ReactNode } from "react";
import { create } from "zustand";

import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useLiteMode } from "@/lib/store";

/**
 * Lenis smooth scroll, kept in sync with GSAP ScrollTrigger — in this one file only (spec §11):
 * Lenis tells ScrollTrigger about every scroll, and GSAP's ticker drives Lenis, so both use the
 * same frame clock (no double rAF loop, no drift between scrubbed animations and the page).
 * Off in Lite mode: native scrolling, nothing smoothed.
 */

type ScrollState = { lenis: Lenis | null; locks: number };

const useScrollStore = create<ScrollState>()(() => ({ lenis: null, locks: 0 }));

/** The running Lenis instance, or null (Lite mode, server, not mounted yet). */
export const useLenis = () => useScrollStore((state) => state.lenis);

/** Smooth-scrolls to an element/selector/offset; instant when Lenis is off (Lite / reduced). */
export function scrollToTarget(
  target: string | HTMLElement | number,
  options?: { offset?: number },
) {
  const lenis = useScrollStore.getState().lenis;
  if (lenis) {
    lenis.scrollTo(target, { offset: options?.offset ?? 0 });
    return;
  }
  if (typeof target === "number") {
    window.scrollTo({ top: target });
    return;
  }
  const element = typeof target === "string" ? document.querySelector(target) : target;
  element?.scrollIntoView({ block: "start" });
}

/**
 * Locks page scrolling (splash screen, modals). Nested locks are counted; the page scrolls again
 * when every lock is released. Returns the release function.
 */
export function lockScroll(): () => void {
  const state = useScrollStore.getState();
  useScrollStore.setState({ locks: state.locks + 1 });
  apply();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    useScrollStore.setState({ locks: Math.max(0, useScrollStore.getState().locks - 1) });
    apply();
  };
}

function apply() {
  const { lenis, locks } = useScrollStore.getState();
  const locked = locks > 0;
  if (lenis) {
    if (locked) lenis.stop();
    else lenis.start();
  }
  document.documentElement.style.overflow = locked ? "hidden" : "";
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  const lite = useLiteMode();

  useEffect(() => {
    // Fonts change line heights, so trigger positions are measured again once they are in.
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (!cancelled) ScrollTrigger.refresh();
    });
    if (lite) return () => void (cancelled = true);

    const lenis = new Lenis({ autoRaf: false, anchors: true, stopInertiaOnNavigate: true });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000); // GSAP time is in seconds
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0); // no catch-up jumps after a long frame: Lenis owns the timing

    useScrollStore.setState({ lenis });
    apply(); // honour a lock taken before Lenis existed (the splash)

    return () => {
      cancelled = true;
      gsap.ticker.remove(tick);
      lenis.destroy();
      useScrollStore.setState({ lenis: null });
    };
  }, [lite]);

  return <>{children}</>;
}
