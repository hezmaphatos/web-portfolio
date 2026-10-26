"use client";

import { useEffect } from "react";

import { AvatarPath } from "@/components/game/AvatarPath";
import { ChapterTracker } from "@/components/game/ChapterTracker";
import { CustomCursor } from "@/components/game/cursor/CustomCursor";
import { Hud } from "@/components/game/hud/Hud";
import { useChapterSections } from "@/components/game/useChapterSections";
import { useHudStore } from "@/lib/store";
import type { Section, Site } from "@/lib/types";

type Props = { site: Site; sections: Section[]; bossIds: number[] };

/**
 * The persistent game layer of the public site (mounted once in the (site) layout, so it
 * survives client navigations): HUD, chapter tracker and the avatar path. The splash itself is
 * part of Home (components/game/splash/BootScreen.tsx) because it only ever plays there.
 */
export function GameChrome({ site, sections, bossIds }: Props) {
  const { sections: chapters, path } = useChapterSections();

  // A session that starts on another page (/projects/…) has no boot screen: nothing to wait for.
  // Passive effects run after BootScreen's layout effect, so a splash in the DOM has already
  // decided by now (and set boot itself).
  useEffect(() => {
    const hud = useHudStore.getState();
    if (hud.boot === "pending" && !document.querySelector("[data-boot-screen]")) {
      document.documentElement.dataset.boot = "done";
      hud.setBoot("done");
    }
  }, []);

  return (
    <>
      <Hud
        nickname={site.nickname}
        soundDefault={site.sound_default}
        sections={sections}
        bossIds={bossIds}
        onHome={chapters.length > 0}
        path={path}
      />
      <ChapterTracker
        sections={chapters}
        hasBoot={sections.some((section) => section.key === "boot")}
      />
      <AvatarPath sections={chapters} />
      <CustomCursor />
    </>
  );
}
