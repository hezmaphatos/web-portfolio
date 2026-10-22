/**
 * Pre-paint head script (spec §5.1 point 8). Runs synchronously while the browser parses <head>,
 * i.e. before the first paint and long before React hydrates, and writes two attributes on <html>:
 *
 * - `data-lite="true|false"`: Lite mode (stored preference, else prefers-reduced-motion or
 *   Save-Data), so Lite CSS applies from the first frame. <StoreHydrator> keeps it in sync later.
 * - `data-boot="play|skip"`: whether the boot screen (splash) plays. CSS shows the server-rendered
 *   overlay only under `play`, so there is never a flash of the Hero before the overlay, and with
 *   JavaScript off (no script → no attribute) the overlay simply never shows.
 *
 * No imports: the function is serialised with `.toString()` into an inline <script> (see
 * app/layout.tsx), and BootScreen calls it again in the browser when React's dev-only Strict Mode
 * remount wiped the attributes. Keep it plain JavaScript in TypeScript clothes.
 * This module has no "use client": the server root layout imports it for the string.
 */

/** sessionStorage flag: the splash was seen (or skipped) in this tab session. */
export const BOOT_SEEN_KEY = "boot_seen";

/**
 * Must equal PREFS_KEY in lib/store.ts. Duplicated on purpose: lib/store.ts is a "use client"
 * module, and a server component importing a value from it gets a client reference, not the string.
 */
export const PREPAINT_PREFS_KEY = "hackker_prefs";

export function prepaint(prefsKey: string, seenKey: string): void {
  const root = document.documentElement;
  let reduce = false;
  try {
    reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    // very old browser: assume full motion
  }

  // zustand persist stores {"state":{"lite":"auto"|"on"|"off",…},"version":0}.
  let pref = "auto";
  try {
    const raw = window.localStorage.getItem(prefsKey);
    const stored = raw ? JSON.parse(raw) : null;
    const storedLite = stored && stored.state ? stored.state.lite : null;
    if (storedLite === "on" || storedLite === "off") pref = storedLite;
  } catch {
    // storage blocked or corrupt JSON: follow the system settings
  }

  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const saveData = !!(connection && connection.saveData);
  const lite = pref === "on" || (pref === "auto" && (reduce || saveData));

  let seen = false;
  try {
    seen = window.sessionStorage.getItem(seenKey) === "1";
  } catch {
    // sessionStorage blocked: the splash plays (it cannot remember being seen)
  }

  root.setAttribute("data-lite", lite ? "true" : "false");
  root.setAttribute("data-boot", seen || reduce || lite ? "skip" : "play");
}

/** The inline <script> body for app/layout.tsx. */
export const PREPAINT_SCRIPT = `(${prepaint.toString()})(${JSON.stringify(PREPAINT_PREFS_KEY)},${JSON.stringify(BOOT_SEEN_KEY)})`;
