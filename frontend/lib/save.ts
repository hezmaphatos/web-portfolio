// zod/mini (tree-shakable functional checks): the classic `zod` build put ~100 KB of mostly unused
// code in every public page's bundle just for this one schema (phase 8B).
import * as z from "zod/mini";

import { SECTION_KEYS, type SectionKey } from "@/lib/types";

/**
 * The game save file (spec §5.2): progress only, in a first-party cookie that lives 7 days after
 * the last change. The only module that reads or writes `document.cookie` for the game.
 *
 * Cookie value = URL-encoded compact JSON:
 * {"v":1,"loadout":[skillId…≤4],"defeated":[projectId…],"badges":["first-blood",…],
 *  "hints":["skills","projects"],"visited":<chapter bitmask>,"t":<epoch ms created>}
 *
 * Not a security mechanism: visitors may edit it; it only unlocks cosmetic rewards.
 */

export const SAVE_COOKIE = "p1_save";
export const SAVE_VERSION = 1;
/** 7 days, renewed on every write (sliding expiry). */
export const SAVE_MAX_AGE = 60 * 60 * 24 * 7;
/** Encoded cookie value budget; `hints` are dropped first when over (spec §5.2). */
export const SAVE_MAX_BYTES = 2048;
export const LOADOUT_SIZE = 4;

const id = z.int().check(z.positive());
const slug = z.string().check(z.regex(/^[a-z0-9]+(?:[-:][a-z0-9]+)*$/), z.maxLength(40));

const saveSchema = z.object({
  v: z.literal(SAVE_VERSION),
  loadout: z.array(id).check(z.maxLength(LOADOUT_SIZE)),
  defeated: z.array(id).check(z.maxLength(500)),
  badges: z.array(slug).check(z.maxLength(50)),
  hints: z.array(slug).check(z.maxLength(50)),
  visited: z.int().check(z.minimum(0), z.maximum(2 ** SECTION_KEYS.length - 1)),
  t: z.int().check(z.nonnegative()),
});

export type SaveFile = z.infer<typeof saveSchema>;

/** Chapter → bit in `visited` (boot = 1, hero = 2, … contact = 128). */
export const CHAPTER_BIT: Record<SectionKey, number> = Object.fromEntries(
  SECTION_KEYS.map((key, index) => [key, 1 << index]),
) as Record<SectionKey, number>;

export const ALL_CHAPTERS_MASK = (1 << SECTION_KEYS.length) - 1;

export function newSave(now: number): SaveFile {
  return { v: SAVE_VERSION, loadout: [], defeated: [], badges: [], hints: [], visited: 0, t: now };
}

const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

/**
 * Cookie value → save file, or null when missing, corrupt or from an unknown version
 * (the caller then starts a new save). Duplicate ids collapse.
 */
export function parseSave(raw: string | null | undefined): SaveFile | null {
  if (!raw) return null;
  let json: unknown;
  try {
    json = JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
  const result = saveSchema.safeParse(json);
  if (!result.success) return null;
  const save = result.data;
  return {
    ...save,
    loadout: unique(save.loadout),
    defeated: unique(save.defeated),
    badges: unique(save.badges),
    hints: unique(save.hints),
  };
}

/**
 * Save file → cookie value, within SAVE_MAX_BYTES: hints are dropped first, then the oldest
 * defeated bosses (the list only grows; badges and loadout are small and kept).
 */
export function serializeSave(save: SaveFile): string {
  const compact = (s: SaveFile) =>
    encodeURIComponent(
      JSON.stringify({
        v: s.v,
        loadout: s.loadout,
        defeated: s.defeated,
        badges: s.badges,
        hints: s.hints,
        visited: s.visited,
        t: s.t,
      }),
    );

  let value = compact(save);
  if (value.length <= SAVE_MAX_BYTES) return value;

  let trimmed: SaveFile = { ...save, hints: [] };
  value = compact(trimmed);
  while (value.length > SAVE_MAX_BYTES && trimmed.defeated.length > 0) {
    trimmed = { ...trimmed, defeated: trimmed.defeated.slice(1) };
    value = compact(trimmed);
  }
  return value;
}

/** Drops ids the site no longer has (deleted skills/projects) — run after hydrating. */
export function sanitizeSave(
  save: SaveFile,
  known: { skillIds: Iterable<number>; projectIds: Iterable<number> },
): SaveFile {
  const skills = new Set(known.skillIds);
  const projects = new Set(known.projectIds);
  return {
    ...save,
    loadout: save.loadout.filter((skillId) => skills.has(skillId)).slice(0, LOADOUT_SIZE),
    defeated: save.defeated.filter((projectId) => projects.has(projectId)),
  };
}

export function hasVisited(save: Pick<SaveFile, "visited">, key: SectionKey): boolean {
  return (save.visited & CHAPTER_BIT[key]) !== 0;
}

export function withVisited(save: SaveFile, key: SectionKey): SaveFile {
  const visited = save.visited | CHAPTER_BIT[key];
  return visited === save.visited ? save : { ...save, visited };
}

/** Number of chapters ever visited. */
export function visitedCount(visited: number): number {
  let count = 0;
  for (let mask = visited; mask; mask &= mask - 1) count++;
  return count;
}

// ── Cookie strings (pure, so they are testable) ─────────────────────────

/** `Set-Cookie`-style string for document.cookie. */
export function buildSaveCookie(value: string, options: { secure: boolean }): string {
  return [
    `${SAVE_COOKIE}=${value}`,
    `Max-Age=${SAVE_MAX_AGE}`,
    "Path=/",
    "SameSite=Lax",
    ...(options.secure ? ["Secure"] : []),
  ].join("; ");
}

export function buildClearCookie(options: { secure: boolean }): string {
  return [
    `${SAVE_COOKIE}=`,
    "Max-Age=0",
    "Path=/",
    "SameSite=Lax",
    ...(options.secure ? ["Secure"] : []),
  ].join("; ");
}

/** Value of one cookie from a `document.cookie` string, or null. */
export function readCookieValue(cookieHeader: string, name: string = SAVE_COOKIE): string | null {
  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return null;
}

// ── Browser glue (the only place that touches document.cookie) ──────────

const isBrowser = () => typeof document !== "undefined";
const secureContext = () => isBrowser() && window.location.protocol === "https:";

/** Reads the save from the browser, or null (no cookie, corrupt, unknown version, SSR). */
export function readSaveCookie(): SaveFile | null {
  if (!isBrowser()) return null;
  try {
    return parseSave(readCookieValue(document.cookie));
  } catch {
    return null;
  }
}

/**
 * Writes the save and renews its 7 days. Returns false when the browser refused the cookie
 * (blocked cookies): the game keeps working from memory for this session (spec §5.2 fallback).
 */
export function writeSaveCookie(save: SaveFile): boolean {
  if (!isBrowser()) return false;
  try {
    const value = serializeSave(save);
    document.cookie = buildSaveCookie(value, { secure: secureContext() });
    return readCookieValue(document.cookie) === value;
  } catch {
    return false;
  }
}

export function clearSaveCookie(): void {
  if (!isBrowser()) return;
  try {
    document.cookie = buildClearCookie({ secure: secureContext() });
  } catch {
    // Cookies blocked: nothing stored, nothing to clear.
  }
}
