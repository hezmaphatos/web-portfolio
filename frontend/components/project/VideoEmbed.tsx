import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Media } from "@/lib/types";

type Props = {
  /** YouTube URL from the API (`video_url`; the backend only accepts YouTube links). */
  url: string | null;
  /** Uploaded mp4/webm (`video`). */
  video: Media | null;
  title: string;
  /** Poster for the uploaded video (usually the cover). */
  poster?: Media | null;
  className?: string;
};

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

/**
 * Project video (spec §6.3 Preview Deck → Video): an uploaded file plays in a native player
 * that downloads nothing until play (preload="none"); a YouTube link becomes a privacy-enhanced
 * youtube-nocookie embed the browser only loads near the viewport (loading="lazy"). Both work
 * without JavaScript.
 */
export function VideoEmbed({ url, video, title, poster, className }: Props) {
  const youtube = url ? parseYouTube(url) : null;
  const file = video?.mime.startsWith("video/") ? video : null;
  if (!youtube && !file) return null;

  return (
    <div className={cn("flex flex-col gap-10", className)} data-video>
      {file ? (
        <figure className="flex flex-col gap-3">
          <div className="border-ink bg-ink overflow-hidden border-2 shadow-[6px_6px_0_var(--accent)]">
            <video
              controls
              preload="none"
              playsInline
              poster={poster?.mime.startsWith("image/") ? poster.url : undefined}
              className="block h-auto w-full"
              style={{
                aspectRatio:
                  file.width && file.height ? `${file.width} / ${file.height}` : "16 / 9",
              }}
            >
              <source src={file.url} type={file.mime} />
              <a href={file.url} className="hk-link text-paper">
                Download the video
              </a>
            </video>
          </div>
          <figcaption className="hk-pixel text-ink-2 text-[0.6875rem]">{title} · Video</figcaption>
        </figure>
      ) : null}

      {youtube ? (
        <figure className="flex flex-col gap-3">
          <div className="border-ink bg-ink relative aspect-video overflow-hidden border-2 shadow-[6px_6px_0_var(--accent)]">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtube.id}${youtube.start ? `?start=${youtube.start}` : ""}`}
              title={`${title}: video`}
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="absolute inset-0 size-full"
            />
          </div>
          <figcaption className="flex flex-wrap items-center justify-between gap-3">
            <span className="hk-pixel text-ink-2 text-[0.6875rem]">{title} · Video</span>
            <a
              href={url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="hk-link inline-flex items-center gap-1 text-sm font-semibold"
            >
              Watch on YouTube
              <ArrowUpRight aria-hidden="true" className="size-4" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </figcaption>
        </figure>
      ) : null}
    </div>
  );
}
