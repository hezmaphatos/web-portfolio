/**
 * Web Audio plumbing (spec §5 "Sound"). Phase 4 only needs the shared context and the unlock:
 * browsers keep an AudioContext "suspended" until the page gets a user gesture, so PRESS START
 * (and the Sound toggle) call unlockAudio() from their click/keydown handler. The oscillator
 * sound effects themselves (click, badge, stage clear) arrive in phase 7. No audio files, ever.
 */

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

let context: AudioContext | null = null;

/** The one shared AudioContext, created on first use. Null on the server or without Web Audio. */
export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (context) return context;
  const Ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    return null;
  }
  return context;
}

/**
 * Creates/resumes the context. Must run inside a user gesture handler (click, keydown, touchend),
 * otherwise the browser leaves it suspended (and logs a warning). Safe to call repeatedly.
 */
export function unlockAudio(): void {
  const audio = getAudioContext();
  if (audio && audio.state === "suspended") {
    audio.resume().catch(() => undefined);
  }
}
