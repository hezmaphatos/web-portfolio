"use client";

import { useEffect, useRef } from "react";

import { useGameConfig } from "@/components/game/GameConfig";
import { toast } from "@/components/game/toast/toast";
import { revealDelay } from "@/components/project/arena/rewards";
import {
  addedBadges,
  badgeById,
  chapterMask,
  derivedBadges,
  msUntilMidnight,
  type BadgeId,
} from "@/lib/badges";
import { sfx } from "@/lib/sound";
import { useGameStore, useHudStore } from "@/lib/store";
import type { SectionKey } from "@/lib/types";

import { pulseBadgeButton } from "./drawer";
import { clearOpened, loadOpened, useOpenedStore } from "./opened";
import { PixelIcon } from "./PixelIcon";

/** Badge toasts stay a little longer than the default (two lines to read). */
const TOAST_MS = 5200;
/** After a boss defeat, toasts wait for the unlock sequence to start, plus this. */
const AFTER_REVEAL_MS = 400;

/**
 * Renders nothing. Two jobs (spec §5 badges, §14 phase 7):
 *
 * 1. Announce NEW unlocks only: it diffs `badges` between store updates, and only once the save is
 *    hydrated on both sides of the update — badges restored from the cookie are never toasted.
 *    Each new badge → a toast (pixel icon, "Badge unlocked: …" + how it was earned) in the polite
 *    live region, the badge jingle (when sound is on) and a pop of the HUD button. Badges won by a
 *    boss defeat wait until the Arena's unlock sequence has started (one big moment at a time).
 *
 * 2. Evaluate the derived badges (lib/badges.ts) — explorer, curious, collector, night-owl — after
 *    hydration and whenever their inputs change: `visited`, `defeated`, the opened-projects
 *    counter, the tab becoming visible again, local midnight. Never while the splash is up.
 *
 * A changed save creation time `t` while hydrated means Reset save / NEW GAME: the opened-projects
 * counter is cleared with it, so Curious is really earned again.
 */
export function BadgeWatcher({ chapterKeys }: { chapterKeys: SectionKey[] }) {
  const { featuredBossIds } = useGameConfig();
  const required = chapterMask(chapterKeys);
  const featuredKey = featuredBossIds.join(",");
  const config = useRef({ required, featured: featuredBossIds });

  useEffect(() => {
    config.current = { required, featured: featuredKey ? featuredKey.split(",").map(Number) : [] };
    evaluate(config.current);
  }, [required, featuredKey]);

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        fn();
      }, ms);
      timers.add(timer);
    };
    const check = () => evaluate(config.current);

    // New badges are batched behind one timer: badges unlocked together (a defeat can bring
    // First Blood, Final Boss and Collector) show together, in unlock order, with one jingle.
    let pending: BadgeId[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    let flushAt = 0;
    const flush = () => {
      flushTimer = undefined;
      // A Reset save in between takes them back: only toast what is still unlocked.
      const owned = useGameStore.getState().badges;
      const ids = pending.filter((id) => owned.includes(id));
      pending = [];
      if (ids.length === 0) return;
      for (const id of ids) {
        const badge = badgeById(id);
        if (!badge) continue;
        toast(`Badge unlocked: ${badge.title}`, {
          icon: <PixelIcon icon={badge.icon} className="hk-toast-badge" />,
          description: badge.earned,
          duration: TOAST_MS,
        });
      }
      sfx.badge(); // once per batch: three badges from one defeat do not stack three jingles
      pulseBadgeButton();
    };
    const announce = (ids: BadgeId[], delay: number) => {
      pending.push(...ids.filter((id) => !pending.includes(id)));
      const due = performance.now() + delay;
      if (flushTimer !== undefined && due <= flushAt) return; // joins the waiting batch
      clearTimeout(flushTimer);
      flushAt = due;
      flushTimer = setTimeout(flush, Math.max(0, due - performance.now()));
    };

    const offGame = useGameStore.subscribe((state, prev) => {
      if (!state.hydrated) return;
      if (!prev.hydrated) {
        // Just read from the cookie: restored badges are not news. Derived ones may be.
        later(check, 0);
        return;
      }
      if (state.t !== prev.t) clearOpened();

      const added = addedBadges(prev.badges, state.badges);
      if (added.length > 0) {
        // defeat() appends: the last defeated boss is the one that may be mid-unlock right now.
        const last = state.defeated[state.defeated.length - 1];
        const wait = last === undefined ? 0 : revealDelay(last);
        announce(added, wait > 0 ? wait + AFTER_REVEAL_MS : 0);
      }
      // After the current update has finished: a defeat unlocks First Blood / Final Boss right
      // after `defeated` changes, and Collector should come after them (toast order).
      if (state.visited !== prev.visited || state.defeated !== prev.defeated) queueMicrotask(check);
    });

    const offOpened = useOpenedStore.subscribe((state, prev) => {
      if (state.slugs.length !== prev.slugs.length) check();
    });

    const offBoot = useHudStore.subscribe((state, prev) => {
      if (state.boot === "done" && prev.boot !== "done") check();
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    // Night Owl for someone still here when the clock passes midnight (re-armed every day).
    let midnight: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      midnight = setTimeout(
        () => {
          check();
          arm();
        },
        msUntilMidnight(new Date()) + 1000,
      );
    };
    arm();

    loadOpened();
    if (useGameStore.getState().hydrated) later(check, 0);

    return () => {
      offGame();
      offOpened();
      offBoot();
      document.removeEventListener("visibilitychange", onVisible);
      clearTimeout(midnight);
      clearTimeout(flushTimer);
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  return null;
}

/** Unlocks every derived badge the current state qualifies for (once hydrated, splash gone). */
function evaluate(config: { required: number; featured: readonly number[] }): void {
  const game = useGameStore.getState();
  if (!game.hydrated || useHudStore.getState().boot !== "done") return;
  loadOpened();
  const earned = derivedBadges({
    visited: game.visited,
    requiredChapters: config.required,
    opened: useOpenedStore.getState().slugs.length,
    defeated: game.defeated,
    featuredBossIds: config.featured,
    hour: new Date().getHours(),
  });
  for (const id of earned) {
    if (!useGameStore.getState().badges.includes(id)) useGameStore.getState().unlockBadge(id);
  }
}
