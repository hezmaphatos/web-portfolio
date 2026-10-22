"use client";

import { useEffect, useRef, useState } from "react";

import { AVATAR_COLS, avatarFrameSetter, PixelAvatar } from "@/components/game/PixelAvatar";
import type { ChapterSection } from "@/components/game/useChapterSections";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { CHAPTER_BIT } from "@/lib/save";
import { useGameStore, useLiteMode } from "@/lib/store";
import { SECTION_KEYS, type SectionKey } from "@/lib/types";
import { pad2 } from "@/lib/utils";

/**
 * The level path (spec §2): a dashed SVG trail down the right-hand gutter of Home with a
 * checkpoint flag at every chapter, and the pixel avatar walking it, scrubbed by scroll
 * (MotionPathPlugin + ScrollTrigger). Desktop only (≥ 1024 px), never in Lite mode, decorative
 * (aria-hidden, pointer-events: none).
 *
 * It must never cover content, so it only appears when the gutter beside the content column is
 * wide enough for the avatar (≈ ≥ 1330 px wide windows with the 76 rem column).
 */

const DESKTOP = "(min-width: 1024px)";
const SCALE = 3;
const AVATAR_W = AVATAR_COLS * SCALE;
/** Narrowest gutter that fits the avatar with breathing room on both sides. */
const MIN_GUTTER = AVATAR_W + 28;
/** The trail starts below the HUD and ends just above the bottom of the page. */
const START_Y = 120;
const END_PAD = 40;
/** Rough length of one sideways swing of the trail. */
const SWING = 460;
/** Pixels of path per walk-frame swap. */
const STRIDE = 14;

type Geometry = {
  top: number;
  height: number;
  width: number;
  stops: { key: SectionKey; y: number }[];
};

/**
 * Trail through (cx, y) at every checkpoint; between two checkpoints it swings left/right in
 * cubic "half waves" (both control points on one side: the curve peaks at 0.75 × offset).
 */
function buildPath(geo: Geometry): string {
  const cx = geo.width / 2;
  const amp = Math.max(4, Math.min(28, cx - AVATAR_W / 2 - 6));
  const offset = amp / 0.75;
  const anchors = [START_Y, ...geo.stops.map((s) => s.y), geo.height - END_PAD]
    .filter((y, i, all) => y >= START_Y && y <= geo.height - END_PAD && (i === 0 || y > all[i - 1]))
    .sort((a, b) => a - b);
  let d = `M ${cx} ${anchors[0]}`;
  let side = 1;
  for (let i = 1; i < anchors.length; i++) {
    const from = anchors[i - 1];
    const span = anchors[i] - from;
    const waves = Math.max(1, Math.round(span / SWING));
    const step = span / waves;
    for (let w = 0; w < waves; w++) {
      const a = from + step * w;
      const x = cx + side * offset;
      d += ` C ${x} ${a + step / 3} ${x} ${a + (2 * step) / 3} ${cx} ${a + step}`;
      side = -side;
    }
  }
  return d;
}

function sameGeometry(a: Geometry | null, b: Geometry | null) {
  if (!a || !b) return a === b;
  return (
    a.top === b.top &&
    a.height === b.height &&
    a.width === b.width &&
    a.stops.length === b.stops.length &&
    a.stops.every((s, i) => s.key === b.stops[i].key && s.y === b.stops[i].y)
  );
}

export function AvatarPath({ sections }: { sections: ChapterSection[] }) {
  const lite = useLiteMode();
  const [measured, setGeo] = useState<Geometry | null>(null);
  // Derived, not reset in an effect: Lite mode or a page without chapters simply shows nothing
  // (and the tween below is reverted because its dependency changes).
  const geo = !lite && sections.length > 0 ? measured : null;
  const visited = useGameStore((state) => (state.hydrated ? state.visited : 0));
  const layer = useRef<HTMLDivElement>(null);
  const path = useRef<SVGPathElement>(null);
  const walker = useRef<HTMLDivElement>(null);

  // ── Measure: where Home is, how wide the gutter is, where each chapter starts ─────
  useEffect(() => {
    const main = document.getElementById("main");
    if (lite || !main || sections.length === 0) return;
    const desktop = window.matchMedia(DESKTOP);
    let timer: ReturnType<typeof setTimeout> | undefined;

    const measure = () => {
      if (!desktop.matches) return setGeo(null);
      const column = sections[0].el.querySelector(".hk-wrap") ?? sections[0].el;
      const gutter = Math.floor(
        document.documentElement.clientWidth - column.getBoundingClientRect().right,
      );
      if (gutter < MIN_GUTTER) return setGeo(null);
      const top = Math.round(main.getBoundingClientRect().top + window.scrollY);
      const next: Geometry = {
        top,
        height: Math.round(main.offsetHeight),
        width: gutter,
        stops: sections.map((s) => ({
          key: s.key,
          y: Math.round(s.el.getBoundingClientRect().top + window.scrollY - top),
        })),
      };
      setGeo((prev) => (sameGeometry(prev, next) ? prev : next));
    };
    // Debounced: content heights change in bursts (fonts, images, accordions, Flip).
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(measure, 150);
    };

    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(main);
    window.addEventListener("resize", schedule);
    desktop.addEventListener("change", schedule);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      desktop.removeEventListener("change", schedule);
    };
  }, [lite, sections]);

  // ── Walk: one scrubbed MotionPath tween, rebuilt whenever the geometry changes ─────
  useGSAP(
    () => {
      const trail = path.current;
      const body = walker.current;
      const main = document.getElementById("main");
      if (!geo || !trail || !body || !main) return;
      const sprite = body.firstElementChild as HTMLElement;
      const setFrame = avatarFrameSetter(sprite);
      const length = trail.getTotalLength();

      gsap.set(body, { xPercent: -50, yPercent: -100 }); // feet on the trail
      gsap.to(body, {
        ease: "none",
        // No `align`: the walker sits at the layer's 0,0 and the SVG uses the same pixel
        // coordinates, so the path's raw x/y can be applied as translate() directly.
        motionPath: { path: trail },
        scrollTrigger: {
          trigger: main,
          start: "top top",
          end: "bottom bottom",
          // scrub: true ties progress to the scroll position 1:1. Lenis already smooths the
          // scroll itself; an extra scrub lag would make the avatar trail behind the page.
          scrub: true,
          // invalidateOnRefresh: after a layout refresh, re-read the start values.
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            setFrame(Math.floor((self.progress * length) / STRIDE) % 2);
            // Face the way we walk: flip the sprite when scrolling back up.
            sprite.style.transform = self.direction < 0 ? "scaleX(-1)" : "";
          },
        },
      });
      // Positions of every other trigger may have moved with the new layer measurements.
      ScrollTrigger.refresh();
    },
    { scope: layer, dependencies: [geo], revertOnUpdate: true },
  );

  if (!geo) return null;
  const cx = geo.width / 2;

  return (
    <div
      ref={layer}
      aria-hidden="true"
      className="hk-avatar-path"
      style={{ top: geo.top, height: geo.height, width: geo.width }}
    >
      <svg width={geo.width} height={geo.height} viewBox={`0 0 ${geo.width} ${geo.height}`}>
        <path ref={path} d={buildPath(geo)} className="hk-avatar-trail" />
        {geo.stops
          .filter((stop) => stop.y >= START_Y - 1)
          .map((stop) => {
            const done = (visited & CHAPTER_BIT[stop.key]) !== 0;
            return (
              <g key={stop.key} transform={`translate(${cx} ${stop.y})`} className="hk-avatar-flag">
                <rect x={-1} y={-22} width={2} height={22} className="hk-avatar-pole" />
                <rect
                  x={1}
                  y={-22}
                  width={14}
                  height={10}
                  className={done ? "hk-avatar-cloth is-done" : "hk-avatar-cloth"}
                />
                <text x={-6} y={-26} className="hk-avatar-label" textAnchor="end">
                  {pad2(SECTION_KEYS.indexOf(stop.key))}
                </text>
              </g>
            );
          })}
      </svg>
      <div ref={walker} className="hk-avatar-walker">
        <div>
          <PixelAvatar scale={SCALE} />
        </div>
      </div>
    </div>
  );
}
