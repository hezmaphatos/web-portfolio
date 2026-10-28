"use client";

import { useEffect } from "react";

import { installAudioUnlock, setSoundDefault, sfx } from "@/lib/sound";

/** What counts as a "click" for the UI click sound. */
const CLICKABLE =
  "button, a[href], summary, [role='button'], [role='tab'], [role='switch'], " +
  "input[type='checkbox'], input[type='radio']";

/**
 * Sound glue for the public site (spec §5 "Sound"), mounted once in the (site) layout; renders
 * nothing. Hands the site default (site_settings.sound_default) to lib/sound, wakes the
 * AudioContext on user gestures (only when sound is on) and plays the soft UI click for every
 * activated button / link — one delegated listener instead of a call in every component.
 * Elements with their own sound opt out: `[data-sfx="off"]`, and the Arena's skill slots
 * (`[data-fire]`, they play the hit). Admin pages never mount this.
 */
export function SoundHost({ soundDefault }: { soundDefault: boolean }) {
  useEffect(() => {
    setSoundDefault(soundDefault);
  }, [soundDefault]);

  useEffect(() => {
    const stopUnlock = installAudioUnlock();
    // Bubble phase on document: runs after React's handlers, so the Sound toggle switching
    // itself on is already "on" here (and confirms with a click) while switching off is silent.
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest(CLICKABLE) : null;
      if (!target || target.closest("[data-sfx='off'], [data-fire]")) return;
      if (target.matches(":disabled, [aria-disabled='true']")) return;
      sfx.click();
    };
    document.addEventListener("click", onClick);
    return () => {
      stopUnlock();
      document.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}
