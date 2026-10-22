import { describe, expect, it } from "vitest";

import {
  autoFireStep,
  battleElapsed,
  bestLoadout,
  bossPhase,
  clearTime,
  compareSkillRank,
  cooldownProgress,
  createBattle,
  defaultLoadout,
  dps,
  fire,
  formatClearTime,
  type GameSkill,
  isGameSkill,
  isSlotReady,
  LOADOUT_SIZE,
  MAX_TIMELINE_HITS,
  nextReadyAt,
  readySlots,
  remainingCooldown,
  resetBattle,
  resolveLoadout,
  sanitizeLoadout,
  simulate,
  splitTech,
  toGameSkill,
  toGameSkills,
  TRAINING_DUMMY_HP,
  visibleTechCount,
} from "@/lib/battle";
import type { Skill, SkillCategory } from "@/lib/types";

// ── Fixtures ───────────────────────────────────────────────────────────

/** [name, category, level, damage, cooldown_ms] in seeder order (id = index + 1, sort_order = index). */
const SEED: readonly [string, SkillCategory, number, number, number][] = [
  ["HTML", "frontend", 3, 25, 1000],
  ["CSS", "frontend", 3, 30, 1500],
  ["JavaScript", "frontend", 3, 40, 2000],
  ["ReactJS", "frontend", 3, 55, 3000],
  ["Tailwind CSS", "frontend", 3, 35, 1500],
  ["Bootstrap CSS", "frontend", 3, 26, 1000],
  ["PHP", "backend", 3, 45, 2500],
  ["Laravel", "backend", 5, 70, 4000],
  ["Kotlin", "mobile", 3, 50, 3000],
  ["Flutter", "mobile", 3, 60, 3500],
  ["MySQL", "database", 3, 65, 3500],
  ["Firebase", "database", 3, 38, 2000],
  ["Figma", "design", 3, 32, 1500],
  ["Python", "ml", 3, 48, 2500],
  ["C#", "game", 3, 42, 2000],
  ["PostgreSQL", "database", 3, 50, 2500],
];

function apiSkill(overrides: Partial<Skill> & Pick<Skill, "id" | "name">): Skill {
  return {
    slug: overrides.name.toLowerCase(),
    category: "backend",
    level: 3,
    status: "core",
    icon_key: null,
    icon: null,
    description: null,
    attack_name: `${overrides.name} Attack`,
    damage: 50,
    cooldown_ms: 2000,
    sort_order: overrides.id,
    ...overrides,
  };
}

const SEEDED_SKILLS: Skill[] = [
  ...SEED.map(([name, category, level, damage, cooldown_ms], i) =>
    apiSkill({ id: i + 1, name, category, level, damage, cooldown_ms, sort_order: i }),
  ),
  // Soft skills have no game numbers (Lampiran A) and must never be equipped.
  apiSkill({
    id: 17,
    name: "Public Speaking",
    category: "soft",
    attack_name: null,
    damage: null,
    cooldown_ms: null,
    sort_order: 16,
  }),
  apiSkill({
    id: 18,
    name: "Teamwork",
    category: "soft",
    attack_name: null,
    damage: null,
    cooldown_ms: null,
    sort_order: 17,
  }),
];

const byName = (name: string): Skill => {
  const skill = SEEDED_SKILLS.find((s) => s.name === name);
  if (!skill) throw new Error(`unknown seeded skill ${name}`);
  return skill;
};

/** Seeded bosses (Lampiran A / ProjectSeeder). */
const SEEDED_BOSSES = [
  { name: "The Paper Colossus", tier: "final", hp: 150 },
  { name: "The Reactor", tier: "regular", hp: 100 },
  { name: "The Blind Spot", tier: "regular", hp: 80 },
  { name: "The Template Slime", tier: "minion", hp: 50 },
] as const;

let nextId = 1000;
function g(damage: number, cooldown_ms: number, extra: Partial<GameSkill> = {}): GameSkill {
  const id = extra.id ?? nextId++;
  return {
    id,
    name: `Skill ${id}`,
    attack_name: `Attack ${id}`,
    damage,
    cooldown_ms,
    level: 3,
    sort_order: id,
    ...extra,
  };
}

/** Deterministic PRNG (LCG) so the property tests are reproducible. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** A random skill inside the admin's ranges: damage 25–70, cooldown 1000–4000 step 500. */
function randomSkill(next: () => number, id: number): GameSkill {
  return g(25 + Math.floor(next() * 46), 1000 + 500 * Math.floor(next() * 7), {
    id,
    level: 1 + Math.floor(next() * 5),
    sort_order: id,
  });
}

function combinations<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  const out: T[][] = [];
  items.forEach((item, i) => {
    for (const rest of combinations(items.slice(i + 1), k - 1)) out.push([item, ...rest]);
  });
  return out;
}

const names = (skills: readonly { name: string }[]) => skills.map((s) => s.name);

// ── Skills ─────────────────────────────────────────────────────────────

describe("game skills", () => {
  it("excludes soft skills and skills without damage/cooldown", () => {
    expect(isGameSkill(byName("Laravel"))).toBe(true);
    expect(isGameSkill(byName("Public Speaking"))).toBe(false);
    // A non-soft skill that is missing either number has no attack.
    expect(isGameSkill(apiSkill({ id: 50, name: "NoDmg", damage: null }))).toBe(false);
    expect(isGameSkill(apiSkill({ id: 51, name: "NoCd", cooldown_ms: null }))).toBe(false);
    // Soft stays out even if it somehow carries numbers.
    expect(isGameSkill(apiSkill({ id: 52, name: "SoftNums", category: "soft" }))).toBe(false);
    // Degenerate numbers would stall a fight.
    expect(isGameSkill(apiSkill({ id: 53, name: "Zero", damage: 0 }))).toBe(false);
    expect(isGameSkill(apiSkill({ id: 54, name: "NoCooldown", cooldown_ms: 0 }))).toBe(false);
    expect(isGameSkill(apiSkill({ id: 55, name: "Neg", damage: -5 }))).toBe(false);
    expect(isGameSkill(apiSkill({ id: 56, name: "NaN", damage: Number.NaN }))).toBe(false);
  });

  it("derives the game view, falling back to the name for a blank attack name", () => {
    expect(toGameSkill(byName("Laravel"))).toEqual({
      id: 8,
      name: "Laravel",
      attack_name: "Laravel Attack",
      damage: 70,
      cooldown_ms: 4000,
      level: 5,
      sort_order: 7,
    });
    expect(toGameSkill(apiSkill({ id: 60, name: "Blank", attack_name: "  " }))?.attack_name).toBe(
      "Blank",
    );
    expect(toGameSkill(apiSkill({ id: 61, name: "Nil", attack_name: null }))?.attack_name).toBe(
      "Nil",
    );
    const game = g(40, 2000);
    expect(toGameSkill(game)).toBe(game);
    expect(toGameSkill(g(0, 2000))).toBeNull();
  });

  it("keeps only game skills in input order", () => {
    const game = toGameSkills(SEEDED_SKILLS);
    expect(game).toHaveLength(16);
    expect(game.map((s) => s.id)).toEqual(SEED.map((_, i) => i + 1));
  });

  it("computes DPS", () => {
    expect(dps(toGameSkill(byName("Laravel"))!)).toBe(17.5);
    expect(dps(toGameSkill(byName("HTML"))!)).toBe(25);
    expect(dps({ damage: 65, cooldown_ms: 3500 })).toBeCloseTo(18.571, 3);
    expect(dps({ damage: 50, cooldown_ms: 0 })).toBe(0);
  });
});

// ── Loadout ────────────────────────────────────────────────────────────

describe("defaultLoadout", () => {
  it("picks the four highest-damage seeded skills", () => {
    expect(names(defaultLoadout(SEEDED_SKILLS))).toEqual([
      "Laravel",
      "MySQL",
      "Flutter",
      "ReactJS",
    ]);
  });

  it("breaks damage ties by level, then sort_order (Kotlin before PostgreSQL)", () => {
    const top4 = new Set(["Laravel", "MySQL", "Flutter", "ReactJS"]);
    const rest = SEEDED_SKILLS.filter((s) => !top4.has(s.name));
    // Kotlin and PostgreSQL both hit for 50 at level 3; Kotlin has the lower sort_order.
    expect(names(defaultLoadout(rest))).toEqual(["Kotlin", "PostgreSQL", "Python", "PHP"]);
    // Bump PostgreSQL's level and it overtakes Kotlin.
    const leveled = rest.map((s) => (s.name === "PostgreSQL" ? { ...s, level: 4 } : s));
    expect(names(defaultLoadout(leveled))).toEqual(["PostgreSQL", "Kotlin", "Python", "PHP"]);
  });

  it("breaks full ties by id and is independent of input order", () => {
    const a = g(50, 2000, { id: 7, level: 3, sort_order: 1 });
    const b = g(50, 2000, { id: 3, level: 3, sort_order: 1 });
    const c = g(50, 2000, { id: 5, level: 3, sort_order: 0 });
    const d = g(50, 2000, { id: 9, level: 4, sort_order: 9 });
    expect(defaultLoadout([a, b, c, d]).map((s) => s.id)).toEqual([9, 5, 3, 7]);
    expect(defaultLoadout([d, c, b, a]).map((s) => s.id)).toEqual([9, 5, 3, 7]);
    expect([a, b, c, d].sort(compareSkillRank).map((s) => s.id)).toEqual([9, 5, 3, 7]);
  });

  it("respects size, clamps it to the four slots and does not mutate the input", () => {
    const input = [...SEEDED_SKILLS];
    expect(names(defaultLoadout(input, 2))).toEqual(["Laravel", "MySQL"]);
    expect(defaultLoadout(input, 0)).toEqual([]);
    expect(defaultLoadout(input, -3)).toEqual([]);
    expect(defaultLoadout(input, 10)).toHaveLength(LOADOUT_SIZE);
    expect(input).toEqual(SEEDED_SKILLS);
  });

  it("handles small or empty pools and duplicate ids", () => {
    expect(defaultLoadout([])).toEqual([]);
    expect(names(defaultLoadout([byName("HTML"), byName("Public Speaking")]))).toEqual(["HTML"]);
    const laravel = byName("Laravel");
    expect(names(defaultLoadout([laravel, laravel, byName("HTML")]))).toEqual(["Laravel", "HTML"]);
  });
});

describe("sanitizeLoadout / resolveLoadout", () => {
  it("drops unknown, non-game, non-integer and duplicate ids and caps at four", () => {
    expect(sanitizeLoadout([8, 999, 17, 11, 8, 1.5, Number.NaN, 10, 4, 1], SEEDED_SKILLS)).toEqual([
      8, 11, 10, 4,
    ]);
  });

  it("keeps order and leaves short loadouts short", () => {
    expect(sanitizeLoadout([1, 8], SEEDED_SKILLS)).toEqual([1, 8]);
    expect(sanitizeLoadout([], SEEDED_SKILLS)).toEqual([]);
    expect(sanitizeLoadout([1, 2], [])).toEqual([]);
  });

  it("resolves ids to game skills in slot order", () => {
    expect(names(resolveLoadout([6, 999, 8, 17], SEEDED_SKILLS))).toEqual([
      "Bootstrap CSS",
      "Laravel",
    ]);
  });
});

// ── Tech lock ──────────────────────────────────────────────────────────

describe("visibleTechCount / splitTech", () => {
  it.each([
    [4, 50, 2],
    [3, 50, 2],
    [2, 50, 1],
    [1, 50, 0],
    [0, 50, 0],
    [5, 50, 3],
    [10, 50, 5],
    [4, 0, 0],
    [1, 0, 0],
    [4, 100, 3],
    [1, 100, 0],
    [10, 100, 9],
    [4, 150, 3],
    [4, 25, 1],
    [4, 1, 1],
    [3, 33, 1],
    [3, 34, 2],
  ])("n = %i at %i %% → %i visible", (n, percent, expected) => {
    expect(visibleTechCount(n, percent)).toBe(expected);
  });

  it("treats invalid input as nothing visible", () => {
    expect(visibleTechCount(4, -10)).toBe(0);
    expect(visibleTechCount(4, Number.NaN)).toBe(0);
    expect(visibleTechCount(-2, 50)).toBe(0);
    expect(visibleTechCount(Number.POSITIVE_INFINITY, 50)).toBe(0);
    expect(visibleTechCount(4.7, 50)).toBe(2);
  });

  it("splits in order (seed examples: OCR 4 → 2 + 2, ARK Care 2 → 1 + 1)", () => {
    expect(splitTech(["Flutter", "Laravel", "MySQL", "Python"], 50)).toEqual({
      visible: ["Flutter", "Laravel"],
      locked: ["MySQL", "Python"],
    });
    expect(splitTech(["HTML", "CSS"], 50)).toEqual({ visible: ["HTML"], locked: ["CSS"] });
    expect(splitTech(["Solo"], 100)).toEqual({ visible: [], locked: ["Solo"] });
    expect(splitTech([], 50)).toEqual({ visible: [], locked: [] });
  });
});

// ── Fight engine ───────────────────────────────────────────────────────

describe("createBattle", () => {
  it("starts with every slot charging (readyAt = now + cooldown)", () => {
    const loadout = defaultLoadout(SEEDED_SKILLS);
    const state = createBattle(loadout, 100, 5000);
    expect(state.slots.map((s) => s.readyAt)).toEqual([9000, 8500, 8500, 8000]);
    expect(state).toMatchObject({
      maxHp: 100,
      hp: 100,
      startedAt: 5000,
      defeated: false,
      defeatedAt: null,
      hits: [],
      phase: 1,
    });
    expect(readySlots(state, 5000)).toEqual([]);
    for (let i = 0; i < LOADOUT_SIZE; i++) {
      expect(isSlotReady(state, i, 5000)).toBe(false);
      expect(cooldownProgress(state, i, 5000)).toBe(0);
    }
  });

  it("pads to four slots, drops extra and non-game entries", () => {
    const state = createBattle([g(30, 1000), null, byName("Public Speaking")], 100, 0);
    expect(state.slots).toHaveLength(LOADOUT_SIZE);
    expect(state.slots.map((s) => s.skill === null)).toEqual([false, true, true, true]);
    expect(state.slots[1].readyAt).toBe(Number.POSITIVE_INFINITY);
    const five = createBattle([g(1, 1000), g(1, 1000), g(1, 1000), g(1, 1000), g(99, 1)], 9, 0);
    expect(five.slots.map((s) => s.skill?.damage)).toEqual([1, 1, 1, 1]);
  });

  it("accepts API skills directly", () => {
    const state = createBattle([byName("Laravel")], 100, 0);
    expect(state.slots[0].skill).toMatchObject({ id: 8, damage: 70, cooldown_ms: 4000 });
  });

  it("treats HP ≤ 0 or non-finite as already defeated", () => {
    for (const hp of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = createBattle([g(30, 1000)], hp, 42);
      expect(state).toMatchObject({ maxHp: 0, hp: 0, defeated: true, defeatedAt: 42 });
      expect(readySlots(state, 10_000)).toEqual([]);
      expect(nextReadyAt(state)).toBeNull();
    }
  });

  it("sets the final-tier phase at full HP", () => {
    expect(createBattle([g(30, 1000)], 150, 0, "final").phase).toBe(1);
    expect(createBattle([g(30, 1000)], 150, 0).tier).toBe("regular");
  });
});

describe("fire", () => {
  const laravel = g(70, 4000, { id: 8, attack_name: "Eloquent Slam" });
  const html = g(25, 1000, { id: 1, attack_name: "Semantic Strike" });

  it("returns null and the same state before the slot is ready", () => {
    const state = createBattle([laravel], 100, 1000);
    const result = fire(state, 0, 4999);
    expect(result.hit).toBeNull();
    expect(result.state).toBe(state);
  });

  it("returns null for empty and out-of-range slots", () => {
    const state = createBattle([laravel], 100, 0);
    for (const slot of [1, 3, 4, -1, 0.5]) {
      const result = fire(state, slot, 100_000);
      expect(result.hit).toBeNull();
      expect(result.state).toBe(state);
    }
  });

  it("deals the exact fixed damage and recharges the slot", () => {
    const state = createBattle([laravel, html], 100, 1000);
    expect(isSlotReady(state, 0, 5000)).toBe(true);
    const { state: next, hit } = fire(state, 0, 5000);
    expect(hit).toEqual({
      slot: 0,
      skillId: 8,
      attackName: "Eloquent Slam",
      damage: 70,
      hpAfter: 30,
      at: 5000,
    });
    expect(next.hp).toBe(30);
    expect(next.defeated).toBe(false);
    expect(next.slots[0].readyAt).toBe(9000);
    expect(next.slots[1]).toBe(state.slots[1]);
    expect(next.hits).toEqual([hit]);
    expect(isSlotReady(next, 0, 5000)).toBe(false);
    expect(isSlotReady(next, 0, 8999)).toBe(false);
    expect(isSlotReady(next, 0, 9000)).toBe(true);
    // Immutable: the old state is untouched.
    expect(state.hp).toBe(100);
    expect(state.hits).toEqual([]);
  });

  it("fires late without penalty (cooldown restarts from the fire time)", () => {
    const state = createBattle([html], 100, 0);
    const { state: next } = fire(state, 0, 2500);
    expect(next.slots[0].readyAt).toBe(3500);
  });

  it("clamps HP at 0, reports the full damage and marks the boss defeated", () => {
    const state = createBattle([laravel, html], 50, 0);
    const { state: next, hit } = fire(state, 0, 4000);
    expect(hit?.damage).toBe(70);
    expect(hit?.hpAfter).toBe(0);
    expect(next).toMatchObject({ hp: 0, defeated: true, defeatedAt: 4000 });
    expect(battleElapsed(next, 99_999)).toBe(4000);
    // Nothing fires once the boss is down.
    expect(isSlotReady(next, 1, 10_000)).toBe(false);
    expect(fire(next, 1, 10_000).hit).toBeNull();
    expect(nextReadyAt(next)).toBeNull();
  });

  it("defeats at exactly 0 HP", () => {
    const state = createBattle([g(50, 1000)], 100, 0);
    const first = fire(state, 0, 1000).state;
    expect(first.defeated).toBe(false);
    const second = fire(first, 0, 2000).state;
    expect(second).toMatchObject({ hp: 0, defeated: true, defeatedAt: 2000 });
  });

  it("updates the final-tier phase as HP drops", () => {
    let state = createBattle([g(51, 1000), g(50, 1000), g(49, 1000)], 150, 0, "final");
    state = fire(state, 0, 1000).state; // 99 HP
    expect(state.phase).toBe(2);
    state = fire(state, 1, 1000).state; // 49 HP
    expect(state.phase).toBe(3);
  });
});

describe("autoFireStep", () => {
  it("fires every ready slot in slot order", () => {
    const loadout = [g(10, 2000, { id: 1 }), g(20, 1000, { id: 2 }), null, g(30, 2000, { id: 4 })];
    let state = createBattle(loadout, 500, 0);
    let step = autoFireStep(state, 999);
    expect(step.hits).toEqual([]);
    expect(step.state).toBe(state);

    step = autoFireStep(state, 1000);
    expect(step.hits.map((h) => h.slot)).toEqual([1]);
    state = step.state;

    step = autoFireStep(state, 2000);
    expect(step.hits.map((h) => h.slot)).toEqual([0, 1, 3]);
    expect(step.hits.map((h) => h.hpAfter)).toEqual([470, 450, 420]);
    expect(step.state.hp).toBe(420);
  });

  it("stops at the killing blow; later slots keep their charge", () => {
    const state = createBattle([g(60, 1000), g(60, 1000), g(60, 1000)], 100, 0);
    const step = autoFireStep(state, 1000);
    expect(step.hits.map((h) => h.slot)).toEqual([0, 1]);
    expect(step.state).toMatchObject({ hp: 0, defeated: true, defeatedAt: 1000 });
    expect(step.state.slots[2].readyAt).toBe(1000);
  });
});

describe("cooldown helpers", () => {
  it("fills the ring linearly from 0 to 1", () => {
    const state = createBattle([g(50, 2000), null], 100, 1000);
    expect(cooldownProgress(state, 0, 1000)).toBe(0);
    expect(cooldownProgress(state, 0, 2000)).toBe(0.5);
    expect(cooldownProgress(state, 0, 3000)).toBe(1);
    expect(cooldownProgress(state, 0, 9000)).toBe(1);
    expect(cooldownProgress(state, 0, 0)).toBe(0);
    expect(cooldownProgress(state, 1, 2000)).toBe(0);
    const fired = fire(state, 0, 3000).state;
    expect(cooldownProgress(fired, 0, 3000)).toBe(0);
    expect(cooldownProgress(fired, 0, 3500)).toBe(0.25);
  });

  it("reports remaining cooldown, next ready time and elapsed time", () => {
    const state = createBattle([g(50, 2000), g(50, 1500)], 100, 1000);
    expect(remainingCooldown(state, 0, 1500)).toBe(1500);
    expect(remainingCooldown(state, 0, 5000)).toBe(0);
    expect(remainingCooldown(state, 3, 1500)).toBe(0);
    expect(nextReadyAt(state)).toBe(2500);
    expect(nextReadyAt(createBattle([], 100, 0))).toBeNull();
    expect(battleElapsed(state, 4000)).toBe(3000);
    expect(battleElapsed(state, 0)).toBe(0);
  });
});

describe("bossPhase", () => {
  it.each([
    [150, 150, 1],
    [100, 150, 1],
    [99.01, 150, 1],
    [99, 150, 2], // exactly 66 % → phase 2
    [50, 150, 2],
    [49.51, 150, 2],
    [49.5, 150, 3], // exactly 33 % → phase 3
    [49, 150, 3],
    [1, 150, 3],
    [0, 150, 3],
    [100, 100, 1],
    [67, 100, 1],
    [66, 100, 2],
    [34, 100, 2],
    [33, 100, 3],
    [0, 100, 3],
  ])("final: %d / %d HP → phase %i", (hp, maxHp, expected) => {
    expect(bossPhase(hp, maxHp, "final")).toBe(expected);
  });

  it("is always phase 1 for the other tiers", () => {
    for (const hp of [100, 66, 33, 0]) {
      expect(bossPhase(hp, 100, "regular")).toBe(1);
      expect(bossPhase(hp, 100, "minion")).toBe(1);
    }
  });
});

describe("resetBattle (Rematch)", () => {
  it("restores full HP with every slot charging from now", () => {
    const loadout = [g(70, 4000), g(55, 3000)];
    let state = createBattle(loadout, 100, 0, "final");
    state = autoFireStep(state, 3000).state;
    state = autoFireStep(state, 4000).state;
    expect(state.defeated).toBe(true);

    const again = resetBattle(state, 20_000);
    expect(again).toMatchObject({
      maxHp: 100,
      hp: 100,
      tier: "final",
      phase: 1,
      startedAt: 20_000,
      defeated: false,
      defeatedAt: null,
      hits: [],
    });
    expect(again.slots.map((s) => s.readyAt)).toEqual([24_000, 23_000, Infinity, Infinity]);
    expect(again.slots.map((s) => s.skill)).toEqual(state.slots.map((s) => s.skill));
  });
});

// ── Estimates ──────────────────────────────────────────────────────────

describe("simulate", () => {
  it("one 50-dmg / 1000-ms skill vs 100 HP clears at 2000 ms in 2 hits", () => {
    const sim = simulate([g(50, 1000, { id: 1 })], 100);
    expect(sim.clearTimeMs).toBe(2000);
    expect(sim.hits).toBe(2);
    expect(sim.truncated).toBe(false);
    expect(sim.timeline.map((h) => [h.at, h.slot, h.hpAfter])).toEqual([
      [1000, 0, 50],
      [2000, 0, 0],
    ]);
  });

  it("interleaves two cooldowns exactly", () => {
    // 30 @ 1000, 1000, 2000 … and 50 @ 1500, 3000 …: 30 → 80 → 110 at 2000 ms.
    const sim = simulate([g(30, 1000), g(50, 1500)], 100);
    expect(sim.clearTimeMs).toBe(2000);
    expect(sim.timeline.map((h) => [h.at, h.slot, h.hpAfter])).toEqual([
      [1000, 0, 70],
      [1500, 1, 20],
      [2000, 0, 0],
    ]);
  });

  it("resolves simultaneous hits in slot order and stops at the killing blow", () => {
    const sim = simulate([g(60, 1000), g(60, 1000), g(60, 1000)], 100);
    expect(sim.clearTimeMs).toBe(1000);
    expect(sim.hits).toBe(2);
    expect(sim.timeline.map((h) => h.slot)).toEqual([0, 1]);
  });

  it("charges first: even a one-shot waits a full cooldown", () => {
    expect(simulate([g(70, 4000)], 50)).toMatchObject({ clearTimeMs: 4000, hits: 1 });
    expect(simulate([g(70, 4000)], 70).clearTimeMs).toBe(4000);
    expect(simulate([g(70, 4000)], 71).clearTimeMs).toBe(8000);
  });

  it("ignores empty slots and non-game entries", () => {
    const sim = simulate([null, g(25, 1000), undefined, byName("Public Speaking")], 50);
    expect(sim.clearTimeMs).toBe(2000);
    expect(sim.timeline.every((h) => h.slot === 1)).toBe(true);
  });

  it("returns Infinity for an empty loadout (unbeatable) and terminates", () => {
    for (const loadout of [[], [null, null], [byName("Public Speaking")], [g(0, 1000)]]) {
      expect(simulate(loadout, 100)).toEqual({
        clearTimeMs: Infinity,
        hits: 0,
        timeline: [],
        truncated: false,
      });
      expect(clearTime(loadout, 100)).toBe(Infinity);
    }
  });

  it("returns 0 for a boss with no HP", () => {
    for (const hp of [0, -1, Number.NaN]) {
      expect(simulate([g(50, 1000)], hp)).toEqual({
        clearTimeMs: 0,
        hits: 0,
        timeline: [],
        truncated: false,
      });
    }
    expect(simulate([], 0).clearTimeMs).toBe(0);
  });

  it("stays bounded for absurd HP, with exact clear time and hit count", () => {
    const sim = simulate([g(50, 1000), g(30, 1500)], 1_000_000_000);
    expect(sim.truncated).toBe(true);
    expect(sim.timeline.length).toBe(MAX_TIMELINE_HITS);
    // 70 damage per 1000 ms on average: 50/1000 + 30/1500 = 0.07 dmg/ms.
    expect(sim.clearTimeMs).toBe(clearTime([g(50, 1000), g(30, 1500)], 1_000_000_000));
    expect(sim.clearTimeMs).toBeGreaterThanOrEqual(1_000_000_000 / 0.07);
    expect(sim.hits).toBeGreaterThan(MAX_TIMELINE_HITS);
  });

  it("caps the timeline when the killing volley crosses the cap", () => {
    // 3 dmg per 1000 ms: 999 hits after 333 volleys, the 334th kills on its second hit (1001).
    const sim = simulate([g(1, 1000), g(1, 1000), g(1, 1000)], 1001);
    expect(sim).toMatchObject({ clearTimeMs: 334_000, hits: 1001, truncated: true });
    expect(sim.timeline).toHaveLength(MAX_TIMELINE_HITS);
    expect(sim.timeline[MAX_TIMELINE_HITS - 1]).toMatchObject({ at: 334_000, slot: 0, hpAfter: 1 });
  });

  it("terminates for astronomical HP with a sane estimate", () => {
    const loadout = [g(50, 1000), g(30, 1500)]; // 0.07 dmg/ms
    for (const hp of [1e17, 1e20, 1e300, Number.MAX_VALUE]) {
      const start = performance.now();
      const time = clearTime(loadout, hp);
      expect(performance.now() - start).toBeLessThan(200);
      expect(time).toBeGreaterThanOrEqual(hp / 0.07 / (1 + 1e-9));
      // Close upper bound, or Infinity once the time itself overflows a double.
      if (Number.isFinite(time)) expect(time).toBeLessThanOrEqual((hp / 0.07) * (1 + 1e-9));
    }
    expect(simulate(loadout, 1e300)).toMatchObject({ truncated: true });
    expect(bestLoadout([...loadout, g(25, 1000)], 1e300)).toHaveLength(3);
  });

  it.each([
    // Mixed cooldowns, a spread of HP values (≈ 1 700 hits each).
    ...Array.from({ length: 15 }, (_, i) => ({
      loadout: [g(50, 1000), g(30, 1500), g(26, 1000)],
      hp: 60_000 + 7 * i,
    })),
    // Exactly 0 HP after slot 2 of the killing volley: slot 3 must not count (2 000 hits).
    { loadout: [g(50, 1000), g(50, 1000), g(50, 1000)], hp: 100_000 },
  ])("keeps clear time and hit count exact past the timeline cap ($hp HP)", ({ loadout, hp }) => {
    // Unbounded reference run through the engine.
    let state = createBattle(loadout, hp, 0);
    for (let at = nextReadyAt(state), steps = 0; at !== null; at = nextReadyAt(state)) {
      if (++steps > 10_000) throw new Error("engine made no progress");
      state = autoFireStep(state, at).state;
    }
    const sim = simulate(loadout, hp);
    expect(state.hits.length).toBeGreaterThan(MAX_TIMELINE_HITS);
    expect(sim.truncated).toBe(true);
    expect(sim.clearTimeMs).toBe(state.defeatedAt);
    expect(sim.hits).toBe(state.hits.length);
    expect(sim.timeline).toEqual(state.hits.slice(0, MAX_TIMELINE_HITS));
  });

  it("agrees with the closed form for off-grid integer numbers", () => {
    const next = rng(2024);
    for (let run = 0; run < 2000; run++) {
      const size = 1 + Math.floor(next() * LOADOUT_SIZE);
      const loadout = Array.from({ length: size }, (_, i) =>
        g(1 + Math.floor(next() * 100), 1 + Math.floor(next() * 5000), { id: i + 1 }),
      );
      const hp = 1 + Math.floor(next() * 500);
      expect(simulate(loadout, hp).clearTimeMs).toBe(clearTime(loadout, hp));
    }
  });

  it("agrees with the closed-form clearTime on random admin-range fights", () => {
    const next = rng(42);
    for (let run = 0; run < 2000; run++) {
      const size = 1 + Math.floor(next() * LOADOUT_SIZE);
      const loadout = Array.from({ length: size }, (_, i) => randomSkill(next, i + 1));
      const hp = 10 + Math.floor(next() * 291);
      const sim = simulate(loadout, hp);
      expect(sim.clearTimeMs).toBe(clearTime(loadout, hp));
      // Damage of every hit before the last falls short; the last one finishes the boss.
      const dealt = sim.timeline.reduce((sum, h) => sum + h.damage, 0);
      expect(dealt).toBeGreaterThanOrEqual(hp);
      expect(dealt - sim.timeline[sim.timeline.length - 1].damage).toBeLessThan(hp);
      expect(sim.hits).toBe(sim.timeline.length);
      expect(sim.timeline[sim.timeline.length - 1].at).toBe(sim.clearTimeMs);
    }
  });

  it("matches a millisecond-by-millisecond auto-fire replay", () => {
    const next = rng(7);
    for (let run = 0; run < 25; run++) {
      const loadout = Array.from({ length: LOADOUT_SIZE }, (_, i) => randomSkill(next, i + 1));
      const hp = 10 + Math.floor(next() * 291);
      let state = createBattle(loadout, hp, 0);
      // 300 HP at 4 × 25 dmg / 4000 ms is the slowest fight: 12 000 ms.
      for (let t = 0; !state.defeated && t <= 20_000; t += 1) state = autoFireStep(state, t).state;
      expect(state.defeated).toBe(true);
      const sim = simulate(loadout, hp);
      expect(sim.clearTimeMs).toBe(state.defeatedAt);
      expect(sim.timeline).toEqual(state.hits);
    }
  });
});

describe("seeded balance", () => {
  const loadout = defaultLoadout(SEEDED_SKILLS);

  it("default loadout clear times vs the four seeded bosses", () => {
    // ReactJS 55 @ 3000; MySQL 65 + Flutter 60 @ 3500; Laravel 70 @ 4000.
    const times = SEEDED_BOSSES.map((boss) => simulate(loadout, boss.hp).clearTimeMs);
    expect(times).toEqual([3500, 3500, 3500, 3000]);
    expect(SEEDED_BOSSES.map((boss) => simulate(loadout, boss.hp).hits)).toEqual([3, 2, 2, 1]);
    expect(times.map(formatClearTime)).toEqual(["3.5 s", "3.5 s", "3.5 s", "3.0 s"]);
    // §6.4 step 2: "±3–6 detik dengan angka bawaan".
    for (const time of times) {
      expect(time).toBeGreaterThanOrEqual(3000);
      expect(time).toBeLessThanOrEqual(6000);
    }
  });

  it("default loadout vs the Training Dummy", () => {
    expect(simulate(loadout, TRAINING_DUMMY_HP).clearTimeMs).toBe(3500);
  });

  it("best loadout beats or equals the default for every seeded boss", () => {
    const best = SEEDED_BOSSES.map((boss) =>
      clearTime(bestLoadout(SEEDED_SKILLS, boss.hp), boss.hp),
    );
    // 150: two 1000-ms skills hit twice by 2000 ms (Bootstrap 52 + HTML 50 + C# 42 + JS 40 = 184).
    // 100 / 80: four fast skills reach 118+ by 1500 ms. 50: HTML 25 + Bootstrap 26 at 1000 ms.
    expect(best).toEqual([2000, 1500, 1500, 1000]);
    SEEDED_BOSSES.forEach((boss, i) => {
      expect(best[i]).toBeLessThanOrEqual(simulate(loadout, boss.hp).clearTimeMs);
    });
  });

  it("best loadout for the minion is HTML + Bootstrap plus the best tie-break", () => {
    const best = bestLoadout(SEEDED_SKILLS, 50);
    expect(best).toHaveLength(LOADOUT_SIZE);
    expect(names(best)).toEqual(expect.arrayContaining(["HTML", "Bootstrap CSS"]));
    // Result comes back in rank order.
    expect([...best].sort(compareSkillRank)).toEqual(best);
  });
});

describe("bestLoadout", () => {
  it("matches an exhaustive search over every combination", () => {
    const next = rng(1234);
    for (let run = 0; run < 60; run++) {
      const pool = Array.from({ length: 8 }, (_, i) => randomSkill(next, i + 1));
      const hp = 10 + Math.floor(next() * 291);
      const brute = Math.min(
        ...combinations(pool, LOADOUT_SIZE).map((c) => simulate(c, hp).clearTimeMs),
      );
      const best = bestLoadout(pool, hp);
      expect(best).toHaveLength(LOADOUT_SIZE);
      expect(simulate(best, hp).clearTimeMs).toBe(brute);
      expect(clearTime(best, hp)).toBeLessThanOrEqual(clearTime(defaultLoadout(pool), hp));
    }
  });

  it("keeps the default loadout when it is already optimal", () => {
    const pool = [g(70, 1000, { id: 1 }), g(60, 1000, { id: 2 }), g(50, 1000, { id: 3 })];
    const extra = [...pool, g(40, 1000, { id: 4 }), g(30, 1000, { id: 5 })];
    // One volley at 1000 ms clears 100 HP for many combos; the default wins the tie.
    expect(bestLoadout(extra, 100).map((s) => s.id)).toEqual([1, 2, 3, 4]);
    expect(bestLoadout(extra, 100)).toEqual(defaultLoadout(extra));
  });

  it("keeps the default on a tie the lower bound cannot prune", () => {
    // 60 @ 1000 needs 2 hits (2000 ms); 26 @ 500 needs 4 hits (2000 ms) with a 1923 ms bound.
    const heavy = g(60, 1000, { id: 1 });
    const quick = g(26, 500, { id: 2 });
    expect(clearTime([heavy], 100)).toBe(clearTime([quick], 100));
    expect(bestLoadout([quick, heavy], 100, 1)).toEqual([heavy]);
  });

  it("prefers fast skills when they clear sooner", () => {
    const slowHeavy = [1, 2, 3, 4].map((id) => g(70, 4000, { id }));
    const fastLight = [5, 6, 7, 8].map((id) => g(25, 1000, { id }));
    expect(bestLoadout([...slowHeavy, ...fastLight], 100).map((s) => s.id)).toEqual([5, 6, 7, 8]);
  });

  it("uses every game skill when fewer than four exist, and handles edge cases", () => {
    expect(names(bestLoadout([byName("HTML"), byName("Public Speaking")], 100))).toEqual(["HTML"]);
    expect(bestLoadout([], 100)).toEqual([]);
    expect(names(bestLoadout(SEEDED_SKILLS, 0))).toEqual(names(defaultLoadout(SEEDED_SKILLS)));
    expect(bestLoadout(SEEDED_SKILLS, 100, 0)).toEqual([]);
    // Size 1: Bootstrap (26) and HTML (25) both need 4 hits = 4000 ms; Bootstrap ranks first.
    expect(names(bestLoadout(SEEDED_SKILLS, 100, 1))).toEqual(["Bootstrap CSS"]);
    expect(clearTime(bestLoadout(SEEDED_SKILLS, 100, 1), 100)).toBe(4000);
  });

  it("stays fast for 30 game skills (well under 200 ms)", () => {
    const next = rng(99);
    const pool = Array.from({ length: 30 }, (_, i) => randomSkill(next, i + 1));
    bestLoadout(pool, 300); // warm-up
    for (const hp of [10, 150, 300]) {
      const start = performance.now();
      const best = bestLoadout(pool, hp);
      const elapsed = performance.now() - start;
      expect(best).toHaveLength(LOADOUT_SIZE);
      expect(elapsed).toBeLessThan(200);
    }
    // Absurd HP does not slow the search down (closed-form scoring).
    const start = performance.now();
    bestLoadout(pool, 1e12);
    expect(performance.now() - start).toBeLessThan(200);
  });
});

describe("formatClearTime", () => {
  it.each([
    [4500, "4.5 s"],
    [3000, "3.0 s"],
    [1449, "1.4 s"],
    [1450, "1.5 s"],
    [0, "0.0 s"],
    [12_345, "12.3 s"],
    [-5, "0.0 s"],
    [Infinity, "—"],
    [Number.NaN, "—"],
  ])("%d ms → %s", (ms, label) => {
    expect(formatClearTime(ms)).toBe(label);
  });
});
