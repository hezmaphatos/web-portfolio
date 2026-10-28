import { describe, expect, it } from "vitest";

import {
  BADGES,
  BADGE_IDS,
  CURIOUS_TARGET,
  ICON_SIZE,
  addedBadges,
  badgeById,
  badgeProgress,
  chapterMask,
  derivedBadges,
  featuredBossIds,
  isBadgeId,
  isCollector,
  isCurious,
  isExplorer,
  isNightOwl,
  knownBadges,
  msUntilMidnight,
  type BadgeContext,
} from "./badges";
import { ALL_CHAPTERS_MASK, CHAPTER_BIT, newSave, parseSave, serializeSave } from "./save";
import { SECTION_KEYS } from "./types";

const ctx = (over: Partial<BadgeContext> = {}): BadgeContext => ({
  visited: 0,
  requiredChapters: ALL_CHAPTERS_MASK,
  opened: 0,
  defeated: [],
  featuredBossIds: [1, 2, 3],
  hour: 12,
  ...over,
});

describe("badge definitions", () => {
  it("has the ten badges of spec §5, in the table's order", () => {
    expect(BADGES.map((badge) => badge.id)).toEqual([...BADGE_IDS]);
    expect(BADGE_IDS).toEqual([
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
    ]);
  });

  it("gives every badge a title, a condition and an earned line", () => {
    for (const badge of BADGES) {
      expect(badge.title.length).toBeGreaterThan(0);
      expect(badge.condition.length).toBeGreaterThan(0);
      expect(badge.earned.length).toBeGreaterThan(0);
    }
  });

  it("keeps only Konami secret (its condition is a teaser)", () => {
    expect(BADGES.filter((badge) => badge.secret).map((badge) => badge.id)).toEqual(["konami"]);
    expect(badgeById("konami")?.condition).not.toMatch(/konami|↑|up up/i);
  });

  it("draws every icon on a 12 × 12 grid of #, o and .", () => {
    for (const badge of BADGES) {
      expect(badge.icon, badge.id).toHaveLength(ICON_SIZE);
      for (const row of badge.icon) {
        expect(row, badge.id).toMatch(new RegExp(`^[#o.]{${ICON_SIZE}}$`));
      }
      expect(badge.icon.join("").includes("#"), badge.id).toBe(true);
    }
  });

  it("uses ids the save cookie accepts, and all of them fit in it", () => {
    const save = { ...newSave(1), badges: [...BADGE_IDS] };
    expect(parseSave(serializeSave(save))?.badges).toEqual([...BADGE_IDS]);
  });

  it("recognises known ids only", () => {
    expect(isBadgeId("explorer")).toBe(true);
    expect(isBadgeId("speedrunner")).toBe(false);
    expect(badgeById("nope")).toBeUndefined();
  });
});

describe("knownBadges / addedBadges", () => {
  it("filters unknown ids and orders by definition", () => {
    expect(knownBadges(["messenger", "legacy-badge", "first-steps", "messenger"])).toEqual([
      "first-steps",
      "messenger",
    ]);
  });

  it("returns only the new known ids, in unlock order", () => {
    expect(addedBadges(["first-steps"], ["first-steps", "first-blood", "collector"])).toEqual([
      "first-blood",
      "collector",
    ]);
    expect(addedBadges([], ["x-unknown", "konami", "konami"])).toEqual(["konami"]);
  });

  it("finds nothing new after a hydration or a reset", () => {
    expect(addedBadges(["a", "first-steps"], ["first-steps"])).toEqual([]);
    expect(addedBadges(["first-steps", "tinkerer"], [])).toEqual([]);
  });
});

describe("explorer", () => {
  it("needs every chapter, the boot one included", () => {
    expect(isExplorer(ALL_CHAPTERS_MASK)).toBe(true);
    expect(isExplorer(ALL_CHAPTERS_MASK & ~CHAPTER_BIT.boot)).toBe(false);
    expect(isExplorer(ALL_CHAPTERS_MASK & ~CHAPTER_BIT.contact)).toBe(false);
    expect(isExplorer(0)).toBe(false);
  });

  it("only asks for the chapters Home shows", () => {
    const shown = chapterMask(SECTION_KEYS.filter((key) => key !== "trophies"));
    expect(isExplorer(ALL_CHAPTERS_MASK & ~CHAPTER_BIT.trophies, shown)).toBe(true);
    expect(isExplorer(ALL_CHAPTERS_MASK, shown)).toBe(true);
  });

  it("is never earned when no chapter is required", () => {
    expect(isExplorer(ALL_CHAPTERS_MASK, 0)).toBe(false);
  });

  it("builds the mask from section keys", () => {
    expect(chapterMask(SECTION_KEYS)).toBe(ALL_CHAPTERS_MASK);
    expect(chapterMask(["boot", "hero"])).toBe(CHAPTER_BIT.boot | CHAPTER_BIT.hero);
    expect(chapterMask([])).toBe(0);
  });
});

describe("curious", () => {
  it(`needs ${CURIOUS_TARGET} opened projects`, () => {
    expect(isCurious(0)).toBe(false);
    expect(isCurious(CURIOUS_TARGET - 1)).toBe(false);
    expect(isCurious(CURIOUS_TARGET)).toBe(true);
    expect(isCurious(CURIOUS_TARGET + 4)).toBe(true);
  });
});

describe("collector", () => {
  it("needs every featured boss defeated", () => {
    expect(isCollector([1, 2], [1, 2, 3])).toBe(false);
    expect(isCollector([3, 1, 2], [1, 2, 3])).toBe(true);
    expect(isCollector([4, 1, 2, 3], [1, 2, 3])).toBe(true);
  });

  it("is never earned without featured bosses", () => {
    expect(isCollector([1, 2, 3], [])).toBe(false);
  });

  it("takes the featured projects that are bosses", () => {
    expect(
      featuredBossIds([
        { id: 1, is_featured: true, boss: { enabled: true } },
        { id: 2, is_featured: true, boss: { enabled: false } },
        { id: 3, is_featured: false, boss: { enabled: true } },
        { id: 4, is_featured: true, boss: { enabled: true } },
      ]),
    ).toEqual([1, 4]);
  });
});

describe("night owl", () => {
  it("covers 00:00 up to (not including) 04:00", () => {
    expect([0, 1, 2, 3].every(isNightOwl)).toBe(true);
    expect([4, 5, 12, 22, 23].some(isNightOwl)).toBe(false);
  });

  it("knows when the next midnight is", () => {
    const evening = new Date(2026, 9, 26, 23, 59, 30);
    expect(msUntilMidnight(evening)).toBe(30_000);
    const midnight = new Date(2026, 9, 27, 0, 0, 0);
    expect(msUntilMidnight(midnight)).toBe(24 * 60 * 60 * 1000);
  });
});

describe("derivedBadges", () => {
  it("lists what the state qualifies for", () => {
    expect(derivedBadges(ctx())).toEqual([]);
    expect(
      derivedBadges(ctx({ visited: ALL_CHAPTERS_MASK, opened: 3, defeated: [1, 2, 3], hour: 1 })),
    ).toEqual(["explorer", "curious", "collector", "night-owl"]);
    expect(derivedBadges(ctx({ hour: 3, defeated: [1, 2] }))).toEqual(["night-owl"]);
  });
});

describe("badgeProgress", () => {
  it("counts chapters, opened projects and featured bosses", () => {
    const state = ctx({
      visited: CHAPTER_BIT.boot | CHAPTER_BIT.hero | CHAPTER_BIT.about,
      opened: 7,
      defeated: [2, 9],
    });
    expect(badgeProgress("explorer", state)).toEqual({ current: 3, target: 8 });
    expect(badgeProgress("curious", state)).toEqual({ current: 3, target: 3 });
    expect(badgeProgress("collector", state)).toEqual({ current: 1, target: 3 });
  });

  it("has no progress for one-shot badges or empty targets", () => {
    expect(badgeProgress("first-steps", ctx())).toBeNull();
    expect(badgeProgress("konami", ctx())).toBeNull();
    expect(badgeProgress("collector", ctx({ featuredBossIds: [] }))).toBeNull();
    expect(badgeProgress("explorer", ctx({ requiredChapters: 0 }))).toBeNull();
  });
});
