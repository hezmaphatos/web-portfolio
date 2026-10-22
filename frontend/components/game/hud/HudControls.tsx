"use client";

import { CircleQuestionMark, Feather, Medal, Volume2, VolumeX } from "lucide-react";
import { useEffect } from "react";

import { BOSS_HINT_KEY } from "@/lib/hints";
import { unlockAudio } from "@/lib/sound";
import { useGameStore, useHintStore, useHudStore, useLiteMode, usePrefsStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/*
 * The HUD's right-hand controls (spec §5). Every one keeps the same box in every state
 * (an on/off "LED" instead of a changing label), so toggling never shifts its neighbours.
 */

type ToggleProps = { className?: string; labelClassName?: string };

function Led({ on }: { on: boolean }) {
  return <span aria-hidden="true" className={cn("hk-hud-led", on && "is-on")} />;
}

/** Sound on/off. Off by default (site.sound_default); the effects themselves arrive in phase 7. */
export function SoundToggle({
  soundDefault,
  className,
  labelClassName,
}: ToggleProps & { soundDefault: boolean }) {
  const stored = usePrefsStore((state) => state.sound);
  const setSound = usePrefsStore((state) => state.setSound);
  const on = stored ?? soundDefault;
  const Icon = on ? Volume2 : VolumeX;

  return (
    <button
      type="button"
      className={cn("hk-hud-btn", className)}
      aria-pressed={on}
      onClick={() => {
        if (!on) unlockAudio(); // a click is a user gesture: the AudioContext may start now
        setSound(!on);
      }}
    >
      <Icon aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
      <span className={labelClassName}>Sound</span>
      <Led on={on} />
    </button>
  );
}

/** Lite mode on/off (spec §5). The first click overrides "auto" (reduced motion / Save-Data). */
export function LiteToggle({ className, labelClassName }: ToggleProps) {
  const lite = useLiteMode();
  const setLite = usePrefsStore((state) => state.setLite);

  return (
    <button
      type="button"
      className={cn("hk-hud-btn", className)}
      aria-pressed={lite}
      title="Lite mode: no motion effects"
      onClick={() => setLite(lite ? "off" : "on")}
    >
      <Feather aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
      <span className={labelClassName}>
        Lite<span className="sr-only"> mode</span>
      </span>
      <Led on={lite} />
    </button>
  );
}

/**
 * Unlocked badge count. Read-only until the Badges drawer exists (phase 7): a status chip,
 * not a button that does nothing.
 */
export function BadgeCount({ className }: { className?: string }) {
  const count = useGameStore((state) => (state.hydrated ? state.badges.length : 0));
  return (
    <p className={cn("hk-hud-chip", className)} title="Badges unlocked">
      <Medal aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
      <span className="sr-only">Badges unlocked: </span>
      <span className="hk-mono min-w-[2ch] text-center">{count}</span>
    </p>
  );
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/**
 * Help (?): re-opens the hint of the stage on screen (spec §5.3). On pages without chapters
 * (a Project Stage) it falls back to the boss hint once that stage registered it.
 * Also bound to the "?" key (the splash tip says so).
 */
export function HelpButton({ onHome, className }: { onHome: boolean; className?: string }) {
  const activeChapter = useHudStore((state) => state.activeChapter);
  const texts = useHintStore((state) => state.texts);
  const key =
    activeChapter && texts[activeChapter]
      ? activeChapter
      : !onHome && texts[BOSS_HINT_KEY]
        ? BOSS_HINT_KEY
        : null;

  useEffect(() => {
    if (!key) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "?" || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTyping(event.target) || useHudStore.getState().boot !== "done") return;
      const hints = useHintStore.getState();
      hints.show({ key, text: hints.texts[key] ?? "", manual: true });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [key]);

  return (
    <button
      type="button"
      className={cn("hk-hud-btn", className)}
      // aria-disabled (not disabled): stays in the tab order and keeps its size.
      aria-disabled={key ? undefined : true}
      aria-keyshortcuts="?"
      title={key ? "Show the hint for this stage (?)" : "No hint here"}
      onClick={() => {
        if (!key) return;
        const hints = useHintStore.getState();
        hints.show({ key, text: hints.texts[key] ?? "", manual: true });
      }}
    >
      <CircleQuestionMark aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
      <span className="sr-only">Help</span>
    </button>
  );
}
