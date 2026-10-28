"use client";

import { type RefObject, useEffect, useState, useSyncExternalStore } from "react";

import { ScrollTrigger } from "@/lib/gsap";
import { useLiteMode, usePrefsStore } from "@/lib/store";

/*
 * Small helpers shared by the animated chapters (phase 4). Every chapter keeps its content in
 * server-rendered HTML; these hooks decide when the client may layer motion on top of it.
 */

const subscribeNothing = () => () => {};

/** False on the server and during hydration, true once mounted: parts that only work with JS. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

/**
 * `ready` turns true once the preferences are read (so `lite` is final and an animation never
 * starts only to be cut a frame later). Lite = the visitor's toggle or prefers-reduced-motion /
 * Save-Data; each animation also checks MEDIA.reduce inside gsap.matchMedia().
 */
export function useMotionGate(near?: RefObject<Element | null>): {
  ready: boolean;
  lite: boolean;
} {
  const mounted = useMounted();
  const prefsReady = usePrefsStore((state) => state.hydrated);
  const lite = useLiteMode();
  const close = useNearViewport(near);
  return { ready: mounted && prefsReady && close, lite };
}

/**
 * With a ref: false until the element is within one viewport of the screen, then true for good.
 * Chapters below the fold pass their root to useMotionGate() so their animation setup (SplitText,
 * ScrollTriggers, counters) is not part of the hydration task but runs in its own task, shortly
 * before the visitor gets there (phase 8B: the Home's longest main-thread task). The observer's
 * first callback is asynchronous, so even a chapter that is already close sets up after hydration.
 * Without a ref: always true.
 */
function useNearViewport(ref: RefObject<Element | null> | undefined): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref?.current;
    if (!el || near) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        setNear(true);
      },
      { rootMargin: "100% 0px 100% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, near]);
  return ref === undefined || near;
}

let refreshTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Re-measures every ScrollTrigger after the page height changed (accordion, filter). Batched:
 * several calls in a row cost one refresh.
 */
export function refreshScrollTriggers(): void {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 60);
}

/**
 * Runs a mouse-only setup (Draggable toys) the first time the pointer reaches `el`, not at
 * hydration: every Draggable.create forces a style recalc, and creating a few dozen of them made
 * the Home's longest main-thread task (phase 8B). A mouse always hovers before it presses, so the
 * drag is ready for the first press; a press that somehow comes first sets it up in the capture
 * phase, before the event reaches the Draggable's own listener. Returns the teardown.
 */
export function onFirstPointer(el: HTMLElement, setup: () => (() => void) | void): () => void {
  let teardown: (() => void) | void;
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    el.removeEventListener("pointerover", start);
    el.removeEventListener("pointerdown", start, true);
    teardown = setup();
  };
  el.addEventListener("pointerover", start);
  el.addEventListener("pointerdown", start, true);
  return () => {
    el.removeEventListener("pointerover", start);
    el.removeEventListener("pointerdown", start, true);
    teardown?.();
  };
}
