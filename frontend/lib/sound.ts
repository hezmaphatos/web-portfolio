"use client";

import { usePrefsStore } from "@/lib/store";

/**
 * Sound effects (spec §5 "Sound"): tiny Web Audio synths — oscillators + gain envelopes, no audio
 * files (no licences, nothing to download). Default OFF.
 *
 * Rules this module enforces for every caller:
 * - Silent unless the visitor's preference says on (`usePrefsStore.sound`, null → the site default
 *   from site_settings, set once by <SoundHost>), and silent until the preferences are read.
 * - Never before a user gesture: the AudioContext is only created after the page had one
 *   (`navigator.userActivation`, or a gesture seen by unlockAudio()). With sound off it is never
 *   created at all, and switching sound off suspends it (no idle audio stream).
 *
 *   import { sfx } from "@/lib/sound";
 *   sfx.hit(42);  sfx.badge();  sfx.stageClear();
 */

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

let context: AudioContext | null = null;
let bus: GainNode | null = null;
let siteDefault = false;
let gestureSeen = false;
let voices = 0;

/** Overall volume (the synths are square waves: keep them gentle). */
const MASTER_GAIN = 0.5;
/** Simultaneous oscillators at most; extra notes are dropped (Auto-fire bursts). */
const MAX_VOICES = 24;
/** A note asked for while the context was waking up still plays if it woke within this. */
const RESUME_GRACE_MS = 200;

/** site_settings.sound_default, used while the visitor has not chosen (pref = null). */
export function setSoundDefault(on: boolean): void {
  siteDefault = on;
}

/** Sound is on: the visitor's choice, else the site default. Off until preferences are read. */
export function isSoundOn(): boolean {
  const prefs = usePrefsStore.getState();
  if (!prefs.hydrated) return false;
  return prefs.sound ?? siteDefault;
}

function hadGesture(): boolean {
  if (gestureSeen) return true;
  if (typeof navigator === "undefined" || !("userActivation" in navigator)) return false;
  return navigator.userActivation.hasBeenActive;
}

function createContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    return null;
  }
  return context;
}

/** The shared AudioContext if one exists (never creates one). */
export function getAudioContext(): AudioContext | null {
  return context;
}

/**
 * Call from inside a user-gesture handler (click, keydown, touchend): browsers only let an
 * AudioContext start there. Records the gesture; with sound on it creates/resumes the context.
 * Safe to call repeatedly (PRESS START, the Sound toggle and <SoundHost>'s listeners do).
 */
export function unlockAudio(): void {
  gestureSeen = true;
  if (!isSoundOn()) return;
  const audio = context ?? createContext();
  if (audio && audio.state === "suspended") audio.resume().catch(() => undefined);
}

/** Sound switched off: let the context sleep (the browser can close the audio stream). */
export function suspendAudio(): void {
  if (context && context.state === "running") context.suspend().catch(() => undefined);
}

/**
 * Listens for gestures on the whole page (capture, passive) so a context exists — and is running
 * — before the first effect needs it, also for effects that fire after an await (STAGE CLEAR).
 * Returns the cleanup. Mounted once by <SoundHost>.
 */
export function installAudioUnlock(): () => void {
  const events = ["pointerdown", "keydown", "touchend"] as const;
  const onGesture = () => unlockAudio();
  events.forEach((type) =>
    window.addEventListener(type, onGesture, { capture: true, passive: true }),
  );
  const stopWatching = usePrefsStore.subscribe((state, prev) => {
    if (state.sound !== prev.sound && !isSoundOn()) suspendAudio();
  });
  return () => {
    events.forEach((type) => window.removeEventListener(type, onGesture, { capture: true }));
    stopWatching();
  };
}

// ── Synth ────────────────────────────────────────────────────────────────

type Tone = Readonly<{
  /** Start frequency (Hz). */
  f: number;
  /** End frequency: an exponential slide over the note. */
  to?: number;
  /** Start offset (s) from "now". */
  at?: number;
  /** Length (s). */
  dur: number;
  type?: OscillatorType;
  /** Peak gain before the master (0–1). */
  vol?: number;
}>;

type Output = { audio: AudioContext; out: GainNode };

function output(): Output | null {
  if (!isSoundOn() || !hadGesture()) return null;
  const audio = context ?? createContext();
  if (!audio || audio.state === "closed") return null;
  if (!bus) {
    const gain = audio.createGain();
    gain.gain.value = MASTER_GAIN;
    // Square waves buzz: a soft low-pass takes the edge off without dulling the "bip".
    const filter = audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 5200;
    gain.connect(filter);
    filter.connect(audio.destination);
    bus = gain;
  }
  return { audio, out: bus };
}

function voice({ audio, out }: Output, t0: number, tone: Tone): void {
  if (voices >= MAX_VOICES) return;
  const start = t0 + (tone.at ?? 0);
  const end = start + tone.dur;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = tone.type ?? "square";
  osc.frequency.setValueAtTime(tone.f, start);
  if (tone.to) osc.frequency.exponentialRampToValueAtTime(tone.to, end);
  // Exponential envelope: a click-free 5–12 ms attack, then a natural decay to silence.
  const peak = tone.vol ?? 0.2;
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.012, tone.dur * 0.25));
  amp.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(amp);
  amp.connect(out);
  osc.start(start);
  osc.stop(end + 0.03);
  voices += 1;
  osc.onended = () => {
    voices -= 1;
    osc.disconnect();
    amp.disconnect();
  };
}

/** Plays a little score now. A context that is still waking up gets a short grace period. */
function play(score: readonly Tone[]): void {
  const target = output();
  if (!target) return;
  const run = () => {
    const t0 = target.audio.currentTime + 0.01;
    score.forEach((tone) => voice(target, t0, tone));
  };
  if (target.audio.state === "running") {
    run();
    return;
  }
  // Suspended (some browsers start a new context suspended): never queue stale notes.
  const asked = performance.now();
  target.audio.resume().then(
    () => {
      if (performance.now() - asked <= RESUME_GRACE_MS && isSoundOn()) run();
    },
    () => undefined,
  );
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

let lastClick = 0;

/** The sound effects. Every one is a no-op while sound is off or before a user gesture. */
export const sfx = {
  /** UI click: a short, quiet tick (buttons, links, toggles). */
  click(): void {
    const now = performance.now();
    if (now - lastClick < 45) return;
    lastClick = now;
    play([{ f: 1400, to: 900, dur: 0.035, vol: 0.07 }]);
  },

  /** Badge unlocked: a rising "item get" arpeggio (E–G–B–E). */
  badge(): void {
    play([
      { f: 659.25, dur: 0.09, vol: 0.12 },
      { f: 783.99, at: 0.075, dur: 0.09, vol: 0.12 },
      { f: 987.77, at: 0.15, dur: 0.09, vol: 0.12 },
      { f: 1318.51, at: 0.225, dur: 0.34, vol: 0.12 },
      { f: 329.63, at: 0.225, dur: 0.34, type: "triangle", vol: 0.18 },
    ]);
  },

  /** STAGE CLEAR jingle: C–E–G–C run, then a held major chord over a bass note. */
  stageClear(): void {
    play([
      { f: 523.25, dur: 0.11, vol: 0.11 },
      { f: 659.25, at: 0.1, dur: 0.11, vol: 0.11 },
      { f: 783.99, at: 0.2, dur: 0.11, vol: 0.11 },
      { f: 1046.5, at: 0.3, dur: 0.16, vol: 0.11 },
      { f: 783.99, at: 0.48, dur: 0.6, vol: 0.07 },
      { f: 1046.5, at: 0.48, dur: 0.6, vol: 0.07 },
      { f: 1318.51, at: 0.48, dur: 0.6, vol: 0.07 },
      { f: 261.63, at: 0.48, dur: 0.6, type: "triangle", vol: 0.2 },
    ]);
  },

  /**
   * A battle hit: a falling "bip" whose pitch follows the damage (25 dmg ≈ 1 kHz, 70 dmg ≈ 490 Hz:
   * heavier hits sound lower and longer); heavy ones get a triangle thump under it.
   * `delay` (s) staggers several hits landing in the same frame.
   */
  hit(damage: number, delay = 0): void {
    const weight = clamp01((damage - 25) / 45);
    const f = 1046 - weight * 560;
    const dur = 0.07 + weight * 0.06;
    const score: Tone[] = [{ f, to: f * 0.55, at: delay, dur, vol: 0.11 }];
    if (weight > 0.45) {
      score.push({ f: f / 2, to: f / 5, at: delay, dur: dur + 0.05, type: "triangle", vol: 0.2 });
    }
    play(score);
  },

  /** Boss defeated: a falling crash, then a bright victory chime (G–C–E–G + held chord). */
  bossDefeat(): void {
    play([
      { f: 520, to: 70, dur: 0.42, type: "sawtooth", vol: 0.06 },
      { f: 783.99, at: 0.36, dur: 0.12, type: "triangle", vol: 0.22 },
      { f: 1046.5, at: 0.44, dur: 0.12, type: "triangle", vol: 0.22 },
      { f: 1318.51, at: 0.52, dur: 0.12, type: "triangle", vol: 0.22 },
      { f: 1567.98, at: 0.6, dur: 0.16, type: "triangle", vol: 0.22 },
      { f: 1046.5, at: 0.74, dur: 0.7, vol: 0.06 },
      { f: 1318.51, at: 0.74, dur: 0.7, vol: 0.06 },
      { f: 1567.98, at: 0.74, dur: 0.7, vol: 0.06 },
    ]);
  },

  /** "Play again" rewind: tape whirring up to speed, then the deck's clunk (≈ 1.1 s). */
  rewind(): void {
    play([
      { f: 160, to: 1300, dur: 0.95, type: "sawtooth", vol: 0.035 },
      { f: 80, to: 650, dur: 0.95, vol: 0.02 },
      { f: 220, to: 90, at: 1.0, dur: 0.08, vol: 0.1 },
    ]);
  },
};
