/**
 * Konami code matcher (spec §5 badge "Konami" → Hackker Mode). Pure TypeScript, no DOM: the
 * listener in components/game/konami/ turns key presses / touch gestures into tokens and feeds
 * them here.
 *
 * Matching keeps the last N tokens and checks whether they END with the sequence, so a stray
 * extra press never loses progress that is still valid: "↑ ↑ ↑ ↓ ↓ …" still matches, because the
 * last two ↑ are a valid start (a naive "reset to 0 on mismatch" matcher gets this wrong).
 */

export type KonamiToken = "up" | "down" | "left" | "right" | "b" | "a" | "tap";

/** ↑ ↑ ↓ ↓ ← → ← → B A */
export const KONAMI_KEYS: readonly KonamiToken[] = [
  "up",
  "up",
  "down",
  "down",
  "left",
  "right",
  "left",
  "right",
  "b",
  "a",
];

/** Touch version: swipe ↑ ↑ ↓ ↓ ← → ← →, then tap twice (B, A). */
export const KONAMI_TOUCH: readonly KonamiToken[] = [
  "up",
  "up",
  "down",
  "down",
  "left",
  "right",
  "left",
  "right",
  "tap",
  "tap",
];

/** A pause longer than this between two inputs starts over (keeps accidental matches away). */
export const KONAMI_MAX_GAP_MS = 3000;

const KEY_TOKENS: Record<string, KonamiToken> = {
  arrowup: "up",
  arrowdown: "down",
  arrowleft: "left",
  arrowright: "right",
  b: "b",
  a: "a",
};

/** KeyboardEvent.key → token (case-insensitive: Caps Lock / Shift still count). */
export function keyToken(key: string): KonamiToken | null {
  return KEY_TOKENS[key.toLowerCase()] ?? null;
}

export type SwipeInput = { dx: number; dy: number; ms: number };

/** Minimum travel of a swipe and maximum wobble of a tap, in CSS px. */
export const SWIPE_MIN_PX = 30;
export const TAP_MAX_PX = 12;

/**
 * One finished touch (start → end delta and duration) → token. A swipe must clearly favour one
 * axis (1.5×) so diagonal scroll flicks don't count; anything ambiguous returns null.
 */
export function touchToken({ dx, dy, ms }: SwipeInput): KonamiToken | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax <= TAP_MAX_PX && ay <= TAP_MAX_PX) return ms <= 400 ? "tap" : null;
  if (ms > 1000 || Math.max(ax, ay) < SWIPE_MIN_PX) return null;
  if (ay >= ax * 1.5) return dy < 0 ? "up" : "down";
  if (ax >= ay * 1.5) return dx < 0 ? "left" : "right";
  return null;
}

export type KonamiState = Readonly<{ buffer: readonly KonamiToken[]; at: number }>;

export const KONAMI_START: KonamiState = { buffer: [], at: -Infinity };

/**
 * Adds one token at time `now` (ms). Returns the next state and whether the sequence was just
 * completed; a completed match clears the buffer, so entering the code again toggles again.
 */
export function stepKonami(
  state: KonamiState,
  token: KonamiToken,
  now: number,
  sequence: readonly KonamiToken[] = KONAMI_KEYS,
  maxGapMs: number = KONAMI_MAX_GAP_MS,
): { state: KonamiState; matched: boolean } {
  const kept = now - state.at > maxGapMs ? [] : state.buffer;
  const buffer = [...kept, token].slice(-sequence.length);
  const matched =
    buffer.length === sequence.length && buffer.every((item, index) => item === sequence[index]);
  return { state: { buffer: matched ? [] : buffer, at: now }, matched };
}

/** How many tokens of the sequence the buffer currently ends with (0 … length − 1). */
export function konamiProgress(
  state: KonamiState,
  sequence: readonly KonamiToken[] = KONAMI_KEYS,
): number {
  const { buffer } = state;
  for (let length = Math.min(buffer.length, sequence.length - 1); length > 0; length--) {
    const tail = buffer.slice(buffer.length - length);
    if (tail.every((item, index) => item === sequence[index])) return length;
  }
  return 0;
}
