"use client";

/**
 * The only place GSAP plugins are registered (spec §11). Import gsap and every plugin from here,
 * never from "gsap/*" directly, so registration always happened before use.
 * All plugins are free since GSAP 3.13 (SplitText, Flip, MotionPath, Draggable, Inertia, Observer).
 */
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { Flip } from "gsap/Flip";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { Observer } from "gsap/Observer";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(
    useGSAP,
    ScrollTrigger,
    SplitText,
    Flip,
    MotionPathPlugin,
    Draggable,
    InertiaPlugin,
    Observer,
  );
}

/**
 * gsap.matchMedia() conditions shared by every animation. Use as:
 * `mm.add(MEDIA, (ctx) => { const { desktop, reduce } = ctx.conditions!; … })`.
 * `reduce` is the OS setting; Lite mode (manual toggle) is checked separately via useLiteMode().
 */
export const MEDIA = {
  desktop: "(min-width: 768px)",
  mobile: "(max-width: 767.98px)",
  reduce: "(prefers-reduced-motion: reduce)",
  finePointer: "(hover: hover) and (pointer: fine)",
} as const;

export {
  Draggable,
  Flip,
  gsap,
  InertiaPlugin,
  MotionPathPlugin,
  Observer,
  ScrollTrigger,
  SplitText,
  useGSAP,
};
