"use client";

import { useEffect, useRef } from "react";

import { gsap } from "@/lib/gsap";

/**
 * XP bar = total scroll progress of the page (spec §5), drawn with transform: scaleX only.
 *
 * Why a plain scroll listener and not a ScrollTrigger: a ScrollTrigger caches its start/end and
 * goes stale when the page height changes (route change, accordion, images) until someone calls
 * refresh(). So the scrollable height is read on every (rAF-throttled) update instead. Caching it
 * behind a ResizeObserver on <body> was tried and went stale: absolutely positioned layers (the
 * avatar path, pin spacers) change the scroll height without resizing <body>. The read costs
 * ~0.2 ms per frame. It works both with Lenis (which moves the real window scroll position every
 * frame, so native scroll events still fire) and with native scrolling in Lite mode.
 */
export function XpBar({ className }: { className?: string }) {
  const fill = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = fill.current;
    if (!el) return;
    const setScale = gsap.quickSetter(el, "scaleX");
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScale(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // The page height changes without scrolling (client navigation, expanding content).
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <span className={className} aria-hidden="true">
      <span ref={fill} className="hk-xp-fill" />
    </span>
  );
}
