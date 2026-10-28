"use client";

import type { SectionKey } from "@/lib/types";

import { BadgeDrawer } from "./BadgeDrawer";
import { BadgeWatcher } from "./BadgeWatcher";

/**
 * The badge layer of the public site, mounted once in the (site) layout: the watcher (new-unlock
 * toasts + derived badges) and the drawer the HUD's Badges button opens.
 * `chapterKeys`: the chapters Home shows (Explorer needs all of them).
 */
export function BadgeLayer({ chapterKeys }: { chapterKeys: SectionKey[] }) {
  return (
    <>
      <BadgeWatcher chapterKeys={chapterKeys} />
      <BadgeDrawer chapterKeys={chapterKeys} />
    </>
  );
}
