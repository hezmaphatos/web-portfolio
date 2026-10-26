/**
 * Boss battle & lock system (PORTFOLIO_SPEC §6.4) as pure, deterministic logic.
 *
 * No React, no DOM, no timers, no clock: every function that depends on time takes `now`
 * (milliseconds, any monotonic origin) as an argument. Damage is fixed — no randomness, no
 * crits — so every fight and every estimate is reproducible.
 *
 * Used by the admin Boss Preview (`simulate`, `defaultLoadout`, `bestLoadout`, `formatClearTime`),
 * the Skill Tree Training Dummy and the Project Stage Battle Arena (`createBattle`, `fire`,
 * `autoFireStep`, `autoFireUntil`, `phaseShift`, …), and the tech-chip lock (`visibleTechCount`,
 * `splitTech`).
 *
 * Numbers are exact for the integer milliseconds and HP the API serves (`cooldown_ms`,
 * `damage`, `boss_hp` are integers); fractional inputs work but are subject to float rounding.
 */
import type { BossTier, Skill } from "@/lib/types";

// ── Constants ──────────────────────────────────────────────────────────

/** The loadout has four slots (§6.4 "loadout 4 skill", §4.1 "4 slot loadout"). */
export const LOADOUT_SIZE = 4;

/** HP of the Skill Tree Training Dummy (§4.1: HP 100, resets, unlocks nothing). */
export const TRAINING_DUMMY_HP = 100;

/**
 * HP percentages at which a `final` boss changes visual phase (§6.4 step 4: "di 66% dan 33% HP").
 * See `bossPhase` for the exact boundaries.
 */
export const FINAL_PHASE_THRESHOLDS = [66, 33] as const;

/**
 * `simulate` records at most this many hits in its timeline. A real fight is far below it
 * (HP ≤ 300 at ≥ 25 damage per hit is ≤ 12 hits); the cap only keeps absurd inputs bounded.
 * `clearTimeMs` and `hits` stay exact past it.
 */
export const MAX_TIMELINE_HITS = 1000;

// ── Types ──────────────────────────────────────────────────────────────

/** A skill that can be equipped (§6.4 damage model): not `soft`, positive `damage` and `cooldown_ms`. */
export type GameSkill = Readonly<{
  id: number;
  name: string;
  /** Falls back to `name` when the skill has no attack name. */
  attack_name: string;
  damage: number;
  cooldown_ms: number;
  level: number;
  sort_order: number;
}>;

/** Anything the helpers accept as a skill: the API shape (public or admin) or a `GameSkill`. */
export type SkillLike = Skill | GameSkill;

/** Loadout as stored in the save cookie (§5.2): skill ids, at most four, no duplicates. */
export type LoadoutIds = readonly number[];

/**
 * A loadout handed to the fight engine: index = slot (0-based). `null`/`undefined` or a skill that
 * is not a game skill = empty slot. Only the first `LOADOUT_SIZE` entries are used.
 */
export type Loadout = readonly (SkillLike | null | undefined)[];

/** One loadout slot during a fight (§6.4 step 2–3). An empty slot has `skill: null` and never fires. */
export type BattleSlot = Readonly<{
  skill: GameSkill | null;
  /** Time (ms) at which the slot is charged and can fire; `Infinity` for an empty slot. */
  readyAt: number;
}>;

/** One attack landing on the boss (§6.4 step 3–4: floating "-55", attack name, aria-live text). */
export type Hit = Readonly<{
  /** 0-based slot index (keyboard shortcut = slot + 1). */
  slot: number;
  skillId: number;
  attackName: string;
  /** The skill's fixed damage (shown as the floating "-55"), even when it overkills. */
  damage: number;
  /** Boss HP after the hit, clamped at 0. */
  hpAfter: number;
  /** Time (ms) of the hit. */
  at: number;
}>;

/** Visual phase of a boss (§6.4 step 4): 1–3 for `final`, always 1 otherwise. */
export type BossPhase = 1 | 2 | 3;

/** Immutable state of one fight (§6.4 "Alur pertarungan"). Every transition returns a new object. */
export type BattleState = Readonly<{
  maxHp: number;
  hp: number;
  tier: BossTier;
  /** Visual phase for `hp` (always 1 unless `tier` is `final`). */
  phase: BossPhase;
  /** Time (ms) FIGHT! was pressed. */
  startedAt: number;
  /** Always `LOADOUT_SIZE` slots, empty ones padded with `skill: null`. */
  slots: readonly BattleSlot[];
  /** Every hit so far, oldest first. */
  hits: readonly Hit[];
  defeated: boolean;
  /** Time (ms) of the killing blow (`startedAt` for a 0-HP boss), `null` while the boss stands. */
  defeatedAt: number | null;
}>;

/** Result of `fire`: the next state and the hit, or the unchanged state and `null`. */
export type FireResult = Readonly<{ state: BattleState; hit: Hit | null }>;

/** Result of `autoFireStep`: the next state and the hits fired this tick (slot order). */
export type AutoFireResult = Readonly<{ state: BattleState; hits: readonly Hit[] }>;

/** Result of `simulate` (§6.4 "simulate(loadout, hp) yang menghasilkan estimasi waktu clear"). */
export type Simulation = Readonly<{
  /**
   * Time (ms, from FIGHT!) of the killing blow. `0` for a boss with HP ≤ 0. `Infinity` when the
   * loadout holds no game skill (nothing can ever hit, so the boss is unbeatable).
   */
  clearTimeMs: number;
  /** Number of hits up to and including the killing blow (`0` when unbeatable or 0 HP). */
  hits: number;
  /** Every hit in firing order (slot order within one instant), at most `MAX_TIMELINE_HITS`. */
  timeline: readonly Hit[];
  /** `true` only when the fight needs more than `MAX_TIMELINE_HITS` hits (timeline cut short). */
  truncated: boolean;
}>;

// ── Skills ─────────────────────────────────────────────────────────────

function isPlayable(damage: number | null, cooldownMs: number | null): boolean {
  return (
    damage !== null &&
    cooldownMs !== null &&
    Number.isFinite(damage) &&
    Number.isFinite(cooldownMs) &&
    damage > 0 &&
    cooldownMs > 0
  );
}

/**
 * Whether an API skill is a game skill (§6.4 damage model, Lampiran A: "Skill dalam kategori
 * `soft` tidak dijadikan skill game"): category is not `soft` and `damage`/`cooldown_ms` are set.
 * Non-positive or non-finite numbers are rejected too, so a fight always progresses.
 * Visibility (`is_visible` on admin rows) is not checked — filter hidden skills yourself.
 */
export function isGameSkill(
  skill: Skill,
): skill is Skill & { damage: number; cooldown_ms: number } {
  return skill.category !== "soft" && isPlayable(skill.damage, skill.cooldown_ms);
}

/**
 * Game view of a skill (§6.4: `attack_name`, `damage`, `cooldown_ms`), or `null` when it is not a
 * game skill (see `isGameSkill`). A `GameSkill` is returned as-is when its numbers are playable.
 */
export function toGameSkill(skill: SkillLike): GameSkill | null {
  if (!("category" in skill)) {
    return isPlayable(skill.damage, skill.cooldown_ms) ? skill : null;
  }
  if (!isGameSkill(skill)) return null;
  return {
    id: skill.id,
    name: skill.name,
    attack_name: skill.attack_name?.trim() || skill.name,
    damage: skill.damage,
    cooldown_ms: skill.cooldown_ms,
    level: skill.level,
    sort_order: skill.sort_order,
  };
}

/** Keeps only the game skills (§6.4; soft skills are About chips only), input order preserved. */
export function toGameSkills(skills: readonly SkillLike[]): GameSkill[] {
  const out: GameSkill[] = [];
  for (const skill of skills) {
    const game = toGameSkill(skill);
    if (game) out.push(game);
  }
  return out;
}

/**
 * Damage per second = `damage ÷ (cooldown_ms / 1000)`, the balancing number of §7 Skills and
 * Lampiran A (guideline ≈ 16–28, admin warns outside 15–30). Unrounded; `0` for unplayable numbers.
 */
export function dps(skill: Pick<GameSkill, "damage" | "cooldown_ms">): number {
  if (!isPlayable(skill.damage, skill.cooldown_ms)) return 0;
  return skill.damage / (skill.cooldown_ms / 1000);
}

/**
 * Default-loadout ranking (§6.4 "Default = 4 skill dengan `damage` tertinggi (seri: `level` lalu
 * `sort_order`)"): higher `damage` first; ties → higher `level`, then lower `sort_order`, then
 * lower `id` (so the order is total and stable). Use as an `Array.prototype.sort` comparator.
 */
export function compareSkillRank(a: GameSkill, b: GameSkill): number {
  return b.damage - a.damage || b.level - a.level || a.sort_order - b.sort_order || a.id - b.id;
}

/** Game skills, one per id (first wins), in `compareSkillRank` order. */
function rankedGameSkills(skills: readonly SkillLike[]): GameSkill[] {
  const seen = new Set<number>();
  const out: GameSkill[] = [];
  for (const skill of toGameSkills(skills)) {
    if (seen.has(skill.id)) continue;
    seen.add(skill.id);
    out.push(skill);
  }
  return out.sort(compareSkillRank);
}

function clampSize(size: number): number {
  if (!Number.isFinite(size)) return LOADOUT_SIZE;
  return Math.max(0, Math.min(LOADOUT_SIZE, Math.floor(size)));
}

// ── Loadout ────────────────────────────────────────────────────────────

/**
 * Default loadout (§6.4 "Default = 4 skill dengan `damage` tertinggi"): the `size` game skills that
 * rank first by `compareSkillRank` (damage desc, then level desc, sort_order asc, id asc), in that
 * order = slot order. `size` is clamped to 0..LOADOUT_SIZE; duplicate ids count once.
 */
export function defaultLoadout(skills: readonly SkillLike[], size = LOADOUT_SIZE): GameSkill[] {
  return rankedGameSkills(skills).slice(0, clampSize(size));
}

/**
 * Cleans a loadout read from the save cookie (§5.2 "unknown IDs are filtered on hydrate"): drops
 * ids that are not integers, not in `availableSkills`, or not game skills, drops duplicates
 * (first wins), and keeps at most LOADOUT_SIZE. Nothing is filled in — a short loadout just has
 * empty slots, and an empty result is the caller's cue to fall back to `defaultLoadout`.
 */
export function sanitizeLoadout(
  ids: readonly number[],
  availableSkills: readonly SkillLike[],
): number[] {
  const known = new Set(toGameSkills(availableSkills).map((s) => s.id));
  const out: number[] = [];
  for (const id of ids) {
    if (out.length >= LOADOUT_SIZE) break;
    if (Number.isInteger(id) && known.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/** Save-cookie ids → game skills (§5.2): `sanitizeLoadout`, then lookup, slot order kept. */
export function resolveLoadout(
  ids: readonly number[],
  availableSkills: readonly SkillLike[],
): GameSkill[] {
  const byId = new Map<number, GameSkill>();
  for (const skill of toGameSkills(availableSkills))
    if (!byId.has(skill.id)) byId.set(skill.id, skill);
  const out: GameSkill[] = [];
  for (const id of sanitizeLoadout(ids, availableSkills)) {
    const skill = byId.get(id);
    if (skill) out.push(skill);
  }
  return out;
}

// ── Tech lock ──────────────────────────────────────────────────────────

/**
 * Number of tech chips shown before the boss is defeated (§6.4 "Rumus tech terlihat"):
 * `min(n − 1, ceil(n × percent / 100))`, never below 0. At least one chip is always locked
 * (n = 1 → 0 visible, even at 100 %); n = 0 → 0. Non-finite or negative `percent` counts as 0;
 * a fractional or negative `n` is floored / treated as 0.
 */
export function visibleTechCount(n: number, percent: number): number {
  const count = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  if (count === 0) return 0;
  const pct = Number.isFinite(percent) ? Math.max(0, percent) : 0;
  return Math.max(0, Math.min(count - 1, Math.ceil((count * pct) / 100)));
}

/**
 * Splits a project's tech (already in `project_skill.sort_order`, §6.4 "Urutan tech") into the
 * visible head and the locked tail ("???" chips) using `visibleTechCount`. Input is not mutated.
 */
export function splitTech<T>(items: readonly T[], percent: number): { visible: T[]; locked: T[] } {
  const visible = visibleTechCount(items.length, percent);
  return { visible: items.slice(0, visible), locked: items.slice(visible) };
}

// ── Fight engine ───────────────────────────────────────────────────────

function normalizeHp(hp: number): number {
  return Number.isFinite(hp) ? Math.max(0, hp) : 0;
}

/** Slots as the engine sees them: first LOADOUT_SIZE entries, non-game skills → empty. */
function toSlotSkills(loadout: Loadout): (GameSkill | null)[] {
  const slots: (GameSkill | null)[] = [];
  for (let i = 0; i < LOADOUT_SIZE; i++) {
    const skill = loadout[i];
    slots.push(skill ? toGameSkill(skill) : null);
  }
  return slots;
}

/** The non-empty slots' skills, slot order kept. */
function filledSlots(loadout: Loadout): GameSkill[] {
  return toSlotSkills(loadout).filter((s): s is GameSkill => s !== null);
}

/**
 * Visual phase of a boss (§6.4 step 4: `final` has 3 phases "di 66% dan 33% HP"; other tiers only
 * flash). For `final`, with `p = hp / maxHp`:
 * - phase 1 while p > 66 % (full HP is always phase 1),
 * - phase 2 while 33 % < p ≤ 66 % (it starts the moment HP drops to 66 % or below),
 * - phase 3 while p ≤ 33 % (including 0 HP).
 * E.g. max 150: 100 → 1, 99 → 2, 50 → 2, 49 → 3. Compared as `hp × 100` vs `threshold × maxHp`, so
 * integer inputs have no float rounding at the edges. Every other tier is always phase 1.
 */
export function bossPhase(hp: number, maxHp: number, tier: BossTier): BossPhase {
  if (tier !== "final") return 1;
  const [first, second] = FINAL_PHASE_THRESHOLDS;
  if (hp * 100 > first * maxHp) return 1;
  if (hp * 100 > second * maxHp) return 2;
  return 3;
}

/**
 * Starts a fight at `now` (§6.4 step 2: FIGHT! pressed). Every slot starts *charging*:
 * `readyAt = now + cooldown_ms`, so no fight ends in one instant volley. Only the first
 * LOADOUT_SIZE entries are used; missing or non-game entries become empty slots. A non-finite or
 * negative `bossHp` is treated as 0 (already defeated at `now`). `tier` only drives `phase`.
 */
export function createBattle(
  loadout: Loadout,
  bossHp: number,
  now: number,
  tier: BossTier = "regular",
): BattleState {
  const maxHp = normalizeHp(bossHp);
  const defeated = maxHp <= 0;
  return {
    maxHp,
    hp: maxHp,
    tier,
    phase: bossPhase(maxHp, maxHp, tier),
    startedAt: now,
    slots: toSlotSkills(loadout).map((skill) => ({
      skill,
      readyAt: skill ? now + skill.cooldown_ms : Infinity,
    })),
    hits: [],
    defeated,
    defeatedAt: defeated ? now : null,
  };
}

/**
 * Rematch (§6.4 step 7; also the Training Dummy auto-reset, §4.1): the same loadout, boss HP and
 * tier at full HP, all slots charging again from `now`, no hits. Never re-locks anything — the
 * `defeated` save flag lives in the cookie, not here.
 */
export function resetBattle(state: BattleState, now: number): BattleState {
  return createBattle(
    state.slots.map((s) => s.skill),
    state.maxHp,
    now,
    state.tier,
  );
}

/**
 * Whether a slot can fire at `now` (§6.4 step 3: "Slot yang siap"): it holds a skill, its cooldown
 * has elapsed (`now ≥ readyAt`), and the boss still stands. Out-of-range slots are never ready.
 */
export function isSlotReady(state: BattleState, slot: number, now: number): boolean {
  const s = state.slots[slot];
  return !state.defeated && s !== undefined && s.skill !== null && now >= s.readyAt;
}

/** Indices of all ready slots at `now` (§6.4 step 3), in slot order. */
export function readySlots(state: BattleState, now: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < state.slots.length; i++) if (isSlotReady(state, i, now)) out.push(i);
  return out;
}

/**
 * Earliest time a slot becomes ready (§6.4 cooldowns), or `null` when nothing can fire again (no
 * skills, or boss defeated). The UI can schedule its next auto-fire tick with it; `simulate`
 * jumps straight to it.
 */
export function nextReadyAt(state: BattleState): number | null {
  if (state.defeated) return null;
  let next = Infinity;
  for (const s of state.slots) if (s.skill && s.readyAt < next) next = s.readyAt;
  return Number.isFinite(next) ? next : null;
}

/** Milliseconds until the slot is charged (§6.4 cooldown); 0 when ready or empty. */
export function remainingCooldown(state: BattleState, slot: number, now: number): number {
  const s = state.slots[slot];
  if (!s?.skill) return 0;
  return Math.max(0, s.readyAt - now);
}

/**
 * Cooldown ring fill (§6.4 step 2 "cincin cooldown terisi sesuai `cooldown_ms`"): 0 at FIGHT! and
 * right after firing, rising linearly to 1 when ready, clamped to 0..1. Empty slot → 0.
 */
export function cooldownProgress(state: BattleState, slot: number, now: number): number {
  const s = state.slots[slot];
  if (!s?.skill) return 0;
  const progress = 1 - (s.readyAt - now) / s.skill.cooldown_ms;
  return Math.min(1, Math.max(0, progress));
}

/** Fight duration (§6.4): from FIGHT! up to `now`, or up to the killing blow once defeated. */
export function battleElapsed(state: BattleState, now: number): number {
  return Math.max(0, (state.defeatedAt ?? now) - state.startedAt);
}

/**
 * Fires one slot (§6.4 step 3: click/tap or keys 1–4; step 5: HP 0 = defeated). Returns
 * `hit: null` and the very same state when the slot is empty, still charging, out of range, or
 * the boss is already defeated. Otherwise the skill's fixed damage lands (no randomness; HP clamps
 * at 0; 0 HP = defeated at `now`) and the slot recharges: `readyAt = now + cooldown_ms`.
 */
export function fire(state: BattleState, slot: number, now: number): FireResult {
  const current = state.slots[slot];
  if (!isSlotReady(state, slot, now) || !current?.skill) return { state, hit: null };
  const skill = current.skill;
  const hpAfter = Math.max(0, state.hp - skill.damage);
  const defeated = hpAfter <= 0;
  const hit: Hit = {
    slot,
    skillId: skill.id,
    attackName: skill.attack_name,
    damage: skill.damage,
    hpAfter,
    at: now,
  };
  return {
    hit,
    state: {
      ...state,
      hp: hpAfter,
      phase: bossPhase(hpAfter, state.maxHp, state.tier),
      slots: state.slots.map((s, i) =>
        i === slot ? { skill, readyAt: now + skill.cooldown_ms } : s,
      ),
      hits: [...state.hits, hit],
      defeated,
      defeatedAt: defeated ? now : null,
    },
  };
}

/**
 * Auto-fire tick (§6.4 step 3: Auto-fire "menembakkan slot yang siap secara berurutan"): fires
 * every slot that is ready at `now`, in slot order (1 → 4), and stops as soon as the boss is
 * defeated (later slots keep their charge). No ready slot → same state, no hits.
 */
export function autoFireStep(state: BattleState, now: number): AutoFireResult {
  const hits: Hit[] = [];
  let current = state;
  for (let i = 0; i < current.slots.length; i++) {
    const result = fire(current, i, now);
    if (result.hit) {
      hits.push(result.hit);
      current = result.state;
    }
  }
  return { state: current, hits };
}

/**
 * Auto-fire catch-up for a frame-driven UI (§6.4 step 3, Arena and Training Dummy): fires every
 * volley that came due up to `now`, each at its **exact** ready time (not at the frame time), so a
 * fight with Auto-fire on from FIGHT! ends at exactly `clearTime(loadout, hp)` whatever the frame
 * rate. `since` = the moment Auto-fire was switched on: volleys that came due before it (while the
 * visitor was firing by hand, or not at all) fire at `since`. Stops at the killing blow; returns
 * the same state and no hits when nothing is due. Terminates: every volley fires ≥ 1 hit and the
 * boss HP is finite, and volleys after `now` are never fired.
 */
export function autoFireUntil(
  state: BattleState,
  now: number,
  since = Number.NEGATIVE_INFINITY,
): AutoFireResult {
  const hits: Hit[] = [];
  let current = state;
  for (;;) {
    const next = nextReadyAt(current);
    if (next === null) break;
    const at = Math.max(next, since);
    if (!(at <= now)) break; // also stops on NaN
    const step = autoFireStep(current, at);
    if (step.hits.length === 0) break;
    current = step.state;
    hits.push(...step.hits);
  }
  return { state: current, hits };
}

/**
 * The visual phase a `final` boss just entered (§6.4 step 4: "di 66% dan 33% HP sprite berubah dan
 * teks ejekan muncul"), or `null` when the phase did not change — or when the boss fell: a killing
 * blow that crosses a threshold shows the defeat, not a taunt. Several thresholds crossed at once
 * (a big hit, or one Auto-fire volley) report only the phase reached.
 */
export function phaseShift(before: BattleState, after: BattleState): BossPhase | null {
  if (after.defeated || after.phase === before.phase) return null;
  return after.phase;
}

// ── Estimates ──────────────────────────────────────────────────────────

/** Damage dealt by time `t` (inclusive) from the all-charging start at 0: slot i hits at k·cd_i. */
function damageBy(skills: readonly GameSkill[], t: number): number {
  let total = 0;
  for (const s of skills) total += s.damage * Math.floor(t / s.cooldown_ms);
  return total;
}

/**
 * Exact clear time of an optimal auto-fire fight, in closed form. Every slot hits at multiples of
 * its cooldown, so the clear time is the first such instant `t` with `damageBy(t) ≥ hp`. Bounded
 * by `hp / Σrate ≤ t ≤ (hp + Σdamage) / Σrate`; for each slot a binary search finds its first
 * multiple in that window that clears, and the earliest wins. O(n² log) — independent of HP.
 *
 * Exact while the times stay safe integers (any real fight). Past 2^53 consecutive integers are
 * no longer representable, so the search stops as soon as it cannot move and keeps the multiple
 * known to clear: astronomical HP gives an approximate (upper-bound) time instead of a hang.
 */
function clearTimeOf(skills: readonly GameSkill[], hp: number): number {
  if (hp <= 0) return 0;
  if (skills.length === 0) return Infinity;
  let rate = 0;
  let burst = 0;
  for (const s of skills) {
    rate += s.damage / s.cooldown_ms;
    burst += s.damage;
  }
  const lower = hp / rate;
  const upper = (hp + burst) / rate;
  let best = Infinity;
  for (const s of skills) {
    const cd = s.cooldown_ms;
    let lo = Math.max(1, Math.floor(lower / cd));
    if (lo * cd >= best) continue;
    let hi = Math.max(lo, Math.ceil(upper / cd));
    // Float safety net: with exact arithmetic `hi` already clears and this never loops. It ends
    // at the latest when `hi` overflows to Infinity (damageBy(Infinity) = Infinity).
    while (damageBy(skills, hi * cd) < hp) hi *= 2;
    // Invariant: `hi` clears. Every step strictly moves `lo` up or `hi` down, or stops.
    while (lo < hi) {
      const mid = lo + Math.floor((hi - lo) / 2);
      if (damageBy(skills, mid * cd) >= hp) {
        if (mid >= hi) break;
        hi = mid;
      } else {
        const next = mid + 1;
        if (next <= lo) break;
        lo = next;
      }
    }
    if (hi * cd < best) best = hi * cd;
  }
  return best;
}

/** Hits up to and including the killing blow at `time` (the killing volley fires in slot order). */
function hitsToClear(skills: readonly GameSkill[], hp: number, time: number): number {
  if (!Number.isFinite(time) || time <= 0) return 0;
  let dealt = 0;
  let hits = 0;
  for (const s of skills) {
    const before = Math.ceil(time / s.cooldown_ms) - 1; // hits strictly before `time`
    dealt += before * s.damage;
    hits += before;
  }
  for (const s of skills) {
    if (!Number.isInteger(time / s.cooldown_ms)) continue;
    hits++;
    dealt += s.damage;
    if (dealt >= hp) break;
  }
  return hits;
}

/**
 * Exact clear time (ms) of `simulate(loadout, bossHp)` — same rules, same result — computed in
 * closed form without the hit timeline (§7 Boss Preview estimate). `0` for HP ≤ 0, `Infinity` for
 * a loadout without game skills. Fast and terminating for any HP; exact while the clear time is a
 * safe integer (beyond ≈ 9 × 10^15 ms it is a close upper bound).
 */
export function clearTime(loadout: Loadout, bossHp: number): number {
  return clearTimeOf(filledSlots(loadout), normalizeHp(bossHp));
}

/**
 * Plays a whole fight with optimal play (§6.4 "`simulate(loadout, hp)` yang menghasilkan estimasi
 * waktu clear", used by the §7 Boss Preview): starts at t = 0 with every slot charging, Auto-fire
 * on, every slot fires the instant it is ready, simultaneous slots in slot order. Event-driven
 * through the real engine (`createBattle` → `nextReadyAt` → `autoFireStep`), so the result is
 * exact and identical to a perfect player.
 *
 * Always terminates: every step fires at least one positive-damage hit, and the timeline stops at
 * `MAX_TIMELINE_HITS` (then `truncated: true` and the still-exact `clearTimeMs`/`hits` come from
 * the closed form, see `clearTime`). Empty loadout (no game skill in the first four entries) →
 * `clearTimeMs: Infinity`, `hits: 0`, empty timeline. HP ≤ 0 → `clearTimeMs: 0`, `hits: 0`.
 */
export function simulate(loadout: Loadout, bossHp: number): Simulation {
  let state = createBattle(loadout, bossHp, 0);
  while (!state.defeated && state.hits.length < MAX_TIMELINE_HITS) {
    const at = nextReadyAt(state);
    if (at === null) break;
    const step = autoFireStep(state, at);
    // A slot is always ready at `nextReadyAt`; the check makes progress structural anyway.
    if (step.hits.length === 0) break;
    state = step.state;
  }
  if (state.defeated) {
    // The step that crosses the cap fires up to LOADOUT_SIZE hits, so the killing blow may land
    // just past it: the counts stay exact, the timeline is still capped.
    const truncated = state.hits.length > MAX_TIMELINE_HITS;
    return {
      clearTimeMs: state.defeatedAt ?? 0,
      hits: state.hits.length,
      timeline: truncated ? state.hits.slice(0, MAX_TIMELINE_HITS) : state.hits,
      truncated,
    };
  }
  const skills = filledSlots(loadout);
  if (skills.length === 0)
    return { clearTimeMs: Infinity, hits: 0, timeline: [], truncated: false };
  const time = clearTimeOf(skills, state.maxHp);
  return {
    clearTimeMs: time,
    hits: hitsToClear(skills, state.maxHp, time),
    timeline: state.hits.slice(0, MAX_TIMELINE_HITS),
    truncated: true,
  };
}

/**
 * The loadout with the minimum clear time (§7 Projects "Boss" tab: Boss Preview "loadout terbaik"),
 * scored with the same rules as `simulate`. Picks exactly `min(size, game skills)` skills (`size`
 * clamped to 0..LOADOUT_SIZE; adding a skill never slows a fight) by exhaustive search over the
 * combinations, pruned by the lower bound `max(min cooldown, hp / Σdps)`. Ties keep the default
 * loadout, otherwise the combination that ranks first by `compareSkillRank`, so the result equals
 * `defaultLoadout` whenever that is already optimal. Returned in rank order. HP ≤ 0 → the default.
 * ~30 game skills (27 405 combinations) take a few milliseconds.
 */
export function bestLoadout(
  skills: readonly SkillLike[],
  bossHp: number,
  size = LOADOUT_SIZE,
): GameSkill[] {
  const ranked = rankedGameSkills(skills);
  const n = ranked.length;
  const k = Math.min(clampSize(size), n);
  const hp = normalizeHp(bossHp);
  if (k === 0 || hp <= 0) return ranked.slice(0, k);

  const rate = ranked.map((s) => s.damage / s.cooldown_ms); // damage per ms
  const idx = Array.from({ length: k }, (_, i) => i);
  const combo = ranked.slice(0, k);
  let best = clearTimeOf(combo, hp); // the default loadout: ties keep it
  let bestIdx = idx.slice();

  for (;;) {
    // Next combination in lexicographic (= rank) order.
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) break;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;

    let sumRate = 0;
    let minCooldown = Infinity;
    for (let j = 0; j < k; j++) {
      const skill = ranked[idx[j]];
      combo[j] = skill;
      sumRate += rate[idx[j]];
      if (skill.cooldown_ms < minCooldown) minCooldown = skill.cooldown_ms;
    }
    if (Math.max(minCooldown, hp / sumRate) >= best) continue;
    const time = clearTimeOf(combo, hp);
    if (time < best) {
      best = time;
      bestIdx = idx.slice();
    }
  }
  return bestIdx.map((j) => ranked[j]);
}

/**
 * Clear-time label for the §7 Boss Preview: milliseconds → seconds with one decimal, rounded half
 * up (4500 → "4.5 s", 3000 → "3.0 s", 1450 → "1.5 s"). Unbeatable (`Infinity`/`NaN`) → "—".
 */
export function formatClearTime(ms: number): string {
  if (!Number.isFinite(ms)) return "—";
  return `${(Math.round(Math.max(0, ms) / 100) / 10).toFixed(1)} s`;
}
