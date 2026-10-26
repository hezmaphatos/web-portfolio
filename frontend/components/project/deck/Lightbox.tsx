"use client";

import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";
import { animate, usePresence, type AnimationPlaybackControlsWithThen } from "motion/react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { lockScroll } from "@/components/providers/SmoothScroll";
import { inertOutside, trapTab } from "@/components/ui/focus";
import { Media } from "@/components/ui/Media";
import type { GalleryImage } from "@/lib/types";

import { DEVICE_NAME } from "./media";

type Props = {
  items: GalleryImage[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  title: string;
  seed: string;
  accent: string;
  /** Lite / reduced motion: fades only. */
  still: boolean;
  /** Gets the focus back when the lightbox is gone. */
  returnFocus: RefObject<HTMLElement | null>;
};

const EASE_OUT = [0.25, 1, 0.5, 1] as const;

/** Room the toolbar and caption take from the viewport height (fit mode). */
const CHROME_HEIGHT = "11rem";

/**
 * Fullscreen screenshot viewer (spec §6.3 "Lightbox layar penuh: zoom, navigasi keyboard,
 * caption"). Loaded with next/dynamic on the first open, rendered into <body> through a
 * portal, a child of <AnimatePresence> in <Gallery> (usePresence → exit animation).
 *
 * - Fit: the whole shot, as large as the screen allows. Zoom (button, click on the image, + / -):
 *   the shot at its natural width (at least twice the fit) inside a scroll area — tall captures
 *   become readable, the mouse pans by dragging, touch pans natively. The zoom is a layout
 *   switch, not an animation.
 * - Keys: ← / → previous / next (wraps), + / - / 0 zoom, Esc closes, Tab stays inside.
 * - Touch: swipe left / right in fit mode.
 * - Modal: scroll lock, the rest of the page inert, focus on ✕, back to the shot on close.
 */
export default function Lightbox({
  items,
  index,
  onIndex,
  onClose,
  title,
  seed,
  accent,
  still,
  returnFocus,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const running = useRef<AnimationPlaybackControlsWithThen[]>([]);
  const [isPresent, safeToRemove] = usePresence();
  const [zoomed, setZoomed] = useState(false);
  /** Where the zoom was asked for (fractions of the image), kept under the pointer. */
  const focusPoint = useRef<{ x: number; y: number } | null>(null);
  const pan = useRef<{
    id: number;
    x: number;
    y: number;
    left: number;
    top: number;
    moved: boolean;
  } | null>(null);
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null);
  const handlers = useRef({ onIndex, onClose });

  const count = items.length;
  const item = items[Math.min(index, count - 1)];
  const ratio = item?.width && item.height ? item.width / item.height : 16 / 10;
  const fitWidth = `min(92vw, calc((100svh - ${CHROME_HEIGHT}) * ${ratio.toFixed(5)}))`;
  const zoomWidth = item?.width
    ? `max(${item.width}px, calc(2 * ${fitWidth}))`
    : `calc(2 * ${fitWidth})`;

  useLayoutEffect(() => {
    handlers.current = { onIndex, onClose };
  });

  const step = (delta: number) => {
    if (count < 2) return;
    setZoomed(false);
    handlers.current.onIndex((index + delta + count) % count);
  };

  const zoom = (on: boolean, point?: { x: number; y: number }) => {
    focusPoint.current = on ? (point ?? { x: 0.5, y: 0.5 }) : null;
    setZoomed(on);
  };

  // Modal behaviour for the lightbox's lifetime.
  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const releaseScroll = lockScroll();
    const restoreInert = inertOutside([host]);
    closeButton.current?.focus({ preventScroll: true });
    const target = returnFocus;
    return () => {
      restoreInert();
      releaseScroll();
      const back = target.current;
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
  }, [returnFocus]);

  // Keys, in the capture phase: the Stage modal underneath also listens for Esc / Tab and
  // skips events we already handled (defaultPrevented).
  const keyState = useRef({ step, zoom, zoomed });
  useLayoutEffect(() => {
    keyState.current = { step, zoom, zoomed };
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const host = root.current;
      if (!host || event.defaultPrevented) return;
      const { step: go, zoom: setZoom, zoomed: isZoomed } = keyState.current;
      // The lightbox is modal: no other key handler (Stage modal, Arena / dummy keys, HUD "?")
      // may react while it is open. Default actions (Tab moving focus) still happen.
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        handlers.current.onClose();
      } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        go(event.key === "ArrowRight" ? 1 : -1);
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setZoom(true);
      } else if (event.key === "-" || event.key === "0") {
        event.preventDefault();
        setZoom(false);
      } else if (event.key === "Tab") {
        trapTab(event, host);
      } else if (isZoomed && event.key === "Home") {
        stage.current?.scrollTo({ top: 0 });
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);

  // Keep the zoomed point under the pointer: scroll the stage once the bigger image is laid out.
  useLayoutEffect(() => {
    const area = stage.current;
    const point = focusPoint.current;
    if (!area) return;
    if (!zoomed || !point) {
      area.scrollTo({ left: 0, top: 0 });
      return;
    }
    const image = area.querySelector<HTMLElement>("[data-lightbox-image]");
    if (!image) return;
    area.scrollTo({
      left: image.offsetLeft + image.offsetWidth * point.x - area.clientWidth / 2,
      top: image.offsetTop + image.offsetHeight * point.y - area.clientHeight / 2,
    });
  }, [zoomed, index]);

  // Enter (layout effect: the first frame is already the starting state).
  useLayoutEffect(() => {
    const host = root.current;
    const figure = host?.querySelector<HTMLElement>("[data-lightbox-figure]");
    if (!host) return;
    const started = [animate(host, { opacity: [0, 1] }, { duration: still ? 0.15 : 0.22 })];
    if (figure && !still) {
      started.push(
        animate(figure, { scale: [0.94, 1], y: [16, 0] }, { duration: 0.32, ease: [...EASE_OUT] }),
      );
    }
    running.current.push(...started);
    return () => started.forEach((controls) => controls.stop());
    // Runs once per opening (the component is mounted per opening).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new shot fades in (not on the first render: the enter animation covers that).
  const firstShot = useRef(true);
  useLayoutEffect(() => {
    if (firstShot.current) {
      firstShot.current = false;
      return;
    }
    const figure = root.current?.querySelector<HTMLElement>("[data-lightbox-image]");
    if (!figure || still) return;
    const controls = animate(figure, { opacity: [0, 1] }, { duration: 0.2 });
    return () => controls.stop();
  }, [index, still]);

  // Exit: AnimatePresence keeps us mounted until safeToRemove().
  useEffect(() => {
    if (isPresent) return;
    const host = root.current;
    const finish = () => safeToRemove?.();
    if (!host) return finish();
    const controls = animate(host, { opacity: 0 }, { duration: still ? 0.1 : 0.18 });
    running.current.push(controls);
    controls.then(finish, finish);
  }, [isPresent, safeToRemove, still]);

  useEffect(() => {
    const list = running.current;
    return () => list.forEach((controls) => controls.stop());
  }, []);

  const onImageClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (pan.current?.moved) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (zoomed) {
      zoom(false);
      return;
    }
    zoom(true, {
      x: (event.clientX - box.left) / Math.max(1, box.width),
      y: (event.clientY - box.top) / Math.max(1, box.height),
    });
  };

  // Mouse drag pans the zoomed image; a touch swipe in fit mode changes shot.
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const area = stage.current;
    if (!area) return;
    if (zoomed && event.pointerType === "mouse" && event.button === 0) {
      pan.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: area.scrollLeft,
        top: area.scrollTop,
        moved: false,
      };
      return;
    }
    if (!zoomed && event.pointerType !== "mouse") {
      swipe.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = pan.current;
    const area = stage.current;
    if (!state || !area || state.id !== event.pointerId) return;
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    if (!state.moved && Math.hypot(dx, dy) < 4) return;
    if (!state.moved) event.currentTarget.setPointerCapture(event.pointerId);
    state.moved = true;
    area.scrollLeft = state.left - dx;
    area.scrollTop = state.top - dy;
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = swipe.current;
    swipe.current = null;
    // Let the click after a pan see `moved`, then forget the pan.
    const panState = pan.current;
    setTimeout(() => {
      if (pan.current === panState) pan.current = null;
    }, 0);
    if (!state || state.id !== event.pointerId) return;
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  };

  if (!item || typeof document === "undefined") return null;
  const alt =
    item.alt ?? `${title}: ${DEVICE_NAME[item.device].toLowerCase()} screenshot ${index + 1}`;

  return createPortal(
    <div
      ref={root}
      className="hk-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} screenshots`}
      data-lenis-prevent
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <div className="hk-lightbox-bar">
        <p className="hk-pixel text-xs">
          <span className="text-lime">{DEVICE_NAME[item.device]}</span>
          <span aria-hidden="true"> · </span>
          <span className="hk-mono">
            {index + 1} / {count}
          </span>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="hk-lightbox-btn"
            onClick={() => zoom(!zoomed)}
            aria-pressed={zoomed}
            aria-label={zoomed ? "Fit to screen" : "Zoom in"}
            title={zoomed ? "Fit (−)" : "Zoom (+)"}
          >
            {zoomed ? (
              <ZoomOut aria-hidden="true" className="size-5" strokeWidth={2.5} />
            ) : (
              <ZoomIn aria-hidden="true" className="size-5" strokeWidth={2.5} />
            )}
          </button>
          <button
            ref={closeButton}
            type="button"
            className="hk-lightbox-btn"
            onClick={onClose}
            aria-label="Close fullscreen view"
            title="Close (Esc)"
          >
            <X aria-hidden="true" className="size-5" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div
        ref={stage}
        className="hk-lightbox-stage"
        data-zoomed={zoomed || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipe.current = null;
          pan.current = null;
        }}
        onClick={(event) => {
          // A click on the dark area around the image closes (not after a pan).
          if (event.target === event.currentTarget && !zoomed) onClose();
        }}
      >
        <figure className="hk-lightbox-figure" data-lightbox-figure>
          <div
            className="hk-lightbox-image"
            data-lightbox-image
            style={{ width: zoomed ? zoomWidth : fitWidth }}
            onClick={onImageClick}
          >
            <Media
              key={item.id}
              media={item}
              alt={alt}
              seed={`${seed}-${item.id}`}
              accent={accent}
              ratio={ratio}
              sizes={zoomed ? `${item.width ?? 1920}px` : "92vw"}
              imgClassName="object-contain"
            />
          </div>
        </figure>
      </div>

      <div className="hk-lightbox-foot">
        <button
          type="button"
          className="hk-lightbox-btn"
          onClick={() => step(-1)}
          disabled={count < 2}
          aria-label="Previous screenshot"
        >
          <ChevronLeft aria-hidden="true" className="size-6" strokeWidth={2.5} />
        </button>
        <p className="min-w-0 flex-1 text-center text-sm" aria-live="polite">
          {item.caption ?? <span className="sr-only">{alt}</span>}
        </p>
        <button
          type="button"
          className="hk-lightbox-btn"
          onClick={() => step(1)}
          disabled={count < 2}
          aria-label="Next screenshot"
        >
          <ChevronRight aria-hidden="true" className="size-6" strokeWidth={2.5} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
