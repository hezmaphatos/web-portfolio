"use client";

import { useGameStore, useHudStore } from "@/lib/store";
import { SECTION_KEYS, type Section } from "@/lib/types";
import { pad2 } from "@/lib/utils";

import { BadgeCount, HelpButton, LiteToggle, SoundToggle } from "./HudControls";
import { HudMenu, type MenuChapter } from "./HudMenu";
import { XpBar } from "./XpBar";

type Props = {
  nickname: string;
  soundDefault: boolean;
  sections: Section[];
  /** Ids of the projects that are bosses (boss_enabled). */
  bossIds: number[];
  /** The page has Home chapters (from useChapterSections). */
  onHome: boolean;
  /** location.pathname ("" before mount). */
  path: string;
};

/**
 * The HUD (spec §5): small, calm, always there — never the "one prominent motion moment".
 * Left: PLAYER · LV · BOSS. Centre: XP bar (scroll progress). Right: Menu, Sound, Lite, Badges,
 * Help. Phones keep the essentials in the bar and move Sound/Lite into the menu panel.
 * Paper chips with ink borders: readable over every chapter background (paper, lime, ink).
 */
export function Hud({ nickname, soundDefault, sections, bossIds, onHome, path }: Props) {
  const activeChapter = useHudStore((state) => state.activeChapter);
  // Defeated bosses that are still bosses (a project whose boss was switched off after being
  // beaten no longer counts).
  const bossTotal = bossIds.length;
  const bosses = useGameStore((state) =>
    state.hydrated ? state.defeated.filter((id) => bossIds.includes(id)).length : 0,
  );

  // LV = chapter number (boot 0, hero 1 … contact 7). Project pages belong to LEVEL SELECT.
  const level = activeChapter
    ? SECTION_KEYS.indexOf(activeChapter)
    : !onHome && path.startsWith("/projects")
      ? SECTION_KEYS.indexOf("projects")
      : null;

  const chapters: MenuChapter[] = sections
    .filter((section) => section.key !== "boot")
    .map((section) => ({
      key: section.key,
      title: section.title,
      level: SECTION_KEYS.indexOf(section.key),
    }));

  return (
    // <header>: the HUD is the site banner landmark (its status cells were outside any landmark).
    <header data-hud className="hk-hud">
      <XpBar className="hk-xp hk-xp-line md:hidden" />
      <div className="hk-hud-row">
        <div className="hk-hud-status">
          <p className="hk-hud-cell max-[359px]:hidden">
            <span className="opacity-70 max-sm:hidden">Player:</span>
            <span className="max-w-[5.5rem] truncate sm:max-w-[9rem]">{nickname}</span>
          </p>
          <p className="hk-hud-cell">
            <span aria-hidden="true">LV</span>
            <span className="sr-only">Level</span>
            <span className="hk-mono">{level === null ? "--" : pad2(level)}</span>
          </p>
          <p className="hk-hud-cell">
            <span aria-hidden="true">Boss</span>
            <span className="sr-only">Bosses defeated</span>
            <span className="hk-mono">
              {bosses}
              <span aria-hidden="true">/</span>
              <span className="sr-only"> of </span>
              {bossTotal}
            </span>
          </p>
        </div>

        <XpBar className="hk-xp hk-xp-center max-md:hidden" />

        <div className="hk-hud-actions">
          <HudMenu chapters={chapters} onHome={onHome} path={path}>
            <div className="hk-hud-menu-settings md:hidden">
              <SoundToggle soundDefault={soundDefault} />
              <LiteToggle />
            </div>
          </HudMenu>
          <SoundToggle
            soundDefault={soundDefault}
            className="max-md:hidden"
            labelClassName="max-lg:sr-only"
          />
          <LiteToggle className="max-md:hidden" labelClassName="max-lg:sr-only" />
          <BadgeCount />
          <HelpButton onHome={onHome} />
        </div>
      </div>
    </header>
  );
}
