"use client";

import { completeStageHint } from "@/components/game/useStageHint";
import { defaultLoadout, LOADOUT_SIZE, resolveLoadout, type GameSkill } from "@/lib/battle";
import { useGameStore } from "@/lib/store";

/*
 * Loadout changes made in the Skill Tree (spec §4.1 skills, §5.2, §6.4). The save cookie stores
 * the loadout as skill ids (useGameStore.loadout, a compact list: slots fill left to right).
 * An empty save loadout means "never picked": the default loadout (the four hardest hitters) is
 * shown and used. All math stays in lib/battle; these helpers only translate a visitor's action
 * into store calls and a sentence for the live region.
 */

export type LoadoutContext = Readonly<{
  /** Every game skill on the site (inventory order). */
  skills: readonly GameSkill[];
  /** defaultLoadout(skills), slot order. */
  defaults: readonly GameSkill[];
  byId: ReadonlyMap<number, GameSkill>;
}>;

export function loadoutContext(skills: readonly GameSkill[]): LoadoutContext {
  return {
    skills,
    defaults: defaultLoadout(skills),
    byId: new Map(skills.map((skill) => [skill.id, skill])),
  };
}

/**
 * The loadout on screen: the save's (once the cookie was read; unknown ids dropped), or the default
 * while the save holds none. The server and the first client render always show the default.
 */
export function shownLoadout(
  ctx: LoadoutContext,
  saved: readonly number[],
  hydrated: boolean,
): GameSkill[] {
  const custom = hydrated ? resolveLoadout(saved, ctx.skills) : [];
  return custom.length > 0 ? custom : [...ctx.defaults];
}

export function sameIds(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

function currentIds(ctx: LoadoutContext): number[] {
  const game = useGameStore.getState();
  return shownLoadout(ctx, game.loadout, game.hydrated).map((skill) => skill.id);
}

/** A change that happened: the new slot order, where the skill landed, and what to announce. */
export type LoadoutChange = Readonly<{ ids: number[]; landed: number | null; message: string }>;

/**
 * Runs a store mutation on the loadout the visitor sees. The save may hold nothing (the default is
 * shown) or ids the site dropped: that shown loadout is written first, so "slot 3" means the slot
 * they look at. Every real change unlocks the Tinkerer badge (spec §5: "mengganti loadout skill
 * sekali"; the toast comes in phase 7) and completes the stage hint.
 */
function commit(before: readonly number[], mutate: () => void): number[] | null {
  const game = useGameStore.getState();
  if (!game.hydrated) return null; // a write before the cookie is read would be overwritten
  if (!sameIds(game.loadout, before)) game.setLoadout([...before]);
  mutate();
  const after = [...useGameStore.getState().loadout];
  if (sameIds(after, before)) return null;
  game.unlockBadge("tinkerer");
  completeStageHint("skills");
  return after;
}

const nameOf = (ctx: LoadoutContext, id: number | undefined) =>
  (id !== undefined ? ctx.byId.get(id)?.name : undefined) ?? "A skill";

/** Whether equipping `skillId` into `slot` would change nothing (same rules as store.equip). */
export function isNoopEquip(ids: readonly number[], slot: number, skillId: number): boolean {
  return slot < ids.length ? ids[slot] === skillId : ids[ids.length - 1] === skillId;
}

/**
 * Puts a skill into a slot (store.equip: replace, or swap when it is already equipped; a slot past
 * the last filled one means "the first empty slot"). Returns null when nothing changed.
 */
export function equipSkill(
  ctx: LoadoutContext,
  slot: number,
  skillId: number,
): LoadoutChange | null {
  if (!ctx.byId.has(skillId) || slot < 0 || slot >= LOADOUT_SIZE) return null;
  const before = currentIds(ctx);
  if (isNoopEquip(before, slot, skillId)) return null;
  const after = commit(before, () => useGameStore.getState().equip(slot, skillId));
  if (!after) return null;

  const landed = after.indexOf(skillId);
  const from = before.indexOf(skillId);
  const name = nameOf(ctx, skillId);
  const other = landed < before.length ? before[landed] : undefined;
  let message: string;
  if (from === -1) {
    message =
      other !== undefined
        ? `${name} equipped in slot ${landed + 1}, replacing ${nameOf(ctx, other)}.`
        : `${name} equipped in slot ${landed + 1}.`;
  } else {
    message =
      other !== undefined && other !== skillId
        ? `${name} moved to slot ${landed + 1}, ${nameOf(ctx, other)} to slot ${from + 1}.`
        : `${name} moved to slot ${landed + 1}.`;
  }
  return { ids: after, landed, message };
}

/**
 * Empties a slot (the ones after it move up: the loadout stays compact). The last equipped skill
 * can't be removed — an empty loadout would mean "default" again and silently bring back four.
 */
export function unequipSlot(ctx: LoadoutContext, slot: number): LoadoutChange | null {
  const before = currentIds(ctx);
  if (slot < 0 || slot >= before.length || before.length <= 1) return null;
  const after = commit(before, () => useGameStore.getState().unequip(slot));
  if (!after) return null;
  return {
    ids: after,
    landed: null,
    message: `${nameOf(ctx, before[slot])} unequipped from slot ${slot + 1}.`,
  };
}

/** Back to the default loadout: the save forgets the picks (empty list = default). */
export function resetLoadout(ctx: LoadoutContext): LoadoutChange | null {
  const game = useGameStore.getState();
  if (!game.hydrated || game.loadout.length === 0) return null;
  game.setLoadout([]);
  const ids = ctx.defaults.map((skill) => skill.id);
  return {
    ids,
    landed: null,
    message: `Default loadout restored: ${ctx.defaults.map((skill) => skill.name).join(", ")}.`,
  };
}
