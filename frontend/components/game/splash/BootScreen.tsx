"use client";

import { useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

import { avatarFrameSetter, PixelAvatar } from "@/components/game/PixelAvatar";
import { lockScroll } from "@/components/providers/SmoothScroll";
import { gsap, useGSAP } from "@/lib/gsap";
import { readSaveCookie, visitedCount } from "@/lib/save";
import { unlockAudio } from "@/lib/sound";
import { hasProgress, useGameStore, useHudStore } from "@/lib/store";
import { SECTION_KEYS } from "@/lib/types";

import { watchCriticalAssets } from "./criticalAssets";
import { BOOT_SEEN_KEY, PREPAINT_PREFS_KEY, prepaint } from "./prepaint";

/**
 * Chapter 0 — the boot screen / splash (spec §5.1). Server-rendered as part of Home, shown only
 * when the pre-paint head script set <html data-boot="play"> (CSS), so it covers the Hero from the
 * very first frame while the Hero still renders (and paints its LCP) underneath.
 *
 * One GSAP master timeline drives the whole sequence. It is *extended* as real-world events
 * arrive instead of being written up front: intro → (assets loaded) ready → (START/SKIP) wipe.
 * Small endless loops (tips, START blink, the runner's legs) live outside it, because an infinite
 * child would make the master timeline infinitely long.
 */

const MIN_MS = 2200;
const MIN_RETURNING_MS = 1200;
/** Hard cap measured from navigation start: after this the bar is forced to 100 %. */
const MAX_MS = 5000;
/** The eased display trails its goal by ~this much; the time cap ends early to compensate. */
const EASE_LAG_MS = 300;
const SEGMENTS = 20;
const STRIPS = 8;

const TIPS = [
  "Tip: Equip up to 4 skills",
  "Tip: Every project is a boss",
  "Tip: Press ? for a hint",
  "Tip: Your save file lasts 7 days",
];

type Phase = "loading" | "ready" | "exiting";
type ExitKind = "start" | "continue" | "new" | "skip";

type Props = {
  /** Wordmark that flickers in first (the nickname). */
  wordmark: string;
  /** Big title ("PLAYER ONE": the Hero's stage title). */
  title: string;
  /** The boot section's title, for the dialog label. */
  label: string;
  /** The boot section's hint (sections.hint), shown at the bottom. */
  hint: string | null;
  /** Ids of every boss project, for the "BOSSES 2/4" summary. */
  bossIds: number[];
};

/** Runs `fn` once the save cookie is in the store (never write progress before that). */
function whenHydrated(fn: () => void) {
  if (useGameStore.getState().hydrated) return fn();
  const unsubscribe = useGameStore.subscribe((state) => {
    if (!state.hydrated) return;
    unsubscribe();
    fn();
  });
}

/** Makes everything except the splash inert (unfocusable, hidden from screen readers). */
function inertOutside(root: HTMLElement): () => void {
  const changed: HTMLElement[] = [];
  const consider = (el: Element) => {
    if (!(el instanceof HTMLElement) || el === root || el.contains(root) || el.inert) return;
    // Leave scripts and dev tooling (custom elements such as <nextjs-portal>) alone.
    if (/^(SCRIPT|STYLE|LINK|TEMPLATE|NOSCRIPT)$/.test(el.tagName) || el.tagName.includes("-")) {
      return;
    }
    el.inert = true;
    changed.push(el);
  };
  Array.from(document.body.children).forEach(consider);
  if (root.parentElement) Array.from(root.parentElement.children).forEach(consider);
  return () => {
    changed.forEach((el) => (el.inert = false));
    changed.length = 0; // idempotent: finish() and the effect cleanup both call it
  };
}

/** After the wipe, keyboard focus continues at the Hero heading (not lost on <body>). */
function focusHero(root: HTMLElement) {
  const active = document.activeElement;
  if (active && active !== document.body && !root.contains(active)) return;
  const target = document.getElementById("hero-title") ?? document.getElementById("main");
  if (!target) return;
  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
    target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
  }
  target.setAttribute("data-focus-target", "");
  target.focus({ preventScroll: true });
}

export function BootScreen({ wordmark, title, label, hint, bossIds }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const actions = useRef<{ exit: (kind: ExitKind) => void } | null>(null);
  const [gone, setGone] = useState(false);
  const [summary, setSummary] = useState("");

  useGSAP(
    (_context, contextSafe) => {
      const el = root.current;
      const html = document.documentElement;
      const setBoot = useHudStore.getState().setBoot;
      if (!el || !contextSafe) return;

      // React's dev-only Strict Mode remount resets <html> attributes: decide again if needed.
      if (!html.dataset.boot) prepaint(PREPAINT_PREFS_KEY, BOOT_SEEN_KEY);
      if (html.dataset.boot !== "play" && html.dataset.boot !== "live") {
        // Seen this session, reduced motion, Lite mode, or Home reached by client navigation.
        setBoot("done");
        setGone(true);
        return;
      }

      // ── Take over from the CSS-only first paint ─────────────────────────
      html.dataset.boot = "live"; // disarms the CSS failsafe that hides a splash whose JS never ran
      setBoot("playing");
      if (window.scrollY !== 0) window.scrollTo(0, 0);
      const releaseScroll = lockScroll(); // Lenis stop + overflow hidden (scrollbar-gutter: stable)
      const restoreInert = inertOutside(el);

      const $ = <T extends Element = HTMLElement>(selector: string) =>
        el.querySelector<T>(selector)!;
      const $$ = (selector: string) => gsap.utils.toArray<HTMLElement>(selector, el);

      const screen = $("[data-screen]");
      const track = $("[data-track]");
      const runner = $("[data-runner]");
      const hop = $("[data-hop]");
      const live = $("[data-live]");
      const segments = $$("[data-seg]");
      const strips = $$("[data-strip]");

      // A returning player gets the short version (spec §5.1 point 6). The store hydrates in a
      // passive effect, i.e. after this layout effect, so peek at the cookie through lib/save.ts.
      const peek = readSaveCookie();
      const returningAtStart = peek !== null && hasProgress(peek);
      const minMs = returningAtStart ? MIN_RETURNING_MS : MIN_MS;
      const speed = returningAtStart ? 1.5 : 1;

      let phase: Phase = "loading";
      let introDone = false;
      let returning = false;
      const announce = (text: string) => {
        live.textContent = text;
      };
      announce("Loading save file.");

      // ── 1–3. Power-on intro (≈ 1.1 s) ────────────────────────────────────
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      tl.timeScale(speed);
      tl.fromTo("[data-beam]", { scaleX: 0 }, { scaleX: 1, duration: 0.16, ease: "power2.in" })
        // CRT: the thin line opens into the full screen (scaleY), with a quick phosphor flash.
        .fromTo(
          screen,
          { scaleY: 0.004 },
          { scaleY: 1, duration: 0.34, ease: "expo.out" },
          ">-0.02",
        )
        .to("[data-beam]", { opacity: 0, duration: 0.12 }, "<")
        .fromTo("[data-flash]", { opacity: 0.5 }, { opacity: 0, duration: 0.45 }, "<")
        .addLabel("brand", "-=0.12")
        // Flicker = an opacity keyframe sequence with a linear ease (hard on/off steps).
        .fromTo(
          "[data-wordmark]",
          { opacity: 0 },
          { keyframes: { opacity: [0, 1, 0.15, 1, 0.35, 1] }, duration: 0.42, ease: "none" },
          "brand",
        )
        .fromTo("[data-skip]", { opacity: 0 }, { opacity: 1, duration: 0.3 }, "brand")
        .fromTo(
          "[data-title]",
          { opacity: 0, y: 28 },
          { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" },
          "brand+=0.2",
        )
        .fromTo(
          '[data-status="loading"]',
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.25 },
          "<+0.15",
        )
        .fromTo(
          "[data-loader]",
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.35 },
          "<+0.05",
        )
        .fromTo("[data-tips]", { opacity: 0 }, { opacity: 1, duration: 0.3 }, "<")
        .fromTo("[data-hint]", { opacity: 0 }, { opacity: 1, duration: 0.3 }, "<")
        .call(() => {
          introDone = true;
          if (display >= 100) ready();
        });

      // Endless helpers (outside the master timeline).
      const tips = $$("[data-tip]");
      const tipsTl = gsap.timeline({ repeat: -1, paused: true });
      tips.forEach((tip, i) => {
        tipsTl
          .fromTo(tip, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.3 }, i ? "<" : 0)
          .to(tip, { autoAlpha: 0, y: -6, duration: 0.3 }, "+=0.9"); // ≈ 1.2 s per tip
      });
      const tipsStart = gsap.delayedCall(0.85 / speed, () => void tipsTl.play());

      const setFrame = avatarFrameSetter(runner);
      let frame = 0;
      const legs = gsap.to(
        {},
        { duration: 0.11, repeat: -1, onRepeat: () => setFrame((frame = 1 - frame)) },
      );

      // ── 4. Real progress, eased, never backwards ─────────────────────────
      const assets = watchCriticalAssets();
      const t0 = performance.now();
      // performance.now() counts from navigation start, so MAX_MS includes the time before JS ran;
      // always leave the animation ~1.2 s so a slow hydration doesn't end in a blink.
      const maxEnd = Math.max(MAX_MS, t0 + 1200 / speed);
      const minEnd = Math.min(t0 + minMs, maxEnd);
      const setRunner = gsap.quickSetter(runner, "xPercent");
      const reels = $$("[data-reel]").map((reel) => gsap.quickSetter(reel, "y", "em"));
      let display = 0;
      let filled = 0;
      let announcedHalf = false;
      let lastValue = -1;

      const render = (value: number) => {
        setRunner(value);
        // Odometer: the ones reel rolls continuously; tens/hundreds roll during the last unit
        // before they change, like a mechanical counter. Reels hold 0–9 plus a trailing 0.
        const ones = value % 10;
        const carry = Math.max(0, ones - 9);
        reels[2]?.(-ones);
        reels[1]?.(-((Math.floor(value / 10) % 10) + carry));
        reels[0]?.(-(value >= 100 ? 1 : Math.max(0, value - 99)));
        const nextFilled = Math.floor((value / 100) * SEGMENTS);
        for (let i = filled; i < nextFilled; i++) segments[i]?.classList.add("is-on");
        filled = Math.max(filled, nextFilled);
        const rounded = Math.round(value);
        if (rounded !== lastValue) {
          lastValue = rounded;
          track.setAttribute("aria-valuenow", String(rounded));
        }
        if (!announcedHalf && value >= 50 && value < 100) {
          announcedHalf = true;
          announce("Loading, 50 percent.");
        }
      };

      const tick = (_time: number, deltaMs: number) => {
        const now = performance.now();
        let goal = now >= maxEnd ? 100 : assets.fraction() * 100;
        const cap = (100 * (now - t0)) / Math.max(1, minEnd - t0 - EASE_LAG_MS);
        goal = Math.min(goal, cap, 100);
        // Frame-rate independent exponential ease toward the goal (τ = 110 ms).
        const next = display + (goal - display) * (1 - Math.exp(-deltaMs / 110));
        display = goal >= 100 && 100 - next < 0.4 ? 100 : Math.max(display, next);
        render(display);
        if (display >= 100 && introDone) ready();
      };
      gsap.ticker.add(tick);

      // ── 5./6. Ready: PRESS START, or SAVE FILE FOUND + CONTINUE / NEW GAME ─────
      let blink: gsap.core.Tween | null = null;
      const ready = contextSafe(() => {
        if (phase !== "loading") return;
        phase = "ready";
        gsap.ticker.remove(tick);
        legs.kill();
        setFrame(0);

        const save = useGameStore.getState();
        returning = save.hydrated && hasProgress(save);
        const bossSet = new Set(bossIds);
        const bosses = save.defeated.filter((id) => bossSet.has(id)).length;
        const stages = visitedCount(save.visited);
        if (returning) {
          setSummary(
            [
              bossIds.length ? `Bosses ${bosses}/${bossIds.length}` : null,
              `Badges ${save.badges.length}`,
              `Stages ${stages}/${SECTION_KEYS.length}`,
            ]
              .filter(Boolean)
              .join(" · "),
          );
        }

        const cta = $(returning ? '[data-cta="returning"]' : '[data-cta="new"]');
        const primary = $<HTMLButtonElement>(returning ? "[data-continue]" : "[data-start]");
        const seg = gsap
          .timeline()
          // the bar blinks: done
          .to(track, { keyframes: { opacity: [1, 0.2, 1, 0.2, 1] }, duration: 0.5, ease: "none" })
          .to(hop, { y: -10, duration: 0.14, yoyo: true, repeat: 3, ease: "power2.out" }, 0)
          .to('[data-status="loading"]', { autoAlpha: 0, duration: 0.15 }, 0)
          .fromTo(
            returning ? '[data-status="found"]' : '[data-status="new"]',
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: 0.2 },
            0.15,
          )
          .fromTo(
            cta,
            { autoAlpha: 0, y: 14 },
            { autoAlpha: 1, y: 0, duration: 0.35, ease: "power3.out" },
            0.3,
          )
          .call(() => {
            if (phase !== "ready") return;
            primary.focus({ preventScroll: true }); // spec: PRESS START is auto-focused
            // ~1 Hz blink that stops after 5 s (WCAG 2.2.2: no endless blinking).
            blink = gsap.to(primary.querySelector("[data-blink]"), {
              opacity: 0.45,
              duration: 0.5,
              ease: "steps(1)",
              repeat: 9,
              yoyo: true,
            });
          });
        tl.add(seg, tl.time()).play();
        announce(
          returning
            ? `Save file found. ${bosses} of ${bossIds.length} bosses defeated, ${save.badges.length} badges. Continue, or start a new game.`
            : "Ready. Press Start to begin.",
        );
      });

      // ── START / CONTINUE / NEW GAME / SKIP → 8-strip wipe ───────────────
      const exit = contextSafe((kind: ExitKind) => {
        if (phase === "exiting") return;
        phase = "exiting";
        unlockAudio(); // we are inside the click/keydown handler: the browser allows audio now
        if (kind === "new") useGameStore.getState().reset();
        if (kind !== "skip") {
          whenHydrated(() => useGameStore.getState().unlockBadge("first-steps"));
        }
        try {
          window.sessionStorage.setItem(BOOT_SEEN_KEY, "1");
        } catch {
          // storage blocked: the splash will play again on reload, nothing else breaks
        }
        gsap.ticker.remove(tick);
        legs.kill();
        tipsStart.kill();
        tipsTl.pause();
        blink?.kill();
        announce("");

        // The Hero's own intro starts now, while the strips still cover it, so its reveal
        // overlaps the wipe instead of starting after it.
        setBoot("done");
        const fast = kind === "skip";
        const wipe = gsap
          .timeline({ onComplete: finish })
          .to(screen, { opacity: 0, duration: fast ? 0.12 : 0.2, ease: "power1.in" })
          .to("[data-beam]", { opacity: 0, duration: 0.1 }, 0)
          // Even strips are anchored at the top, odd ones at the bottom (CSS transform-origin),
          // so scaling them all to 0 retracts them in alternating directions.
          .to(
            strips,
            { scaleY: 0, duration: fast ? 0.42 : 0.6, ease: "power3.inOut", stagger: 0.045 },
            fast ? 0.04 : 0.12,
          );
        tl.add(wipe, tl.time()).play();
      });

      let finished = false;
      function finish() {
        if (finished || !el) return;
        finished = true;
        html.dataset.boot = "done";
        releaseScroll();
        restoreInert();
        focusHero(el);
        setGone(true);
      }

      actions.current = { exit };

      // ── Input: Esc skips any time; Enter/Space/click/tap start once ready ──
      const primaryAction = (): ExitKind => (returning ? "continue" : "start");
      const onKey = (event: KeyboardEvent) => {
        if (phase === "exiting") return;
        if (event.key === "Escape") {
          event.preventDefault();
          exit("skip");
          return;
        }
        if (event.key !== "Enter" && event.key !== " ") return;
        // A focused button activates itself (native click); don't double-fire.
        if ((event.target as Element | null)?.closest?.("button")) return;
        event.preventDefault();
        if (phase === "ready") exit(primaryAction());
      };
      const onClick = (event: MouseEvent) => {
        if (phase !== "ready" || (event.target as Element).closest("button")) return;
        exit(primaryAction());
      };
      document.addEventListener("keydown", onKey);
      el.addEventListener("click", onClick);

      return () => {
        document.removeEventListener("keydown", onKey);
        el.removeEventListener("click", onClick);
        gsap.ticker.remove(tick);
        assets.dispose();
        releaseScroll();
        restoreInert();
        actions.current = null;
      };
    },
    { scope: root },
  );

  if (gone) return null;

  const onAction = (event: ReactMouseEvent<HTMLButtonElement>) =>
    actions.current?.exit(event.currentTarget.dataset.action as ExitKind);

  return (
    <div
      ref={root}
      className="hk-boot"
      data-boot-screen
      role="dialog"
      aria-modal="true"
      aria-label={`${label} screen`}
    >
      {/* Ink background in 8 strips: the wipe scales them away to reveal the Hero. */}
      <div className="hk-boot-strips" aria-hidden="true">
        {Array.from({ length: STRIPS }, (_, i) => (
          <span key={i} data-strip style={{ left: `${(i * 100) / STRIPS}%` }} />
        ))}
      </div>
      <div className="hk-boot-beam" data-beam aria-hidden="true" />

      <div className="hk-boot-screen" data-screen>
        <div className="hk-boot-flash" data-flash aria-hidden="true" />
        <div className="hk-boot-inner">
          <div className="flex items-start justify-between gap-4">
            <p className="hk-boot-wordmark hk-pixel" data-wordmark aria-hidden="true">
              {wordmark}
            </p>
            <button
              type="button"
              className="hk-boot-skip hk-pixel"
              data-skip
              data-action="skip"
              onClick={onAction}
            >
              Skip <span aria-hidden="true">▸▸</span>
            </button>
          </div>

          <div className="hk-boot-main">
            <p className="hk-boot-title hk-display hk-condensed" data-title>
              {title}
            </p>
            <p className="hk-boot-status hk-pixel" aria-hidden="true">
              <span data-status="loading">
                Loading save file<span className="hk-boot-caret">…</span>
              </span>
              <span data-status="new">New save file ready</span>
              <span data-status="found">Save file found</span>
            </p>

            <div className="hk-boot-loader" data-loader>
              <div
                className="hk-boot-track"
                data-track
                role="progressbar"
                aria-label="Loading"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={0}
              >
                <div className="hk-boot-runner" data-runner aria-hidden="true">
                  <div data-hop>
                    <PixelAvatar scale={3} />
                  </div>
                </div>
                {Array.from({ length: SEGMENTS }, (_, i) => (
                  <span key={i} className="hk-boot-seg" data-seg />
                ))}
              </div>
              <p className="hk-odo hk-mono" aria-hidden="true">
                {[2, 10, 10].map((last, col) => (
                  <span key={col} className="hk-odo-col">
                    <span className="hk-odo-reel" data-reel>
                      {Array.from({ length: last + 1 }, (_, d) => (
                        <span key={d}>{d % 10}</span>
                      ))}
                    </span>
                  </span>
                ))}
                <span className="hk-odo-unit">%</span>
              </p>
            </div>

            <div className="hk-boot-tips hk-pixel" data-tips>
              {TIPS.map((tip) => (
                <p key={tip} data-tip>
                  {tip}
                </p>
              ))}
            </div>

            <div className="hk-boot-cta">
              <div data-cta="new">
                <button
                  type="button"
                  className="hk-boot-btn hk-pixel"
                  data-start
                  data-action="start"
                  onClick={onAction}
                >
                  <span aria-hidden="true">▶</span> <span data-blink>Press start</span>
                </button>
              </div>
              <div data-cta="returning">
                <p className="hk-boot-summary hk-pixel">{summary || " "}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="hk-boot-btn hk-pixel"
                    data-continue
                    data-action="continue"
                    onClick={onAction}
                  >
                    <span aria-hidden="true">▶</span> <span data-blink>Continue</span>
                  </button>
                  <button
                    type="button"
                    className="hk-boot-btn hk-boot-btn-ghost hk-pixel"
                    data-action="new"
                    onClick={onAction}
                  >
                    New game
                  </button>
                </div>
              </div>
            </div>
          </div>

          {hint ? (
            <p className="hk-boot-hint" data-hint>
              {hint}
            </p>
          ) : null}
        </div>
      </div>

      <p className="sr-only" aria-live="polite" data-live />
    </div>
  );
}
