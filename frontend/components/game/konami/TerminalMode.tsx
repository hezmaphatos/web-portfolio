"use client";

import { useEffect, useLayoutEffect, useState } from "react";

import {
  KONAMI_KEYS,
  KONAMI_START,
  KONAMI_TOUCH,
  keyToken,
  stepKonami,
  touchToken,
  type KonamiState,
} from "@/lib/konami";
import { usePrefsStore } from "@/lib/store";

import { applyTheme, storedTerminalMode, toggleTerminalMode, useThemeFlash } from "./terminalTheme";

/** Typing in a field never counts (arrows move the caret, B/A are letters). */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

/**
 * The Konami code → Terminal Mode (spec §5), mounted once in <GameChrome>.
 *
 * - Keyboard: ↑ ↑ ↓ ↓ ← → ← → B A toggles the theme (lib/konami.ts does the matching).
 * - Touch: swipe ↑ ↑ ↓ ↓ ← → ← → anywhere, then tap twice. Passive listeners, so scrolling is
 *   untouched (vertical swipes simply scroll the page while they count).
 *
 * The key listener is a capture listener on window registered in a layout effect: this
 * component sits before <main> in the site layout, so it is registered before the Battle Arena's
 * capture listener (React runs layout effects in tree order) and runs first. When "A" completes
 * the code it calls preventDefault, and the Arena / Training Dummy, which skip handled events,
 * don't toggle Auto-fire on that press.
 *
 * Also renders the CRT flash played on every switch, and the scanline layer that CSS only shows
 * under html[data-theme="terminal"] (so it is right from the first paint).
 */
export function TerminalMode() {
  const flash = useThemeFlash((state) => state.count);
  /** The last flash that finished; a newer count means one is playing. */
  const [done, setDone] = useState(0);

  // Dev only: React's Strict Mode remount resets <html> to the attributes it renders, wiping the
  // one the pre-paint script set. Put it back before paint until the stored prefs take over.
  useLayoutEffect(() => {
    if (!usePrefsStore.getState().hydrated && storedTerminalMode()) applyTheme(true);
  }, []);

  useLayoutEffect(() => {
    let keys: KonamiState = KONAMI_START;

    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditable(event.target)) return;
      const token = keyToken(event.key);
      if (!token) return;
      const result = stepKonami(keys, token, event.timeStamp, KONAMI_KEYS);
      keys = result.state;
      if (!result.matched) return;
      // The final "A" is ours: the Arena / Training Dummy must not toggle Auto-fire with it.
      event.preventDefault();
      toggleTerminalMode();
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  useEffect(() => {
    let gestures: KonamiState = KONAMI_START;
    let start: { x: number; y: number; t: number } | null = null;

    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      start =
        event.touches.length === 1 && touch
          ? { x: touch.clientX, y: touch.clientY, t: event.timeStamp }
          : null; // pinch / multi-finger: not a gesture
    };
    const onEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!start || !touch || event.touches.length > 0) return;
      const token = touchToken({
        dx: touch.clientX - start.x,
        dy: touch.clientY - start.y,
        ms: event.timeStamp - start.t,
      });
      start = null;
      if (!token) return;
      const result = stepKonami(gestures, token, event.timeStamp, KONAMI_TOUCH);
      gestures = result.state;
      if (result.matched) toggleTerminalMode();
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, []);

  return (
    <>
      <div className="hk-scanlines" aria-hidden="true" />
      {/* A new switch (re)starts the flash: the key remounts the overlay and its CSS animation. */}
      {flash > done ? (
        <div
          key={flash}
          className="hk-crt-flash"
          aria-hidden="true"
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) setDone(flash);
          }}
        >
          <span className="hk-crt-flash-band" />
        </div>
      ) : null}
    </>
  );
}
