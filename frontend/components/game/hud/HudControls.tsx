"use client";

import { CircleQuestionMark, Feather, Medal, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef } from "react";

import { BADGE_DRAWER_ID } from "@/components/game/badges/BadgeDrawer";
import { openBadgeDrawer, useBadgeDrawer } from "@/components/game/badges/drawer";
import { BADGES, knownBadges } from "@/lib/badges";
import { MEDIA } from "@/lib/gsap";
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

/** Sound on/off (lib/sound.ts). Off by default (site.sound_default). */
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
        setSound(!on);
        // A click is a user gesture: with sound now on, the AudioContext may start (after the
        // switch, so unlockAudio() sees "on"); <SoundHost> then confirms with a click sound.
        if (!on) unlockAudio();
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

/** Lite mode or the OS asks for reduced motion (read at call time, outside React). */
const isStill = () =>
  document.documentElement.dataset.lite === "true" || window.matchMedia(MEDIA.reduce).matches;

/**
 * Badges: the unlocked count, and the button that opens the Badges drawer
 * (components/game/badges). Same box as before (a .hk-hud-btn), so the HUD keeps its layout down
 * to 320 px. A new badge makes it pop (WAAPI transform, not in Lite / reduced motion).
 * Without JavaScript the button is hidden (CSS) and an anchor opens the drawer with :target.
 */
export function BadgeCount({ className }: { className?: string }) {
  const count = useGameStore((state) => (state.hydrated ? knownBadges(state.badges).length : 0));
  const pulse = useBadgeDrawer((state) => state.pulse);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = button.current;
    if (!pulse || !el || isStill()) return;
    el.animate(
      [
        { transform: "scale(1) rotate(0deg)" },
        { transform: "scale(1.22) rotate(-6deg)", offset: 0.35 },
        { transform: "scale(1) rotate(0deg)" },
      ],
      { duration: 520, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
    );
  }, [pulse]);

  return (
    <>
      <button
        ref={button}
        type="button"
        className={cn("hk-hud-btn hk-badges-toggle", className)}
        aria-haspopup="dialog"
        aria-controls={BADGE_DRAWER_ID}
        title="Badges"
        onClick={(event) => openBadgeDrawer(event.currentTarget)}
      >
        <Medal aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
        <span className="sr-only">Badges: </span>
        <span className="hk-mono min-w-[2ch] text-center">{count}</span>
        <span className="sr-only"> of {BADGES.length} unlocked</span>
      </button>
      <a href={`#${BADGE_DRAWER_ID}`} className={cn("hk-hud-btn hk-badges-nojs", className)}>
        <Medal aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
        <span className="sr-only">Badges</span>
      </a>
    </>
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
