"use client";

import { useRef, type ReactNode } from "react";

import { useMotionGate } from "@/components/chapters/shared/motion";
import { completeStageHint, useStageHint } from "@/components/game/useStageHint";
import { Draggable, gsap, InertiaPlugin, MEDIA, SplitText, useGSAP } from "@/lib/gsap";
import { useHudStore } from "@/lib/store";

import { onTossStickers, reflect } from "./stickers";

type Props = {
  /** sections.hint of the hero ("Grab the sticker and throw it. …"). */
  hint: string | null;
  className?: string;
  children: ReactNode;
};

type Boot = ReturnType<typeof useHudStore.getState>["boot"];

/** gsap.matchMedia hands out an untyped contextSafe; this keeps the wrapped function's type. */
type Safe = <T extends (...args: never[]) => unknown>(fn: T) => T;
const typed =
  (contextSafe: ((fn: never) => unknown) | undefined): Safe =>
  (fn) =>
    contextSafe ? (contextSafe(fn as never) as typeof fn) : fn;

/**
 * Client island of Chapter 1 (spec §4.1 hero). The markup stays server-rendered and fully
 * readable without JS; this component only adds behaviour to the hooks inside it:
 * - [data-hero-name]: per-letter SplitText reveal when the splash ends (useHudStore.boot);
 * - [data-sticker]: Draggable + InertiaPlugin stickers that bounce inside [data-sticker-bounds],
 *   with keyboard nudging on the sticker buttons and the "Toss stickers" buttons;
 * - [data-depth]: layered parallax that follows the mouse (desktop) or the phone's tilt.
 * Everything lives in one useGSAP context, so React unmounts revert it all.
 */
export function HeroScene({ hint, className, children }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const { ready, lite } = useMotionGate();

  useStageHint("hero", hint, root);

  useGSAP(
    () => {
      const wrap = root.current;
      if (!ready || !wrap) return;
      const section = wrap.closest("section") ?? wrap;
      const mm = gsap.matchMedia();

      // Exactly one of the two queries matches, so this runs once and again only when the OS
      // reduced-motion setting flips (then GSAP reverts the reveal first).
      mm.add(
        { motionOk: "(prefers-reduced-motion: no-preference)", reduce: MEDIA.reduce },
        (context, contextSafe) => {
          if (lite || context.conditions?.reduce) return; // Lite: the name is simply there
          return revealName(wrap, typed(contextSafe));
        },
      );

      mm.add(MEDIA, (context, contextSafe) => {
        const { desktop, mobile, finePointer, reduce } = context.conditions ?? {};
        const motion = !lite && !reduce;
        const shared = { dragging: false };
        const cleanups = [setupStickers(wrap, section, motion, shared, typed(contextSafe))];
        if (motion) {
          cleanups.push(setupParallax(wrap, section, shared, { desktop, mobile, finePointer }));
        }
        return () => cleanups.forEach((cleanup) => cleanup());
      });
    },
    { scope: root, dependencies: [ready, lite], revertOnUpdate: true },
  );

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}

// ── Name reveal ───────────────────────────────────────────────────────────

/**
 * No flash, by design:
 * - the server HTML shows the name (no JS, Lite, slow hydration: it is simply visible);
 * - the letters are hidden only while the splash is "playing" — the overlay covers the Hero
 *   then, so nobody sees them disappear — and revealed when it reports "done";
 * - if the splash never played (seen this session, reduced motion) the name has been on screen
 *   since the first paint, so it gets a letter-by-letter "power-on" hop instead and is never
 *   hidden at all.
 */
function revealName(wrap: HTMLElement, safe: Safe) {
  const parts = Array.from(wrap.querySelectorAll<HTMLElement>("[data-hero-name] > span"));
  if (parts.length === 0) return;

  let split: SplitText | null = null;
  let phase: "idle" | "hidden" | "done" = "idle";

  const letters = () => {
    // One <span> per letter. aria "hidden" hides the letter soup from screen readers; the <h1>
    // carries aria-label={full name}, so the heading still reads as one name. The split is
    // created inside the GSAP context, so a revert also restores the original text nodes.
    split ??= SplitText.create(parts, { type: "chars", tag: "span", aria: "hidden" });
    return split.chars;
  };

  const onBoot = safe((boot: Boot) => {
    if (phase === "done") return;

    if (boot === "playing" && phase === "idle") {
      gsap.set(letters(), {
        opacity: 0,
        yPercent: 70,
        rotation: () => gsap.utils.random(-16, 16), // function value: evaluated per letter
      });
      phase = "hidden";
      return;
    }
    if (boot !== "done") return;

    // Back to plain text nodes at the end: kerning returns and nothing stays split.
    const timeline = gsap.timeline({ onComplete: () => split?.revert() });
    if (phase === "hidden") {
      timeline.to(letters(), {
        opacity: 1,
        yPercent: 0,
        rotation: 0,
        duration: 0.7,
        ease: "back.out(1.8)",
        stagger: 0.035, // 0.035 s between letters: the name types itself in, left to right
      });
    } else {
      timeline.to(letters(), {
        keyframes: { yPercent: [0, -14, 0], easeEach: "power2.inOut" },
        duration: 0.45,
        stagger: 0.03,
      });
    }
    phase = "done";
  });

  onBoot(useHudStore.getState().boot); // the splash may already be over
  return useHudStore.subscribe((state) => onBoot(state.boot));
}

// ── Stickers ──────────────────────────────────────────────────────────────

function setupStickers(
  wrap: HTMLElement,
  section: Element,
  motion: boolean,
  shared: { dragging: boolean },
  safe: Safe,
) {
  const bounds = section.querySelector<HTMLElement>("[data-sticker-bounds]") ?? section;
  const stickers = Array.from(wrap.querySelectorAll<HTMLElement>("[data-sticker]"));
  const throws = new Map<Element, gsap.core.Tween>();

  /**
   * A throw that bounces. InertiaPlugin decelerates a free-flying proxy {x, y} from the release
   * velocity; every frame `reflect()` folds that free position back between the walls, so the
   * sticker hits an edge and comes back instead of stopping dead at it.
   */
  const fling = safe((drag: Draggable, vx: number, vy: number) => {
    const el = drag.target;
    throws.get(el)?.kill();
    drag.applyBounds(bounds); // fresh minX/maxX/minY/maxY (in the element's own x/y space)
    const { minX, maxX, minY, maxY } = drag;
    const proxy = { x: drag.x, y: drag.y };

    const tween = gsap.to(proxy, {
      inertia: {
        x: { velocity: vx },
        y: { velocity: vy },
        resistance: 650, // px/s² of "air friction": lower = longer flight
        duration: { min: 0.4, max: 1.8 },
      },
      onUpdate: () => {
        gsap.set(el, { x: reflect(proxy.x, minX, maxX), y: reflect(proxy.y, minY, maxY) });
      },
      onComplete: () => {
        drag.update(); // tell Draggable where the sticker ended up
        throws.delete(el);
        completeStageHint("hero"); // the hint asked for exactly this
      },
    });
    throws.set(el, tween);
    gsap.to(el, {
      rotation: gsap.utils.clamp(-24, 24, vx / 80), // a flick to the right spins it clockwise
      scale: 1,
      duration: 1.2,
      ease: "power3.out",
    });
  });

  const drags = stickers.map((el) => {
    const [drag] = Draggable.create(el, {
      type: "x,y",
      bounds,
      edgeResistance: 0.8, // dragging past an edge feels like pulling against a rubber band
      zIndexBoost: true, // the sticker you grab comes to the front
      cursor: "grab",
      activeCursor: "grabbing",
      onPress: () => {
        shared.dragging = true; // freeze the parallax so the sticker stays under the pointer
        throws.get(el)?.kill(); // catch it mid-flight
      },
      onDragStart: () => {
        if (motion) gsap.to(el, { scale: 1.08, duration: 0.15, ease: "power2.out" });
      },
      onRelease: () => {
        shared.dragging = false;
      },
      onDragEnd: () => {
        // Draggable tracks x/y velocity through InertiaPlugin while the pointer moves.
        const vx = InertiaPlugin.getVelocity(el, "x");
        const vy = InertiaPlugin.getVelocity(el, "y");
        if (motion && Math.hypot(vx, vy) > 120) {
          fling(drag, vx, vy);
        } else {
          if (motion) gsap.to(el, { scale: 1, duration: 0.25, ease: "back.out(3)" });
          completeStageHint("hero"); // placed instead of thrown: the visitor got the idea
        }
      },
    });
    return drag;
  });

  /** Keyboard alternative (spec §11): arrows nudge a focused sticker, Enter/Space throws it. */
  const aims = new Map<Element, { x: number; y: number }>(); // where a running nudge is heading
  const nudge = safe((drag: Draggable, dx: number, dy: number) => {
    throws.get(drag.target)?.kill();
    drag.applyBounds(bounds);
    // Repeated key presses add up from the previous target, not from the in-between position.
    const from = aims.get(drag.target) ?? { x: drag.x, y: drag.y };
    const x = gsap.utils.clamp(drag.minX, drag.maxX, from.x + dx);
    const y = gsap.utils.clamp(drag.minY, drag.maxY, from.y + dy);
    if (motion) {
      aims.set(drag.target, { x, y });
      gsap.to(drag.target, {
        x,
        y,
        duration: 0.18,
        ease: "power2.out",
        overwrite: "auto", // replaces the previous nudge's x/y tween instead of fighting it
        onUpdate: () => void drag.update(),
        onComplete: () => void aims.delete(drag.target),
      });
    } else {
      gsap.set(drag.target, { x, y });
      drag.update();
    }
    completeStageHint("hero");
  });

  const toss = safe((drag: Draggable) => {
    if (drag.target.getClientRects().length === 0) return; // hidden (stat stickers on phones)
    drag.applyBounds(bounds);
    if (motion) {
      const angle = Math.random() * Math.PI * 2;
      const speed = gsap.utils.random(1500, 2600);
      fling(drag, Math.cos(angle) * speed, Math.sin(angle) * speed);
    } else {
      // Lite: no flight, the sticker just lands somewhere else.
      gsap.set(drag.target, {
        x: gsap.utils.random(drag.minX, drag.maxX),
        y: gsap.utils.random(drag.minY, drag.maxY),
      });
      drag.update();
      completeStageHint("hero");
    }
  });

  const keyListeners = drags
    .filter((drag) => drag.target instanceof HTMLButtonElement)
    .map((drag) => {
      const onKey = (event: KeyboardEvent) => {
        const step = event.shiftKey ? 96 : 24;
        const moves: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
        };
        const move = moves[event.key];
        if (move) {
          event.preventDefault(); // no page scroll while steering a sticker
          nudge(drag, move[0], move[1]);
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toss(drag);
        }
      };
      drag.target.addEventListener("keydown", onKey as EventListener);
      return () => drag.target.removeEventListener("keydown", onKey as EventListener);
    });

  const offToss = onTossStickers(() => drags.forEach((drag) => toss(drag)));

  // A narrower window shrinks the hero: pull stickers that ended up outside back in.
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => drags.forEach((drag) => drag.applyBounds(bounds)), 200);
  };
  window.addEventListener("resize", onResize);

  return () => {
    keyListeners.forEach((remove) => remove());
    offToss();
    clearTimeout(resizeTimer);
    window.removeEventListener("resize", onResize);
    throws.forEach((tween) => tween.kill());
  };
}

// ── Parallax ──────────────────────────────────────────────────────────────

/** iOS needs a permission prompt (and a tap) for tilt: we never prompt on load, so skip it. */
function canUseTilt(): boolean {
  if (typeof DeviceOrientationEvent === "undefined") return false;
  const ctor = DeviceOrientationEvent as unknown as { requestPermission?: unknown };
  return typeof ctor.requestPermission !== "function";
}

function setupParallax(
  wrap: HTMLElement,
  section: Element,
  shared: { dragging: boolean },
  media: { desktop?: boolean; mobile?: boolean; finePointer?: boolean },
) {
  // quickTo = one reusable tween per layer and axis; calling it just retargets the tween, which
  // is far cheaper than creating a new tween on every pointermove.
  const layers = Array.from(wrap.querySelectorAll<HTMLElement>("[data-depth]")).map((el) => {
    const depth = Number(el.dataset.depth) || 0;
    return {
      depth,
      x: gsap.quickTo(el, "x", { duration: 0.9, ease: "power3" }),
      y: gsap.quickTo(el, "y", { duration: 0.9, ease: "power3" }),
    };
  });

  let inView = true;
  const observer = new IntersectionObserver(([entry]) => (inView = entry.isIntersecting));
  observer.observe(section);

  /** nx/ny in −1…1 (pointer or tilt). Deeper layers ([data-depth] bigger) travel further. */
  const aim = (nx: number, ny: number) => {
    if (!inView || shared.dragging) return;
    for (const layer of layers) {
      layer.x(nx * layer.depth * 16);
      layer.y(ny * layer.depth * 12);
    }
  };

  const removers: Array<() => void> = [];
  if (media.desktop && media.finePointer) {
    const onMove = (event: PointerEvent) =>
      aim(
        (event.clientX / window.innerWidth) * 2 - 1,
        (event.clientY / window.innerHeight) * 2 - 1,
      );
    window.addEventListener("pointermove", onMove, { passive: true });
    removers.push(() => window.removeEventListener("pointermove", onMove));
  } else if (media.mobile && canUseTilt()) {
    const clamp = gsap.utils.clamp(-1, 1);
    const onTilt = (event: DeviceOrientationEvent) => {
      if (event.gamma === null || event.beta === null) return;
      // gamma = left/right tilt; beta = forward tilt, ~40° when a phone is held to read.
      aim(clamp(event.gamma / 25), clamp((event.beta - 40) / 25));
    };
    window.addEventListener("deviceorientation", onTilt);
    removers.push(() => window.removeEventListener("deviceorientation", onTilt));
  }

  return () => {
    observer.disconnect();
    removers.forEach((remove) => remove());
  };
}
