"use client";

import { useSyncExternalStore } from "react";

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
export function useMotionGate(): { ready: boolean; lite: boolean } {
  const mounted = useMounted();
  const prefsReady = usePrefsStore((state) => state.hydrated);
  const lite = useLiteMode();
  return { ready: mounted && prefsReady, lite };
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
