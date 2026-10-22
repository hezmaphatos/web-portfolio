/**
 * Stage hints & tutorials (spec §5.3). Chapter hint texts come from the API (sections.hint,
 * editable in the admin); Project Stages use the boss hint constants below.
 * A hint shows once per stage — "seen" keys are kept in the save cookie (`hints`).
 */

/** Show the hint this long after the chapter is ≥ 40 % visible. */
export const HINT_DELAY_MS = 600;
/** Auto-close after this long (unless the visitor opened it with Help / "?"). */
export const HINT_AUTO_CLOSE_MS = 7000;
/** Visible fraction of a chapter that counts as "entered". */
export const HINT_VISIBLE_RATIO = 0.4;

/** Hint key of a Project Stage. */
export const BOSS_HINT_KEY = "boss";
export const BOSS_HINT =
  "Every project is a boss. Press FIGHT! and use your 4 skills to unlock the full tech stack and links.";

/** First Arena visit: 3 coach marks, in order, each advanced by doing the action. */
export const BOSS_TUTORIAL_KEY = "boss-tutorial";
export const BOSS_TUTORIAL = [
  { target: "loadout", text: "Pick up to 4 skills." },
  { target: "slots", text: "Tap a skill or press 1–4." },
  { target: "boss", text: "Defeat the boss to unlock its full tech stack and link." },
] as const;

/** True when the hint for `key` should open by itself (never seen before). */
export function shouldAutoShowHint(seen: readonly string[], key: string): boolean {
  return !seen.includes(key);
}
