import { ALL_CHAPTERS_MASK, CHAPTER_BIT, visitedCount } from "@/lib/save";
import type { SectionKey } from "@/lib/types";

/**
 * The ten badges of spec §5, defined in code (not in the database). Pure data + pure predicates:
 * no React, no DOM, no store, so everything here is unit-tested (lib/badges.test.ts).
 *
 * Earned badges live in the save cookie (`badges`, lib/save.ts). Six are unlocked where the action
 * happens (splash START, loadout change, boss defeat, contact form, Konami code); four are
 * *derived* from state the game already keeps and are checked by components/game/badges/
 * BadgeWatcher.tsx whenever that state changes:
 *   explorer  ← the `visited` chapter bitmask,
 *   curious   ← the opened-projects counter (localStorage, components/game/badges/opened.ts),
 *   collector ← `defeated` ∩ the featured boss projects,
 *   night-owl ← the local clock.
 * Once earned, a badge is latched in the save: it never goes away when the state behind it changes
 * (a project featured later does not take Collector back). Only Reset save / NEW GAME clear it.
 */

export const BADGE_IDS = [
  "first-steps",
  "explorer",
  "curious",
  "collector",
  "first-blood",
  "final-boss",
  "tinkerer",
  "night-owl",
  "messenger",
  "konami",
] as const;

export type BadgeId = (typeof BADGE_IDS)[number];

/** Background of the badge's icon tile once unlocked (site tokens). */
export type BadgeTone = "lime" | "hot" | "volt";

export type BadgeDef = Readonly<{
  id: BadgeId;
  title: string;
  /** How to earn it (shown while locked). */
  condition: string;
  /** How it was earned (shown once unlocked, and as the toast's second line). */
  earned: string;
  /** Locked, the title stays "???" and `condition` is only a teaser (the Konami code). */
  secret?: boolean;
  tone: BadgeTone;
  /**
   * 12 × 12 pixel art, one string per row: `#` ink, `o` light, `.` empty. Rendered by
   * components/game/badges/PixelIcon.tsx; a locked badge shows the same pixels as a silhouette.
   */
  icon: readonly string[];
}>;

/** Pixel grid size of every badge icon. */
export const ICON_SIZE = 12;

/** Opened projects needed for Curious (spec §5: "Membuka 3 project"). */
export const CURIOUS_TARGET = 3;

/** Night Owl window, local time: 00:00 (inclusive) to 04:00 (exclusive). */
export const NIGHT_OWL_FROM_HOUR = 0;
export const NIGHT_OWL_TO_HOUR = 4;

export const BADGES: readonly BadgeDef[] = [
  {
    id: "first-steps",
    title: "First Steps",
    condition: "Press START on the boot screen.",
    earned: "You pressed START.",
    tone: "lime",
    icon: [
      "............",
      "..######....",
      "..#oooo#....",
      "..#oooo#....",
      "..#oooo#....",
      "..#oooo#....",
      "..#oooo####.",
      "..#ooooooo#.",
      "..#oooooooo#",
      "..##########",
      "............",
      "............",
    ],
  },
  {
    id: "explorer",
    title: "Explorer",
    condition: "Visit every chapter of the level.",
    earned: "You visited every chapter.",
    tone: "volt",
    icon: [
      "............",
      "..##........",
      "..########..",
      "..##oooooo#.",
      "..##ooooooo#",
      "..##oooooo#.",
      "..########..",
      "..##........",
      "..##........",
      "..##........",
      ".####.......",
      "............",
    ],
  },
  {
    id: "curious",
    title: "Curious",
    condition: `Open ${CURIOUS_TARGET} projects.`,
    earned: `You opened ${CURIOUS_TARGET} projects.`,
    tone: "lime",
    icon: [
      "..#####.....",
      ".#ooooo#....",
      "#oo...oo#...",
      "#o.....o#...",
      "#o.....o#...",
      "#o.....o#...",
      "#oo...oo#...",
      ".#ooooo##...",
      "..#####.##..",
      "........###.",
      ".........###",
      "..........##",
    ],
  },
  {
    id: "collector",
    title: "Collector",
    condition: "Defeat every featured boss.",
    earned: "You defeated every featured boss.",
    tone: "volt",
    icon: [
      "............",
      "............",
      "..########..",
      ".#oooooooo#.",
      ".#oooooooo#.",
      "############",
      "#oooo##oooo#",
      "#oooo##oooo#",
      "#oooooooooo#",
      "#oooooooooo#",
      "############",
      "............",
    ],
  },
  {
    id: "first-blood",
    title: "First Blood",
    condition: "Defeat your first boss.",
    earned: "You defeated your first boss.",
    tone: "hot",
    icon: [
      ".....##.....",
      "....#oo#....",
      "....#oo#....",
      "....#oo#....",
      "....#oo#....",
      "....#oo#....",
      "....#oo#....",
      ".##########.",
      ".....##.....",
      ".....##.....",
      "....####....",
      "............",
    ],
  },
  {
    id: "final-boss",
    title: "Final Boss",
    condition: "Defeat a final-tier boss.",
    earned: "You took down a final-tier boss.",
    tone: "hot",
    icon: [
      "............",
      "............",
      "#....##....#",
      "##..#oo#..##",
      "#o#.#oo#.#o#",
      "#oo#oooo#oo#",
      "#oooooooooo#",
      "#oooooooooo#",
      "############",
      "#o#o#oo#o#o#",
      "############",
      "............",
    ],
  },
  {
    id: "tinkerer",
    title: "Tinkerer",
    condition: "Change your skill loadout once.",
    earned: "You changed your skill loadout.",
    tone: "lime",
    icon: [
      "............",
      ".....##.....",
      "..#.#oo#.#..",
      "..##oooo##..",
      "...#o##o#...",
      ".##o#..#o##.",
      ".##o#..#o##.",
      "...#o##o#...",
      "..##oooo##..",
      "..#.#oo#.#..",
      ".....##.....",
      "............",
    ],
  },
  {
    id: "night-owl",
    title: "Night Owl",
    condition: "Visit between 00:00 and 04:00, your local time.",
    earned: "You visited after midnight.",
    tone: "volt",
    icon: [
      "............",
      "....####....",
      "..##ooo#....",
      ".#oooo#.....",
      ".#ooo#......",
      "#ooo#.....#.",
      "#ooo#....###",
      "#ooo#.....#.",
      ".#ooo#......",
      ".#oooo#.....",
      "..##oooo###.",
      "....####....",
    ],
  },
  {
    id: "messenger",
    title: "Messenger",
    condition: "Send a message from the Contact stage.",
    earned: "You sent a message.",
    tone: "hot",
    icon: [
      "............",
      "............",
      "############",
      "##oooooooo##",
      "#o#oooooo#o#",
      "#oo#oooo#oo#",
      "#ooo####ooo#",
      "#oooooooooo#",
      "#oooooooooo#",
      "############",
      "............",
      "............",
    ],
  },
  {
    id: "konami",
    title: "Konami",
    condition: "A classic cheat code… try it anywhere on the site.",
    earned: "You entered the Konami code: Terminal Mode unlocked.",
    secret: true,
    tone: "lime",
    icon: [
      "............",
      "............",
      "............",
      ".##########.",
      "#oo#ooooo#o#",
      "#o###ooo#oo#",
      "#oo#ooooooo#",
      "#oooooooooo#",
      "#ooo####ooo#",
      "####....####",
      "............",
      "............",
    ],
  },
];

const BY_ID: ReadonlyMap<string, BadgeDef> = new Map(BADGES.map((badge) => [badge.id, badge]));

export function isBadgeId(value: string): value is BadgeId {
  return BY_ID.has(value);
}

export function badgeById(id: string): BadgeDef | undefined {
  return BY_ID.get(id);
}

/** The known badges of a save, once each, in definition order (unknown ids are ignored). */
export function knownBadges(badges: readonly string[]): BadgeId[] {
  const owned = new Set(badges);
  return BADGE_IDS.filter((id) => owned.has(id));
}

/** Badges in `after` that were not in `before`, in unlock order (known ids only, once each). */
export function addedBadges(before: readonly string[], after: readonly string[]): BadgeId[] {
  const had = new Set(before);
  const added: BadgeId[] = [];
  for (const id of after) {
    if (!had.has(id) && isBadgeId(id) && !added.includes(id)) added.push(id);
  }
  return added;
}

// ── Derived badges ───────────────────────────────────────────────────────

/** Bitmask of the chapters a visitor must see for Explorer (the chapters Home actually shows). */
export function chapterMask(keys: Iterable<SectionKey>): number {
  let mask = 0;
  for (const key of keys) mask |= CHAPTER_BIT[key] ?? 0;
  return mask;
}

/**
 * Explorer: every required chapter visited (spec: "Mengunjungi ke-8 chapter"). `required` defaults
 * to all eight; a chapter hidden in the admin is left out of it, so the badge stays reachable.
 */
export function isExplorer(visited: number, required: number = ALL_CHAPTERS_MASK): boolean {
  return required !== 0 && (visited & required) === required;
}

/** Curious: `opened` distinct projects opened (a Project Stage shown, page or modal). */
export function isCurious(opened: number): boolean {
  return opened >= CURIOUS_TARGET;
}

/**
 * Collector: every featured boss project defeated. Never true without featured bosses (an empty
 * set is not "all of them" for a game).
 */
export function isCollector(
  defeated: readonly number[],
  featuredBossIds: readonly number[],
): boolean {
  if (featuredBossIds.length === 0) return false;
  const beaten = new Set(defeated);
  return featuredBossIds.every((id) => beaten.has(id));
}

/** Night Owl: the local hour (0–23, `Date#getHours()`) is within 00:00–04:00. */
export function isNightOwl(hour: number): boolean {
  return hour >= NIGHT_OWL_FROM_HOUR && hour < NIGHT_OWL_TO_HOUR;
}

/** Everything the derived badges are computed from. */
export type BadgeContext = Readonly<{
  visited: number;
  /** chapterMask() of the chapters Home shows. */
  requiredChapters: number;
  /** Distinct projects opened. */
  opened: number;
  defeated: readonly number[];
  featuredBossIds: readonly number[];
  /** Local hour now (0–23). */
  hour: number;
}>;

/** The derived badges the context qualifies for right now (unlocked or not). */
export function derivedBadges(ctx: BadgeContext): BadgeId[] {
  const earned: BadgeId[] = [];
  if (isExplorer(ctx.visited, ctx.requiredChapters)) earned.push("explorer");
  if (isCurious(ctx.opened)) earned.push("curious");
  if (isCollector(ctx.defeated, ctx.featuredBossIds)) earned.push("collector");
  if (isNightOwl(ctx.hour)) earned.push("night-owl");
  return earned;
}

export type BadgeProgress = Readonly<{ current: number; target: number }>;

/** "3/8"-style progress of a locked counting badge, or null for the one-shot ones. */
export function badgeProgress(id: BadgeId, ctx: Omit<BadgeContext, "hour">): BadgeProgress | null {
  switch (id) {
    case "explorer": {
      const target = visitedCount(ctx.requiredChapters);
      return target > 0
        ? { current: visitedCount(ctx.visited & ctx.requiredChapters), target }
        : null;
    }
    case "curious":
      return { current: Math.min(ctx.opened, CURIOUS_TARGET), target: CURIOUS_TARGET };
    case "collector": {
      if (ctx.featuredBossIds.length === 0) return null;
      const beaten = new Set(ctx.defeated);
      return {
        current: ctx.featuredBossIds.filter((projectId) => beaten.has(projectId)).length,
        target: ctx.featuredBossIds.length,
      };
    }
    default:
      return null;
  }
}

/** Ids of the featured projects that are bosses (Collector's target set). */
export function featuredBossIds(
  projects: readonly { id: number; is_featured: boolean; boss: { enabled: boolean } }[],
): number[] {
  return projects
    .filter((project) => project.is_featured && project.boss.enabled)
    .map((project) => project.id);
}

/** Milliseconds from `now` until the next local midnight (when Night Owl can start). */
export function msUntilMidnight(now: Date): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}
