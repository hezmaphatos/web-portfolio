"use client";

import { useEffect } from "react";

import type { ChapterSection } from "@/components/game/useChapterSections";
import { useGameStore, useHudStore } from "@/lib/store";

type Props = {
  sections: ChapterSection[];
  /** The boot chapter is on (sections.is_visible): reaching Home counts as visiting it. */
  hasBoot: boolean;
};

/** "Entered" = 40 % visible (the same rule as the stage hints, spec §5.3). */
const VISIT_RATIO = 0.4;
/**
 * A chapter must stay entered this long to count as visited: rewinds and chapter-menu jumps scroll
 * straight through the ones in between, which must not earn Explorer.
 */
const VISIT_DWELL_MS = 600;
/** 1 % steps: a chapter taller than the viewport only reaches a small intersection ratio. */
const THRESHOLDS = Array.from({ length: 101 }, (_, i) => i / 100);

/**
 * Follows the visitor through Home (renders nothing):
 * - activeChapter = the chapter crossing the middle of the viewport (HUD LV, Help button);
 *   "boot" while the splash is up;
 * - visit(key) the first time a chapter stays ≥ 40 % visible for VISIT_DWELL_MS — measured
 *   against the viewport for chapters taller than it — only after the save cookie is hydrated
 *   (an earlier write would overwrite the real save) and once the splash is gone. The HUD LV
 *   (activeChapter) still follows the scroll immediately.
 * IntersectionObserver instead of ScrollTrigger: it needs no refresh() when heights change.
 */
export function ChapterTracker({ sections, hasBoot }: Props) {
  const boot = useHudStore((state) => state.boot);
  const hydrated = useGameStore((state) => state.hydrated);

  // Active chapter: a zero-height root band at 50 % of the viewport.
  useEffect(() => {
    const { setActiveChapter } = useHudStore.getState();
    if (boot === "playing") {
      setActiveChapter("boot");
      return;
    }
    if (boot !== "done" || sections.length === 0) {
      setActiveChapter(null);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const match = sections.find((s) => s.el === entry.target);
          if (match) setActiveChapter(match.key);
        }
      },
      { rootMargin: "-50% 0px -50% 0px", threshold: 0 },
    );
    sections.forEach((s) => observer.observe(s.el));
    return () => observer.disconnect();
  }, [boot, sections]);

  // Visits (save cookie bitmask).
  useEffect(() => {
    if (boot !== "done" || !hydrated || sections.length === 0) return;
    const { visit } = useGameStore.getState();
    if (hasBoot) visit("boot"); // the level starts at the boot screen, shown or skipped
    const dwell = new Map<Element, ReturnType<typeof setTimeout>>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const viewport = entry.rootBounds?.height ?? window.innerHeight;
          const base = Math.min(entry.boundingClientRect.height, viewport);
          const entered = base > 0 && entry.intersectionRect.height / base >= VISIT_RATIO;
          const pending = dwell.get(entry.target);
          if (!entered) {
            // Left again before the dwell ran out (flew past): not a visit.
            if (pending !== undefined) clearTimeout(pending);
            dwell.delete(entry.target);
            continue;
          }
          if (pending !== undefined) continue; // still entered, the dwell timer is running
          const match = sections.find((s) => s.el === entry.target);
          if (!match) continue;
          const target = entry.target;
          dwell.set(
            target,
            setTimeout(() => {
              dwell.delete(target);
              visit(match.key);
              observer.unobserve(target); // once per chapter is enough
            }, VISIT_DWELL_MS),
          );
        }
      },
      { threshold: THRESHOLDS },
    );
    sections.forEach((s) => observer.observe(s.el));
    return () => {
      observer.disconnect();
      dwell.forEach((timer) => clearTimeout(timer));
    };
  }, [boot, hydrated, sections, hasBoot]);

  return null;
}
