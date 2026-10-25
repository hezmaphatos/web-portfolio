"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";

import { lockScroll, scrollToTarget } from "@/components/providers/SmoothScroll";
import { focusElement, inertOutside, trapTab } from "@/components/ui/focus";
import { gsap, MEDIA, useGSAP } from "@/lib/gsap";
import { useHintStore, useHudStore } from "@/lib/store";
import type { SectionKey } from "@/lib/types";

import { MenuOverlay, type MenuChapter, type MenuPhase } from "./MenuOverlay";

export type { MenuChapter } from "./MenuOverlay";

type Props = {
  chapters: MenuChapter[];
  /** The page shows the Home chapters (otherwise chapter links navigate to /#key). */
  onHome: boolean;
  /** location.pathname ("" before mount). */
  path: string;
  /** Extra controls inside the overlay (the Sound/Lite toggles on phones). */
  children?: ReactNode;
};

const MENU_ID = "hk-menu";

/** The circle the overlay grows from: centred on the Menu button, big enough for every corner. */
function circleFrom(button: HTMLElement) {
  const box = button.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const r =
    Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 16;
  return { x: Math.round(x), y: Math.round(y), r: Math.ceil(r) };
}

/** Lite mode (mirrored on <html> by StoreHydrator) or the OS asks for reduced motion. */
const isStill = () =>
  document.documentElement.dataset.lite === "true" || window.matchMedia(MEDIA.reduce).matches;

/**
 * The HUD Menu button and its chapter-map overlay (spec §4.1 "Navigasi"). Opening reveals the
 * overlay with a GSAP clip-path circle growing out of the button (Lite / reduced motion: a short
 * fade); the HUD row stays on top of it. While open the page scroll is locked, everything but the
 * HUD is inert, Tab cycles inside the HUD + overlay, Esc or the button closes it and the focus
 * goes back to the button. A chapter link closes it, scrolls there (Lenis) and focuses the
 * chapter title; from another page it navigates to /#key.
 */
export function HudMenu({ chapters, onHome, path, children }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  /** Undo for the open state (scroll lock, inert page, key listener). */
  const session = useRef<(() => void) | null>(null);
  const [phase, setPhase] = useState<MenuPhase>("closed");
  const active = useHudStore((state) => state.activeChapter);

  const teardown = () => {
    session.current?.();
    session.current = null;
  };

  const closeMenu = (focusButton: boolean) => {
    if (!session.current) return;
    teardown(); // synchronous: the page scrolls and takes focus again right away
    setPhase("closing");
    if (focusButton) button.current?.focus({ preventScroll: true });
  };

  const openMenu = () => {
    const hud = wrap.current?.closest<HTMLElement>("[data-hud]") ?? wrap.current;
    if (!hud || session.current) return;
    useHintStore.getState().dismiss(); // the hint card would float over the overlay
    flushSync(() => setPhase("open")); // visible before the focus moves into it

    const releaseScroll = lockScroll();
    const restoreInert = inertOutside([hud]);
    const root = document.documentElement;
    root.dataset.overlay = "menu"; // tints the scrollbar gutter the lock leaves (CSS)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
        return;
      }
      trapTab(event, hud);
    };
    document.addEventListener("keydown", onKey);
    session.current = () => {
      document.removeEventListener("keydown", onKey);
      if (root.dataset.overlay === "menu") delete root.dataset.overlay;
      restoreInert();
      releaseScroll();
    };
    overlay.current?.querySelector<HTMLElement>("[data-menu-link]")?.focus({ preventScroll: true });
  };

  // Unmount while open (never expected: the HUD lives in the layout) → release everything.
  useEffect(
    () => () => {
      session.current?.();
      session.current = null;
    },
    [],
  );

  // A navigation behind the menu's back (browser back/forward) closes it.
  const [openedOn, setOpenedOn] = useState(path);
  if (openedOn !== path) {
    setOpenedOn(path);
    if (phase === "open") setPhase("closing");
  }
  useEffect(() => {
    if (phase === "open" || !session.current) return;
    session.current();
    session.current = null;
  }, [phase]);

  // The reveal / hide. useGSAP runs before paint, so the first frame already has the clip.
  useGSAP(
    () => {
      const el = overlay.current;
      const btn = button.current;
      if (!el || !btn) return;
      const items = el.querySelectorAll<HTMLElement>("[data-menu-item]");
      gsap.killTweensOf([el, ...items]); // a quick re-toggle cancels the running one (and its onComplete)

      if (phase === "closed") {
        gsap.set([el, ...items], { clearProps: "clipPath,opacity,transform" });
        return;
      }
      const still = isStill();

      if (phase === "open") {
        if (still) {
          gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: "none" });
          return;
        }
        const { x, y, r } = circleFrom(btn);
        gsap.fromTo(
          el,
          { opacity: 1, clipPath: `circle(0px at ${x}px ${y}px)` },
          {
            clipPath: `circle(${r}px at ${x}px ${y}px)`,
            duration: 0.62,
            ease: "power3.inOut",
            clearProps: "clipPath", // a later resize must not cut the open panel
          },
        );
        gsap.fromTo(
          items,
          { y: 28, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.45,
            ease: "power3.out",
            stagger: 0.035,
            delay: 0.2,
            clearProps: "transform,opacity",
          },
        );
        return;
      }

      // closing
      const done = () => setPhase("closed");
      if (still) {
        gsap.to(el, { opacity: 0, duration: 0.12, ease: "none", onComplete: done });
        return;
      }
      const { x, y, r } = circleFrom(btn);
      gsap.fromTo(
        el,
        { clipPath: `circle(${r}px at ${x}px ${y}px)` },
        {
          clipPath: `circle(0px at ${x}px ${y}px)`,
          duration: 0.42,
          ease: "power3.in",
          onComplete: done,
        },
      );
    },
    { scope: wrap, dependencies: [phase] },
  );

  const goChapter = (key: SectionKey) => (event: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(key);
    // Not on Home (or the chapter is hidden): close and let the link navigate to /#key.
    if (!target || target.getClientRects().length === 0) {
      closeMenu(false);
      return;
    }
    event.preventDefault();
    closeMenu(false); // releases the scroll lock first: a stopped Lenis ignores scrollTo
    scrollToTarget(target);
    const heading = target.querySelector<HTMLElement>("h1, h2");
    if (heading) focusElement(heading);
  };

  const open = phase === "open";

  return (
    <div ref={wrap} className="hk-hud-menu">
      <button
        ref={button}
        type="button"
        className="hk-hud-btn hk-menu-toggle"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls={MENU_ID}
        onClick={() => (open ? closeMenu(true) : openMenu())}
      >
        {open ? (
          <X aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
        ) : (
          <Menu aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
        )}
        <span aria-hidden="true" className="hidden lg:inline">
          Menu
        </span>
      </button>
      {/* Without JavaScript the button above is hidden (CSS) and this anchor opens the panel. */}
      <a href={`#${MENU_ID}`} className="hk-hud-btn hk-menu-nojs">
        <Menu aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
        <span className="max-lg:sr-only">Menu</span>
      </a>

      <MenuOverlay
        id={MENU_ID}
        overlayRef={overlay}
        phase={phase}
        chapters={chapters}
        onHome={onHome}
        path={path}
        active={active}
        onChapter={goChapter}
        onLeave={() => closeMenu(false)}
      >
        {children}
      </MenuOverlay>
    </div>
  );
}
