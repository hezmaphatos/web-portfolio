"use client";

import { ChevronLeft, ChevronRight, Maximize2, MoveVertical } from "lucide-react";
import { AnimatePresence } from "motion/react";
import dynamic from "next/dynamic";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { Media } from "@/components/ui/Media";
import { useStill } from "@/components/ui/useStill";
import { cn } from "@/lib/utils";
import { DEVICES, type Device, type GalleryImage } from "@/lib/types";

import { DeviceFrame } from "./DeviceFrame";
import { DEVICE_NAME, screenFit } from "./deck/media";

/** Heavy and rarely used: its own chunk, loaded on the first open (spec §11). */
const Lightbox = dynamic(() => import("./deck/Lightbox"), { ssr: false });
const preloadLightbox = () => void import("./deck/Lightbox");

type Props = {
  items: GalleryImage[];
  /** Project title, for alt text when a screenshot has none of its own. */
  title: string;
  seed: string;
  accent: string;
  /** Shown in the desktop frame's address bar. */
  address?: string;
  className?: string;
};

/** Frame width per device: the desktop browser fills the deck, phones stay phone-sized. */
const FRAME_WIDTH: Record<Device, string> = {
  desktop: "w-full max-w-[56rem]",
  tablet: "w-[min(78vw,27rem)]",
  mobile: "w-[min(64vw,17.5rem)]",
};

const SIZES: Record<Device, string> = {
  desktop: "(min-width: 1024px) 56rem, 92vw",
  tablet: "(min-width: 768px) 27rem, 78vw",
  mobile: "18rem",
};

/** A drag shorter than this is a click (opens the lightbox). */
const DRAG_SLOP = 6;

export function shotAlt(item: GalleryImage, title: string, index: number): string {
  return item.alt ?? `${title}: ${DEVICE_NAME[item.device].toLowerCase()} screenshot ${index + 1}`;
}

/** One screenshot inside its device screen; tall captures scroll inside it on hover (CSS). */
function Shot({
  item,
  alt,
  seed,
  accent,
  priority,
}: {
  item: GalleryImage;
  alt: string;
  seed: string;
  accent: string;
  priority?: boolean;
}) {
  const fit = screenFit(item);
  return (
    <div className="hk-shot-screen" style={{ aspectRatio: String(fit.screen) }}>
      <div
        className="hk-shot-inner"
        style={
          fit.tall
            ? ({
                "--shot-shift": fit.shift.toFixed(4),
                "--shot-dur": `${fit.duration.toFixed(2)}s`,
              } as React.CSSProperties)
            : undefined
        }
      >
        <Media
          media={item}
          alt={alt}
          seed={`${seed}-${item.id}`}
          accent={accent}
          ratio={fit.image}
          sizes={SIZES[item.device]}
          priority={priority}
          imgClassName="object-top"
        />
      </div>
      {fit.tall ? (
        <span className="hk-shot-hint hk-pixel" aria-hidden="true">
          <MoveVertical className="size-3" strokeWidth={2.5} />
          Hover to scroll
        </span>
      ) : null}
    </div>
  );
}

/**
 * Screenshots tab of the Preview Deck (spec §6.3): a device switcher (only devices that have
 * shots), a carousel per device (drag / swipe, arrows, ←/→, thumbnails) and a fullscreen
 * lightbox loaded on demand.
 *
 * The track is one row of full-width slides moved with a transform:
 * translateX(index × -100 % + drag px). While a pointer drags, only the CSS variable --drag
 * changes (no React render per move); on release the index snaps and a CSS transition eases
 * it (none in Lite / reduced motion). `touch-action: pan-y` keeps vertical page scrolling
 * native on phones while horizontal swipes reach us.
 */
export function Gallery({ items, title, seed, accent, address, className }: Props) {
  const devices = DEVICES.filter((device) => items.some((item) => item.device === device));
  const [device, setDevice] = useState<Device>(devices[0] ?? "desktop");
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const still = useStill();
  const regionId = useId();

  const shots = items.filter((item) => item.device === device);
  const count = shots.length;
  const current = Math.min(index, Math.max(0, count - 1));

  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    dx: number;
    axis: "x" | "y" | null;
    at: number;
  } | null>(null);
  /** Set by a real drag so the click that ends it doesn't open the lightbox. */
  const dragged = useRef(false);

  // Activity (Cache Components) hides this stage when the visitor navigates away: close the
  // lightbox then, so coming back never finds it open over the page.
  useLayoutEffect(() => () => setLightbox(null), []);

  const go = (next: number) => setIndex(Math.max(0, Math.min(count - 1, next)));

  const setDrag = (px: number) => track.current?.style.setProperty("--drag", `${px}px`);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (count < 2 || (event.pointerType === "mouse" && event.button !== 0)) return;
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dx: 0,
      axis: null,
      at: performance.now(),
    };
    dragged.current = false;
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    if (state.axis === null) {
      if (Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return;
      state.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (state.axis === "y") return; // a vertical gesture: leave it to the page
      event.currentTarget.setPointerCapture(event.pointerId);
      track.current?.setAttribute("data-dragging", "");
      dragged.current = true;
    }
    if (state.axis !== "x") return;
    // Rubber band past the first / last slide.
    const atEdge = (current === 0 && dx > 0) || (current === count - 1 && dx < 0);
    state.dx = atEdge ? dx * 0.3 : dx;
    setDrag(state.dx);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    drag.current = null;
    track.current?.removeAttribute("data-dragging");
    if (state.axis !== "x") return;
    const width = viewport.current?.clientWidth ?? 1;
    const velocity = state.dx / Math.max(1, performance.now() - state.at); // px per ms
    const far = Math.abs(state.dx) > width * 0.18 || Math.abs(velocity) > 0.5;
    setDrag(0);
    if (far) go(current + (state.dx < 0 ? 1 : -1));
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      if ((event.target as HTMLElement).closest("[role='tablist'],[data-device-switch]")) return;
      event.preventDefault();
      go(current + (event.key === "ArrowRight" ? 1 : -1));
    }
  };

  const openLightbox = (at: number, trigger: HTMLElement) => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    opener.current = trigger;
    setLightbox(at);
  };

  const closeLightbox = () => setLightbox(null);

  if (items.length === 0) return null;
  const active = shots[current];

  return (
    <div className={cn("flex flex-col gap-6", className)} data-gallery>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {devices.length > 1 ? (
          <div role="group" aria-label="Device" className="hk-segment" data-device-switch>
            {devices.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={option === device}
                className="hk-segment-btn hk-pixel"
                onClick={() => {
                  setDevice(option);
                  setIndex(0);
                }}
              >
                {DEVICE_NAME[option]}
                <span className="opacity-70">
                  {" "}
                  {items.filter((item) => item.device === option).length}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="hk-pixel text-ink-2 text-xs">{DEVICE_NAME[device]}</p>
        )}
        {count > 1 ? (
          <p className="hk-mono text-ink-2 text-sm" aria-hidden="true">
            {String(current + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
          </p>
        ) : null}
      </div>

      <div
        id={regionId}
        role="region"
        aria-roledescription="carousel"
        aria-label={`${DEVICE_NAME[device]} screenshots`}
        className="hk-carousel"
        onKeyDown={onKeyDown}
      >
        <div
          ref={viewport}
          className="hk-carousel-viewport"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          data-draggable={count > 1 || undefined}
        >
          <div
            ref={track}
            className="hk-carousel-track"
            style={{ "--index": current } as React.CSSProperties}
          >
            {shots.map((item, slide) => {
              const alt = shotAlt(item, title, items.indexOf(item));
              const hidden = slide !== current;
              return (
                <div
                  key={item.id}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${slide + 1} of ${count}`}
                  aria-hidden={hidden || undefined}
                  inert={hidden}
                  className="hk-carousel-slide"
                >
                  <figure className={cn("flex flex-col gap-3", FRAME_WIDTH[item.device])}>
                    <DeviceFrame
                      device={item.device}
                      address={address}
                      className="shadow-[6px_6px_0_var(--accent)]"
                    >
                      <button
                        type="button"
                        className="hk-shot"
                        data-tall={screenFit(item).tall || undefined}
                        aria-label={`View fullscreen: ${alt}`}
                        onPointerEnter={preloadLightbox}
                        onFocus={preloadLightbox}
                        onClick={(event) => openLightbox(slide, event.currentTarget)}
                      >
                        <Shot item={item} alt={alt} seed={seed} accent={accent} priority={false} />
                        <span className="hk-shot-zoom" aria-hidden="true">
                          <Maximize2 className="size-4" strokeWidth={2.5} />
                        </span>
                      </button>
                    </DeviceFrame>
                    {item.caption ? (
                      <figcaption className="text-ink-2 max-w-prose text-sm">
                        {item.caption}
                      </figcaption>
                    ) : null}
                  </figure>
                </div>
              );
            })}
          </div>
        </div>

        {count > 1 ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <ul className="flex flex-wrap gap-2.5" aria-label="Screenshots">
              {shots.map((item, slide) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="hk-thumb"
                    aria-label={`Show screenshot ${slide + 1} of ${count}`}
                    aria-current={slide === current || undefined}
                    aria-controls={regionId}
                    onClick={() => go(slide)}
                  >
                    <Media
                      media={item}
                      alt=""
                      seed={`${seed}-${item.id}`}
                      accent={accent}
                      ratio={item.device === "desktop" ? 16 / 10 : 3 / 4}
                      thumb
                      sizes="6rem"
                      imgClassName="object-top"
                    />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button
                type="button"
                className="hk-btn size-11 p-0"
                aria-label="Previous screenshot"
                aria-controls={regionId}
                disabled={current === 0}
                onClick={() => go(current - 1)}
              >
                <ChevronLeft aria-hidden="true" className="size-5" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                className="hk-btn size-11 p-0"
                aria-label="Next screenshot"
                aria-controls={regionId}
                disabled={current === count - 1}
                onClick={() => go(current + 1)}
              >
                <ChevronRight aria-hidden="true" className="size-5" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        ) : null}

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {active
            ? `Screenshot ${current + 1} of ${count}${active.caption ? `: ${active.caption}` : ""}`
            : ""}
        </p>
      </div>

      <AnimatePresence>
        {lightbox !== null ? (
          <Lightbox
            key="lightbox"
            items={shots}
            index={lightbox}
            onIndex={(next) => {
              setLightbox(next);
              setIndex(next); // the carousel follows, so closing lands on the same shot…
              // …and focus returns to that slide's button.
              opener.current =
                track.current?.children[next]?.querySelector<HTMLElement>(".hk-shot") ?? null;
            }}
            onClose={closeLightbox}
            title={title}
            seed={seed}
            accent={accent}
            still={still}
            returnFocus={opener}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
