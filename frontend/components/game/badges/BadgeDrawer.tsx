"use client";

import { Lock, RotateCcw, X } from "lucide-react";
import { animate, type AnimationPlaybackControlsWithThen } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { useGameConfig } from "@/components/game/GameConfig";
import { lockScroll } from "@/components/providers/SmoothScroll";
import { inertOutside, trapTab } from "@/components/ui/focus";
import { useStill } from "@/components/ui/useStill";
import { BADGES, badgeProgress, chapterMask, knownBadges, type BadgeDef } from "@/lib/badges";
import { useGameStore, useHintStore } from "@/lib/store";
import type { SectionKey } from "@/lib/types";
import { cn } from "@/lib/utils";

import { badgeDrawerClosed, closeBadgeDrawer, useBadgeDrawer } from "./drawer";
import { clearOpened, loadOpened, useOpenedStore } from "./opened";
import { PixelIcon } from "./PixelIcon";

export const BADGE_DRAWER_ID = "hk-badges";
const TITLE_ID = "hk-badges-title";

/** Quart-out / quad-in, as the trophy dialog. */
const EASE_OUT = [0.25, 1, 0.5, 1] as const;
const EASE_IN = [0.5, 0, 0.75, 0] as const;

/**
 * The Badges drawer (spec §5 badges, §5.2 privacy): opened from the HUD's Badges button. Lists all
 * ten badges — unlocked ones in colour with how they were earned, locked ones as a silhouette with
 * the condition (Konami stays a teaser) and, for counting badges, the progress. Shows the cookie
 * line and Reset save (two-step confirm; the same as NEW GAME: every bit of progress goes,
 * hints included). After a reset everything shows locked again.
 *
 * Modal while open: scroll locked, the rest of the page inert (the toast live region stays live),
 * Tab trapped, Esc / ✕ / backdrop close it, focus returns to the button. Motion slides the panel
 * in from the right (transform + opacity); Lite / reduced motion: a plain fade.
 * Server-rendered and hidden: without JavaScript the HUD shows an anchor to #hk-badges and CSS
 * opens the panel with :target (all badges locked; Reset save hidden — there is no save).
 */
export function BadgeDrawer({ chapterKeys }: { chapterKeys: SectionKey[] }) {
  const root = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const running = useRef<AnimationPlaybackControlsWithThen[]>([]);
  const phase = useBadgeDrawer((state) => state.phase);
  const opens = useBadgeDrawer((state) => state.opens);
  const still = useStill();
  const stillRef = useRef(still);

  const hydrated = useGameStore((state) => state.hydrated);
  const badges = useGameStore((state) => state.badges);
  const visited = useGameStore((state) => state.visited);
  const defeated = useGameStore((state) => state.defeated);
  const opened = useOpenedStore((state) => state.slugs.length);
  const { featuredBossIds } = useGameConfig();

  useLayoutEffect(() => {
    stillRef.current = still;
  }, [still]);

  // Modal behaviour while open. The cleanup runs as soon as it starts closing: focus is back on
  // the HUD button (before the scroll lock lets go) while the panel still slides out.
  const open = phase === "open";
  useEffect(() => {
    const host = root.current;
    if (!open || !host) return;
    loadOpened();
    useHintStore.getState().dismiss();
    const releaseScroll = lockScroll();
    const restoreInert = inertOutside([host]);
    const html = document.documentElement;
    html.dataset.overlay = "dialog";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeBadgeDrawer();
        return;
      }
      const dialog = host.querySelector<HTMLElement>("[role='dialog']");
      if (dialog) trapTab(event, dialog);
    };
    document.addEventListener("keydown", onKey);
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      if (html.dataset.overlay === "dialog") delete html.dataset.overlay;
      restoreInert();
      const trigger = useBadgeDrawer.getState().trigger;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      releaseScroll();
    };
  }, [open]);

  // Enter / exit. A layout effect: the starting transform is set before the first painted frame.
  useLayoutEffect(() => {
    const host = root.current;
    const panel = host?.querySelector<HTMLElement>("[data-badges-panel]");
    const backdrop = host?.querySelector<HTMLElement>("[data-badges-backdrop]");
    if (!host || !panel || !backdrop) return;
    running.current.forEach((controls) => controls.stop());
    running.current = [];
    const keep = (controls: AnimationPlaybackControlsWithThen) => {
      running.current.push(controls);
      return controls;
    };
    const items = Array.from(host.querySelectorAll<HTMLElement>("[data-badge-item]"));
    const clear = () => {
      for (const el of [host, panel, backdrop, ...items]) {
        el.style.removeProperty("transform");
        el.style.removeProperty("opacity");
      }
    };

    if (phase === "closed") {
      clear();
      return;
    }

    if (phase === "open") {
      clear();
      if (stillRef.current) {
        host.style.opacity = "0";
        keep(animate(host, { opacity: 1 }, { duration: 0.15 }));
        return;
      }
      panel.style.transform = "translateX(100%)";
      backdrop.style.opacity = "0";
      keep(animate(backdrop, { opacity: 1 }, { duration: 0.28 }));
      keep(animate(panel, { x: ["100%", "0%"] }, { duration: 0.46, ease: EASE_OUT }));
      items.forEach((item, i) => {
        item.style.opacity = "0";
        keep(
          animate(
            item,
            { opacity: [0, 1], y: [14, 0] },
            { duration: 0.32, delay: 0.16 + i * 0.03, ease: EASE_OUT },
          ),
        );
      });
      return;
    }

    // closing
    const finish = () => badgeDrawerClosed();
    if (stillRef.current) {
      keep(animate(host, { opacity: 0 }, { duration: 0.12 })).then(finish, finish);
      return;
    }
    keep(animate(backdrop, { opacity: 0 }, { duration: 0.3 }));
    keep(animate(panel, { x: "100%" }, { duration: 0.3, ease: EASE_IN })).then(finish, finish);
  }, [phase]);

  useEffect(() => {
    const list = running.current;
    return () => list.forEach((controls) => controls.stop());
  }, []);

  const owned = new Set<string>(hydrated ? knownBadges(badges) : []);
  const progressContext = {
    visited: hydrated ? visited : 0,
    requiredChapters: chapterMask(chapterKeys),
    opened: hydrated ? opened : 0,
    defeated: hydrated ? defeated : [],
    featuredBossIds,
  };
  const count = owned.size;

  return (
    <div
      ref={root}
      id={BADGE_DRAWER_ID}
      className="hk-badges"
      data-state={phase}
      // Only while it animates out: still painted, no longer reachable.
      inert={phase === "closing" || undefined}
    >
      <div
        data-badges-backdrop
        className="hk-badges-backdrop"
        aria-hidden="true"
        onClick={closeBadgeDrawer}
      />
      <div
        data-badges-panel
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        className="hk-badges-panel"
      >
        <div className="hk-badges-head">
          <p className="hk-pixel text-ink-2 text-xs">
            <span aria-hidden="true">▸ </span>Pause · Save file
          </p>
          <h2 id={TITLE_ID} className="hk-display hk-condensed hk-badges-title">
            Badges
          </h2>
          <p className="hk-badges-count">
            <span className="hk-mono">
              {count}
              <span aria-hidden="true">/</span>
              <span className="sr-only"> of </span>
              {BADGES.length}
            </span>{" "}
            unlocked
          </p>
          <div className="hk-badges-meter" aria-hidden="true">
            {BADGES.map((badge, i) => (
              <span key={badge.id} className={cn(i < count && "is-on")} />
            ))}
          </div>
          <button
            ref={closeButton}
            type="button"
            className="hk-badges-close"
            onClick={closeBadgeDrawer}
            aria-label="Close badges"
            title="Close (Esc)"
          >
            <X aria-hidden="true" className="size-5" strokeWidth={2.5} />
          </button>
          {/* No JavaScript: leave the :target state (an unknown fragment, no scroll). */}
          <a href="#hk-badges-closed" className="hk-badges-close hk-badges-nojs">
            <X aria-hidden="true" className="size-5" strokeWidth={2.5} />
            <span className="sr-only">Close badges</span>
          </a>
        </div>

        {/* data-lenis-prevent: Lenis is stopped while open; the list scrolls natively. */}
        <div className="hk-badges-body" data-lenis-prevent>
          <ul className="hk-badges-list">
            {BADGES.map((badge, i) => (
              <BadgeItem
                key={badge.id}
                badge={badge}
                unlocked={owned.has(badge.id)}
                progress={badgeProgress(badge.id, progressContext)}
                tilt={i % 3 === 0 ? -0.6 : i % 3 === 1 ? 0.5 : 0}
              />
            ))}
          </ul>
        </div>

        <div className="hk-badges-foot">
          <p className="text-sm leading-snug">
            Your game progress is stored in a cookie for 7 days.
          </p>
          <ResetSave key={opens} />
        </div>
      </div>
    </div>
  );
}

function BadgeItem({
  badge,
  unlocked,
  progress,
  tilt,
}: {
  badge: BadgeDef;
  unlocked: boolean;
  progress: { current: number; target: number } | null;
  tilt: number;
}) {
  const hidden = !unlocked && badge.secret;
  return (
    <li
      data-badge-item
      className="hk-badge"
      data-unlocked={unlocked || undefined}
      data-tone={badge.tone}
      style={unlocked ? { rotate: `${tilt}deg` } : undefined}
    >
      <span className="hk-badge-icon">
        <PixelIcon icon={badge.icon} silhouette={!unlocked} className="size-9" />
        {unlocked ? null : (
          <span className="hk-badge-lock" aria-hidden="true">
            <Lock className="size-3" strokeWidth={3} />
          </span>
        )}
      </span>
      <div className="min-w-0">
        <h3 className="hk-badge-title">
          {hidden ? (
            <>
              <span aria-hidden="true">???</span>
              <span className="sr-only">Secret badge</span>
            </>
          ) : (
            badge.title
          )}
          <span className="sr-only">{unlocked ? " (unlocked)" : " (locked)"}</span>
        </h3>
        <p className="hk-badge-text">{unlocked ? badge.earned : badge.condition}</p>
        {!unlocked && progress ? (
          <p className="hk-badge-progress">
            <span className="hk-badge-bar" aria-hidden="true">
              <span style={{ transform: `scaleX(${progress.current / progress.target})` }} />
            </span>
            <span className="hk-mono">
              {progress.current}/{progress.target}
            </span>
          </p>
        ) : null}
      </div>
    </li>
  );
}

/** Reset save with a confirm step (spec §5.2): the same as NEW GAME on the splash. */
function ResetSave() {
  const [step, setStep] = useState<"idle" | "confirm" | "done">("idle");
  const resetButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);

  const ask = () => {
    flushSync(() => setStep("confirm"));
    cancelButton.current?.focus(); // the safe choice has the focus
  };
  const cancel = () => {
    flushSync(() => setStep("idle"));
    resetButton.current?.focus();
  };
  const reset = () => {
    useGameStore.getState().reset(); // clears the cookie: bosses, badges, loadout, hints, visits
    clearOpened();
    flushSync(() => setStep("done"));
    resetButton.current?.focus();
  };

  return (
    <div data-badges-reset className="hk-badges-reset">
      {step === "confirm" ? (
        <div role="group" aria-labelledby="hk-reset-question" className="hk-badges-confirm">
          <p id="hk-reset-question" className="text-sm font-semibold">
            Erase all progress? Defeated bosses, badges, loadout and hints start over.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="hk-btn hk-btn-hot" onClick={reset}>
              Yes, reset
            </button>
            <button ref={cancelButton} type="button" className="hk-btn" onClick={cancel}>
              Keep playing
            </button>
          </div>
        </div>
      ) : (
        <button ref={resetButton} type="button" className="hk-btn hk-btn-ink" onClick={ask}>
          <RotateCcw aria-hidden="true" className="size-4" />
          Reset save
        </button>
      )}
      <p role="status" className="hk-pixel text-xs">
        {step === "done" ? "Save reset. New game!" : ""}
      </p>
    </div>
  );
}
