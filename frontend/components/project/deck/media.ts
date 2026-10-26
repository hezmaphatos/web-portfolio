import type { Device, GalleryImage, Media } from "@/lib/types";

/*
 * Pure helpers of the Preview Deck (spec §6.3), shared by Server Components (which tabs exist)
 * and the client panels (carousel, lightbox, video). No React, no DOM.
 */

export const DEVICE_NAME: Record<Device, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

/** Allowed screen ratios (width / height) per device frame. */
const RATIO: Record<Device, { min: number; max: number; fallback: number }> = {
  desktop: { min: 4 / 3, max: 21 / 9, fallback: 16 / 10 },
  tablet: { min: 3 / 4, max: 4 / 3, fallback: 3 / 4 },
  mobile: { min: 9 / 20, max: 9 / 16, fallback: 9 / 19.5 },
};

/** Seconds of preview scroll per hidden screen height (a calm read, not a flick). */
const SCROLL_SECONDS_PER_SCREEN = 1.4;

export type ScreenFit = {
  /** Ratio of the device screen the shot sits in. */
  screen: number;
  /** Ratio of the image box inside the screen (= screen unless the shot is taller). */
  image: number;
  /** Taller than the screen: the rest is revealed by the hover auto-scroll. */
  tall: boolean;
  /** Hidden share of the image height (0–1): translateY(-shift × 100 %) shows its bottom. */
  shift: number;
  /** Auto-scroll duration in seconds, proportional to the hidden length. */
  duration: number;
};

/**
 * How a screenshot fits its device frame. Shots wider than the device are cropped to the
 * frame (object-cover); shots taller than any screen of that device (full-page captures) keep
 * their natural ratio inside a standard screen and scroll inside it on hover.
 */
export function screenFit(item: Pick<GalleryImage, "device" | "width" | "height">): ScreenFit {
  const { min, max, fallback } = RATIO[item.device];
  const still = (screen: number): ScreenFit => ({
    screen,
    image: screen,
    tall: false,
    shift: 0,
    duration: 0,
  });
  if (!item.width || !item.height) return still(fallback);

  const ratio = item.width / item.height;
  if (ratio >= min) return still(Math.min(max, ratio));

  const screen = Math.max(fallback, min);
  const hiddenScreens = screen / ratio - 1;
  return {
    screen,
    image: ratio,
    tall: true,
    shift: 1 - ratio / screen,
    duration: Math.min(9, Math.max(1.2, hiddenScreens * SCROLL_SECONDS_PER_SCREEN)),
  };
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** Video id (+ start second) from any common YouTube URL shape; null when it isn't one. */
export function parseYouTube(raw: string): { id: string; start: number | null } | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [, first, second] = url.pathname.split("/");
    id =
      first === "watch"
        ? url.searchParams.get("v")
        : ["embed", "shorts", "live", "v"].includes(first ?? "")
          ? (second ?? null)
          : null;
  }
  if (!id || !YOUTUBE_ID.test(id)) return null;

  const t = url.searchParams.get("t") ?? url.searchParams.get("start");
  const start = t && /^\d+s?$/.test(t) ? parseInt(t, 10) : null;
  return { id, start };
}

/** An uploaded file the browser can play (mp4 / webm), or null. */
export function playableVideo(video: Media | null): Media | null {
  return video?.mime.startsWith("video/") ? video : null;
}

/** Host shown in the desktop frame's address bar ("mindlens.app" when there is no site). */
export function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export type DeckTab = "screenshots" | "video" | "live";

/** Which Preview Deck tabs have data (spec §6.3: an empty tab is not shown). */
export function deckTabs(project: {
  gallery: GalleryImage[];
  video_url: string | null;
  video: Media | null;
  live_url: string | null;
}): DeckTab[] {
  const tabs: DeckTab[] = [];
  if (project.gallery.length > 0) tabs.push("screenshots");
  if ((project.video_url && parseYouTube(project.video_url)) || playableVideo(project.video)) {
    tabs.push("video");
  }
  if (project.live_url) tabs.push("live");
  return tabs;
}
