"use client";

import { useSyncExternalStore } from "react";

import { MEDIA } from "@/lib/gsap";
import { useLiteMode } from "@/lib/store";

function subscribe(callback: () => void) {
  const query = window.matchMedia(MEDIA.reduce);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

const reducedNow = () => window.matchMedia(MEDIA.reduce).matches;

/**
 * True when UI motion should collapse to plain fades: Lite mode (the toggle, or "auto" →
 * reduced motion / Save-Data) or the OS asking for reduced motion even with Lite switched off.
 * (Motion's own useReducedMotion() would do, but logs a dev warning on every such device.)
 * False on the server.
 */
export function useStill(): boolean {
  const lite = useLiteMode();
  const reduced = useSyncExternalStore(subscribe, reducedNow, () => false);
  return lite || reduced;
}
