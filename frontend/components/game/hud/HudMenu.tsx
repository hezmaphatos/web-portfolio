"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

import { scrollToTarget } from "@/components/providers/SmoothScroll";
import type { SectionKey } from "@/lib/types";
import { pad2 } from "@/lib/utils";

export type MenuChapter = { key: SectionKey; title: string; level: number };

/** Plain names next to the game titles, as in each chapter heading ("LV 02 · About"). */
const PLAIN: Partial<Record<SectionKey, string>> = {
  hero: "Start",
  about: "About",
  journey: "Journey",
  skills: "Skills",
  projects: "Projects",
  trophies: "Awards",
  contact: "Contact",
};

type Props = {
  chapters: MenuChapter[];
  /** Extra controls inside the panel (the Sound/Lite toggles on phones). */
  children?: ReactNode;
};

/**
 * Minimal chapter menu for phase 4: a <details> disclosure with plain anchor links, so it works
 * with JavaScript off too. With JS, links scroll smoothly (Lenis) on Home and move focus to the
 * chapter heading; Esc or a click outside closes it. Phase 5 replaces the panel with the full
 * clip-path chapter-map overlay (spec §4.1 "Navigasi").
 */
export function HudMenu({ chapters, children }: Props) {
  const details = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const el = details.current;
    const close = (focusSummary: boolean) => {
      if (!el) return;
      el.open = false;
      if (focusSummary) el.querySelector("summary")?.focus();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    const onPointer = (event: PointerEvent) => {
      if (el && !el.contains(event.target as Node)) close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const go = (key: SectionKey) => (event: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(key);
    // Not on Home (or the chapter is hidden): let the link navigate to /#key.
    if (!target || target.getClientRects().length === 0) return;
    event.preventDefault();
    if (details.current) details.current.open = false;
    scrollToTarget(target);
    const heading = target.querySelector<HTMLElement>("h1, h2");
    if (heading) {
      if (!heading.hasAttribute("tabindex")) {
        heading.setAttribute("tabindex", "-1");
        heading.addEventListener("blur", () => heading.removeAttribute("tabindex"), { once: true });
      }
      heading.setAttribute("data-focus-target", "");
      heading.focus({ preventScroll: true });
    }
  };

  return (
    <details
      ref={details}
      className="hk-hud-menu"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="hk-hud-btn" aria-label="Menu">
        {open ? (
          <X aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
        ) : (
          <Menu aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
        )}
        <span aria-hidden="true" className="hidden lg:inline">
          Menu
        </span>
      </summary>
      <div className="hk-hud-panel-pop">
        <nav aria-label="Chapters">
          <p className="hk-pixel mb-2 text-[0.6875rem] opacity-70">Level map</p>
          <ol className="grid gap-1">
            {chapters.map((chapter) => (
              <li key={chapter.key}>
                <a href={`/#${chapter.key}`} className="hk-hud-link" onClick={go(chapter.key)}>
                  <span className="hk-pixel text-[0.6875rem] opacity-70">
                    LV {pad2(chapter.level)}
                  </span>
                  <span className="font-semibold">{chapter.title}</span>
                  {PLAIN[chapter.key] ? (
                    <span className="text-ink-2 ml-auto text-xs">{PLAIN[chapter.key]}</span>
                  ) : null}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        {children}
      </div>
    </details>
  );
}
