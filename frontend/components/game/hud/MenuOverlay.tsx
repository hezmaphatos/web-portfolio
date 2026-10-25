"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode, Ref } from "react";

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

export type MenuPhase = "closed" | "open" | "closing";

type Props = {
  id: string;
  overlayRef: Ref<HTMLDivElement>;
  phase: MenuPhase;
  chapters: MenuChapter[];
  onHome: boolean;
  /** location.pathname ("" before mount). */
  path: string;
  /** Chapter on screen (aria-current). */
  active: SectionKey | null;
  onChapter: (key: SectionKey) => (event: MouseEvent<HTMLAnchorElement>) => void;
  /** Any other link (Home, All projects): the menu closes and the link navigates. */
  onLeave: () => void;
  /** Extra controls (Sound / Lite on phones). */
  children?: ReactNode;
};

/**
 * The chapter map of the HUD menu (spec §4.1 "Navigasi"): a full-screen ink panel under the HUD
 * row, listing every visible chapter (number, stage title, plain name) plus Home / All projects.
 * Behaviour and animation live in <HudMenu>; this is the markup.
 * Server HTML keeps it hidden (visibility); without JavaScript the HUD shows a "Menu" anchor to
 * #hk-menu instead and CSS reveals the panel with :target, so it works with JS off too.
 * `data-lenis-prevent`: Lenis is stopped while the menu is open; this lets the panel scroll
 * natively on short screens.
 */
export function MenuOverlay({
  id,
  overlayRef,
  phase,
  chapters,
  onHome,
  path,
  active,
  onChapter,
  onLeave,
  children,
}: Props) {
  return (
    <div
      ref={overlayRef}
      id={id}
      className="hk-menu"
      data-state={phase}
      data-lenis-prevent
      // Only while it animates out: unreachable, but still painted. Never in the server HTML
      // (the no-JS :target fallback needs live links).
      inert={phase === "closing" || undefined}
    >
      <div className="hk-menu-inner">
        <p data-menu-item className="hk-pixel text-lime text-xs md:text-sm">
          <span aria-hidden="true">▸ </span>Pause · Level map
        </p>
        <nav aria-label="Chapters" className="mt-5 md:mt-8">
          <ol className="hk-menu-list">
            {chapters.map((chapter) => {
              const current = onHome && active === chapter.key;
              return (
                <li key={chapter.key} data-menu-item>
                  <Link
                    href={`/#${chapter.key}`}
                    data-menu-link
                    className="hk-menu-link"
                    aria-current={current ? "location" : undefined}
                    onClick={onChapter(chapter.key)}
                  >
                    <span className="hk-menu-num hk-mono">
                      <span className="sr-only">Level </span>
                      {pad2(chapter.level)}
                    </span>
                    <span className="hk-menu-title">{chapter.title}</span>
                    {PLAIN[chapter.key] ? (
                      <span className="hk-menu-plain hk-pixel">{PLAIN[chapter.key]}</span>
                    ) : null}
                    {current ? (
                      <span aria-hidden="true" className="hk-menu-here hk-pixel">
                        You are here
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>

        <div data-menu-item className="hk-menu-extra">
          {onHome ? null : (
            <Link href="/" className="hk-btn" onClick={onLeave}>
              <span aria-hidden="true">◂</span> Home
            </Link>
          )}
          <Link
            href="/projects"
            className="hk-btn"
            aria-current={path === "/projects" ? "page" : undefined}
            onClick={onLeave}
          >
            All projects <span aria-hidden="true">▸</span>
          </Link>
          {/* No-JS only (CSS): an unknown fragment un-targets the panel without scrolling. */}
          <a href="#hk-menu-closed" className="hk-btn hk-menu-nojs">
            Close
          </a>
        </div>

        {children ? (
          <div data-menu-item className="hk-menu-settings">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
