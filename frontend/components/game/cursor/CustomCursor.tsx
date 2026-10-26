"use client";

import { useEffect, useRef } from "react";

import { useMediaQuery } from "@/components/chapters/projects/useMediaQuery";
import { gsap, MEDIA } from "@/lib/gsap";
import { useLiteMode } from "@/lib/store";

import { resolveCursor, type CursorLook } from "./resolve";

/**
 * The custom cursor (spec §2): a dot that follows the pointer plus a context label read from the
 * hovered element — `data-cursor="VIEW"` (project cards), "DRAG", "PLAY" (videos, automatic),
 * "OPEN" (external links, automatic), or any other word — and magnetic primary buttons
 * (`data-magnetic`). Only for a fine pointer that can hover, never in Lite mode or with reduced
 * motion: everyone else keeps the native cursor and nothing of this is mounted.
 */
export function CustomCursor() {
  const lite = useLiteMode();
  const fine = useMediaQuery(MEDIA.finePointer);
  const reduce = useMediaQuery(MEDIA.reduce);
  if (lite || !fine || reduce) return null;
  return <CursorLayer />;
}

/** Magnet pull: this share of the pointer's offset from the button centre, capped in px. */
const PULL = 0.3;
const MAX_PULL = 10;
/** While scrolling, what is under the (still) pointer changes: re-check at most this often. */
const SCROLL_CHECK_MS = 120;
/** After a click, once a dialog / menu it opened has (mostly) appeared. */
const CLICK_CHECK_MS = 350;
/** While the pointer rests (no move for IDLE_MS), what is under it is re-checked this often. */
const POLL_MS = 250;
const IDLE_MS = 120;

type Magnet = {
  el: HTMLElement;
  box: DOMRect;
  pos: { x: number; y: number };
  toX: (value: number) => void;
  toY: (value: number) => void;
};

/**
 * - Position: gsap.quickTo on the layer's x/y — one reusable tween per axis that each pointermove
 *   just retargets (no new tween per event), animating `transform` only. The layer is fixed,
 *   pointer-events: none and contained, so it never costs layout.
 * - Look: resolveCursor() on the event target (only when the target changes), written as
 *   data-mode / the label text; CSS does the scale/opacity transitions. A resting pointer is
 *   re-checked too (after scroll, clicks, keys, route changes, and a light 250 ms hit-test poll),
 *   so a label never outlives the element it belongs to.
 * - The native cursor is hidden (`html[data-hk-cursor]`) only while the dot is on screen, and
 *   comes back over text fields (I-beam), over iframes, and when the pointer leaves the window.
 * - Magnet: the hovered [data-magnetic] element is pulled towards the pointer through the CSS
 *   `translate` property (not `transform`), so its own :hover / :active transforms keep working.
 */
function CursorLayer() {
  const root = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const recheckRef = useRef<(() => void) | null>(null);
  // A client navigation (a card opening the Project Stage modal, Back) swaps what is under the
  // pointer: re-check right away instead of keeping the old label. Clicks already re-check and a
  // light timer covers the rest; Back/Forward only fire popstate. Not usePathname(): mounted in
  // the site layout outside <Suspense>, it suspends the prerender of dynamic routes under Cache
  // Components and pushed the whole Project Stage into a JS-only streamed segment.
  useEffect(() => {
    const onPop = () => recheckRef.current?.();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const layer = root.current;
    const label = text.current;
    if (!layer || !label) return;
    const html = document.documentElement;

    gsap.set(layer, { x: -100, y: -100 });
    const toX = gsap.quickTo(layer, "x", { duration: 0.12, ease: "power3.out" });
    const toY = gsap.quickTo(layer, "y", { duration: 0.12, ease: "power3.out" });

    let visible = false;
    let look: CursorLook = { mode: "default", label: "" };
    let lastTarget: EventTarget | null = null;
    let point = { x: -100, y: -100 };
    let magnet: Magnet | null = null;
    let checkTimer: ReturnType<typeof setTimeout> | undefined;
    let lastMove = 0;

    const setLook = (next: CursorLook) => {
      if (next.mode !== look.mode) layer.dataset.mode = next.mode;
      if (next.label !== look.label) label.textContent = next.label;
      look = next;
      // The native cursor is only hidden where our dot stands in for it.
      const hide = visible && next.mode !== "text" && next.mode !== "hidden";
      if (hide) html.setAttribute("data-hk-cursor", "");
      else html.removeAttribute("data-hk-cursor");
    };

    const show = () => {
      if (visible) return;
      visible = true;
      gsap.set(layer, { x: point.x, y: point.y }); // appear in place, don't glide in from a corner
      layer.dataset.visible = "";
    };
    const hide = () => {
      visible = false;
      delete layer.dataset.visible;
      html.removeAttribute("data-hk-cursor");
      release();
      lastTarget = null;
    };

    // ── Magnetic buttons ─────────────────────────────────────────────────────────
    const release = () => {
      const current = magnet;
      if (!current) return;
      magnet = null;
      current.toX(0);
      current.toY(0);
    };
    // One pair of quickTo tweens per element, reused: grabbing it again mid-spring continues
    // from where it is instead of jumping.
    const springs = new WeakMap<HTMLElement, Omit<Magnet, "el" | "box">>();
    const springOf = (el: HTMLElement) => {
      const known = springs.get(el);
      if (known) return known;
      const pos = { x: 0, y: 0 };
      const write = () => {
        const resting = Math.abs(pos.x) < 0.05 && Math.abs(pos.y) < 0.05;
        // Back at rest and no longer held: drop the inline value, the element's own CSS wins again.
        el.style.translate = resting && magnet?.el !== el ? "" : `${pos.x}px ${pos.y}px`;
      };
      const spring = {
        pos,
        toX: gsap.quickTo(pos, "x", { duration: 0.35, ease: "power3.out", onUpdate: write }),
        toY: gsap.quickTo(pos, "y", { duration: 0.35, ease: "power3.out", onUpdate: write }),
      };
      springs.set(el, spring);
      return spring;
    };
    const grab = (el: HTMLElement) => {
      if (magnet?.el === el) return;
      release();
      if (el.matches(":disabled") || el.getAttribute("aria-disabled") === "true") return;
      // Measured once per hover (the magnet's own offset is small and the page is still).
      magnet = { el, box: el.getBoundingClientRect(), ...springOf(el) };
    };
    const pull = (x: number, y: number) => {
      if (!magnet) return;
      const { box } = magnet;
      const dx = x - (box.left + box.width / 2);
      const dy = y - (box.top + box.height / 2);
      magnet.toX(gsap.utils.clamp(-MAX_PULL, MAX_PULL, dx * PULL));
      magnet.toY(gsap.utils.clamp(-MAX_PULL, MAX_PULL, dy * PULL));
    };

    // ── Pointer ─────────────────────────────────────────────────────────────────
    /** Look + magnet for the element under the pointer (`force`: even if it is the same one). */
    const aim = (element: Element | null, force = false) => {
      if (element === lastTarget && !force) return;
      lastTarget = element;
      setLook(resolveCursor(element));
      const target = element?.closest<HTMLElement>("[data-magnetic]");
      if (force) release(); // its box may have moved: measure again
      if (target) grab(target);
      else release();
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        hide(); // touch / pen on a hybrid laptop: the native behaviour
        return;
      }
      lastMove = performance.now();
      point = { x: event.clientX, y: event.clientY };
      if (!visible) show();
      else {
        toX(point.x);
        toY(point.y);
      }
      aim(event.target instanceof Element ? event.target : null);
      pull(point.x, point.y);
    };
    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") layer.dataset.pressed = "";
    };
    // What is under a still pointer can change without a pointermove: the page scrolled, a click
    // opened a dialog or navigated (the card that said "VIEW" is now under the Project Stage),
    // an element was removed. Re-check with elementFromPoint (a hit test, no layout):
    // - soon after a scroll / click / Esc-Enter-Space;
    const recheck = () => {
      checkTimer = undefined;
      if (visible) aim(document.elementFromPoint(point.x, point.y), true);
    };
    const scheduleCheck = (delay: number) => {
      if (checkTimer !== undefined) return;
      checkTimer = setTimeout(recheck, delay);
    };
    // - and, as the catch-all, a few times a second while the pointer rests (a moving pointer is
    //   handled by pointermove): anything that appeared, changed or vanished under it.
    const poll = setInterval(() => {
      if (!visible || document.hidden || performance.now() - lastMove < IDLE_MS) return;
      const element = document.elementFromPoint(point.x, point.y);
      if (element !== lastTarget || !(lastTarget instanceof Element && lastTarget.isConnected)) {
        aim(element, true);
      }
    }, POLL_MS);
    recheckRef.current = () => scheduleCheck(0);
    const onUp = () => {
      delete layer.dataset.pressed;
      clearTimeout(checkTimer);
      checkTimer = undefined;
      scheduleCheck(CLICK_CHECK_MS);
    };
    // Leaving the window (relatedTarget null) or entering an iframe: hide.
    const onOut = (event: PointerEvent) => {
      const to = event.relatedTarget;
      if (to === null || (to instanceof Element && to.tagName === "IFRAME")) hide();
    };
    const onScroll = () => scheduleCheck(SCROLL_CHECK_MS);
    // Esc / Enter / Space can open or close an overlay under the pointer too.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
        scheduleCheck(CLICK_CHECK_MS);
      }
    };
    const onVisibility = () => {
      if (document.hidden) hide();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keyup", onKey, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerout", onOut);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keyup", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimeout(checkTimer);
      clearInterval(poll);
      recheckRef.current = null;
      const held = magnet?.el;
      magnet = null;
      if (held) held.style.translate = "";
      html.removeAttribute("data-hk-cursor");
      gsap.killTweensOf(layer);
    };
  }, []);

  return (
    <div ref={root} className="hk-cursor" data-mode="default" aria-hidden="true">
      <span className="hk-cursor-dot" />
      <span className="hk-cursor-label hk-pixel">
        <span ref={text} />
      </span>
    </div>
  );
}
