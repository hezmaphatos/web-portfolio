"use client";

import type { MouseEvent, ReactNode } from "react";

import { scrollToTarget } from "@/components/providers/SmoothScroll";
import { focusElement } from "@/components/ui/focus";

/**
 * The footer's "Play again" (spec §4.1 contact): back to the top of the level. A real
 * `<a href="#main">`, so it works without JavaScript; with JS it scrolls smoothly (Lenis; instant
 * in Lite / reduced motion) and hands keyboard focus to the Hero title.
 * Phase 7 adds the "rewind" animation on top of this scroll.
 */
export function PlayAgainLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    scrollToTarget(0);
    const target = document.getElementById("hero-title") ?? document.getElementById("main");
    if (target) focusElement(target);
  };

  return (
    <a href="#main" data-play-again className={className} onClick={onClick}>
      {children}
    </a>
  );
}
