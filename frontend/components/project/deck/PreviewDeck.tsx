"use client";

import { Clapperboard, Globe, Images, Lock } from "lucide-react";
import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { cn } from "@/lib/utils";
import type { GalleryImage, Media as MediaObject } from "@/lib/types";

import { Gallery } from "../Gallery";
import { useBossLock } from "../useBossLock";
import { VideoEmbed } from "../VideoEmbed";
import { LivePreview } from "./LivePreview";
import { deckTabs, type DeckTab as TabKey } from "./media";

type Props = {
  projectId: number;
  slug: string;
  title: string;
  accent: string;
  bossEnabled: boolean;
  gallery: GalleryImage[];
  videoUrl: string | null;
  video: MediaObject | null;
  cover: MediaObject | null;
  liveUrl: string | null;
  allowIframe: boolean;
  /** Host for the desktop frame's address bar. */
  address: string;
  /** Unique per stage (page / modal can both be in the DOM): prefixes the tab ids. */
  idPrefix: string;
};

const TAB_META: Record<TabKey, { label: string; icon: typeof Images }> = {
  screenshots: { label: "Screenshots", icon: Images },
  video: { label: "Video", icon: Clapperboard },
  live: { label: "Live", icon: Globe },
};

/* Without JS the tabs can't switch: every panel is shown in order and the tab row hidden. */
const NO_JS_DECK =
  "[data-deck-tablist],[data-js-only]{display:none!important}" +
  "[data-deck-panel]{display:block!important}" +
  "[data-deck-panel]+[data-deck-panel]{margin-top:3rem}" +
  ".hk-carousel-track{transform:none!important;flex-direction:column;gap:2.5rem}";

/**
 * The Preview Deck (spec §6.3 item 3): Screenshots / Video / Live as an ARIA tab set — one tab
 * stop, ← / → (and Home / End) move between tabs and select them, the panel follows.
 * Screenshots and Video are always open; Live is the boss reward (locked until defeated, see
 * <LivePreview>). Leaving the Video tab resets its player (remount), so nothing keeps playing
 * in a hidden panel.
 */
export function PreviewDeck({
  projectId,
  slug,
  title,
  accent,
  bossEnabled,
  gallery,
  videoUrl,
  video,
  cover,
  liveUrl,
  allowIframe,
  address,
  idPrefix,
}: Props) {
  const tabs = deckTabs({ gallery, video_url: videoUrl, video, live_url: liveUrl });
  const [active, setActive] = useState<TabKey>(tabs[0] ?? "screenshots");
  const [videoEpoch, setVideoEpoch] = useState(0);
  const { locked } = useBossLock(projectId, bossEnabled);
  const tabRefs = useRef<Partial<Record<TabKey, HTMLButtonElement | null>>>({});

  if (tabs.length === 0) return null;

  const select = (tab: TabKey, focus = false) => {
    if (active === "video" && tab !== "video") setVideoEpoch((n) => n + 1);
    setActive(tab);
    if (focus) tabRefs.current[tab]?.focus();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const at = tabs.indexOf(active);
    const next =
      event.key === "ArrowRight"
        ? (at + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (at - 1 + tabs.length) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    select(tabs[next], true);
  };

  const tabId = (tab: TabKey) => `${idPrefix}-tab-${tab}`;
  const panelId = (tab: TabKey) => `${idPrefix}-panel-${tab}`;
  const poster = cover?.mime.startsWith("image/") ? cover : (gallery[0] ?? null);

  return (
    <div className="flex flex-col gap-8" data-deck>
      <noscript>
        <style>{NO_JS_DECK}</style>
      </noscript>

      {tabs.length > 1 ? (
        <div
          role="tablist"
          aria-label="Preview"
          className="hk-deck-tabs"
          onKeyDown={onKeyDown}
          data-deck-tablist
        >
          {tabs.map((tab) => {
            const { label, icon: Icon } = TAB_META[tab];
            const selected = tab === active;
            const lockedTab = tab === "live" && locked;
            return (
              <button
                key={tab}
                ref={(element) => {
                  tabRefs.current[tab] = element;
                }}
                type="button"
                role="tab"
                id={tabId(tab)}
                aria-selected={selected}
                aria-controls={panelId(tab)}
                tabIndex={selected ? 0 : -1}
                className="hk-deck-tab hk-pixel"
                onClick={() => select(tab)}
              >
                {lockedTab ? (
                  <Lock aria-hidden="true" className="size-4" strokeWidth={2.5} />
                ) : (
                  <Icon aria-hidden="true" className="size-4" strokeWidth={2.5} />
                )}
                {label}
                {tab === "screenshots" ? (
                  <span className="hk-mono opacity-70">{gallery.length}</span>
                ) : null}
                {lockedTab ? <span className="sr-only"> (locked)</span> : null}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="hk-pixel text-ink-2 text-xs" id={tabId(tabs[0])}>
          {TAB_META[tabs[0]].label}
        </p>
      )}

      {tabs.map((tab) => (
        <div
          key={tab}
          id={panelId(tab)}
          role={tabs.length > 1 ? "tabpanel" : undefined}
          aria-labelledby={tabId(tab)}
          tabIndex={tabs.length > 1 ? 0 : undefined}
          // Not the `hidden` attribute: Tailwind's preflight hides [hidden] with !important
          // inside a cascade layer, which the no-JS override below could never beat.
          data-active={tab === active || undefined}
          className={cn("hk-deck-panel", tabs.length > 1 && "focus-visible:outline-offset-8")}
          data-deck-panel={tab}
        >
          {tab === "screenshots" ? (
            <Gallery items={gallery} title={title} seed={slug} accent={accent} address={address} />
          ) : null}
          {tab === "video" ? (
            <VideoEmbed
              key={videoEpoch}
              url={videoUrl}
              video={video}
              title={title}
              poster={poster}
              seed={slug}
              accent={accent}
              className="max-w-4xl"
            />
          ) : null}
          {tab === "live" && liveUrl ? (
            <LivePreview
              projectId={projectId}
              bossEnabled={bossEnabled}
              slug={slug}
              title={title}
              liveUrl={liveUrl}
              allowIframe={allowIframe}
              poster={poster}
              seed={slug}
              accent={accent}
              address={address}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
