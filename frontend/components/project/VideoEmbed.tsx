"use client";

import { ArrowUpRight, Play } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Media } from "@/components/ui/Media";
import { cn } from "@/lib/utils";
import type { Media as MediaObject } from "@/lib/types";

import { parseYouTube, playableVideo } from "./deck/media";

type Props = {
  /** YouTube URL from the API (`video_url`; the backend only accepts YouTube links). */
  url: string | null;
  /** Uploaded mp4/webm (`video`). */
  video: MediaObject | null;
  title: string;
  /** Poster for both players (usually the cover); a generative placeholder when missing. */
  poster?: MediaObject | null;
  seed: string;
  accent: string;
  className?: string;
};

/** The uploaded video. Activity hides (not unmounts) a page we navigated away from, and a
 *  hidden <video> keeps playing, so it pauses when its stage is hidden. */
function UploadedVideo({
  file,
  poster,
  title,
}: {
  file: MediaObject;
  poster?: MediaObject | null;
  title: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useLayoutEffect(() => {
    const video = ref.current;
    return () => video?.pause();
  }, []);

  return (
    <figure className="flex flex-col gap-3">
      <div className="border-ink bg-ink overflow-hidden border-2 shadow-[6px_6px_0_var(--accent)]">
        <video
          ref={ref}
          controls
          preload="none"
          playsInline
          poster={poster?.mime.startsWith("image/") ? poster.url : undefined}
          className="block h-auto w-full"
          style={{
            aspectRatio: file.width && file.height ? `${file.width} / ${file.height}` : "16 / 9",
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
  );
}

/**
 * Project video (spec §6.3 Preview Deck → Video).
 * - Uploaded file: a native player that downloads nothing until play (preload="none").
 * - YouTube: a facade first — the project's own poster and a play button, no request to Google
 *   at all — and only a click loads the privacy-enhanced youtube-nocookie player (autoplay, so
 *   one click is enough). Hidden by Activity → back to the facade, which also stops the sound.
 *   Without JS the "Watch on YouTube" link still works.
 */
export function VideoEmbed({ url, video, title, poster, seed, accent, className }: Props) {
  const youtube = url ? parseYouTube(url) : null;
  const file = playableVideo(video);
  const [playing, setPlaying] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  useLayoutEffect(() => () => setPlaying(false), []);
  // The facade button is gone after the click: keyboard focus moves on to the player.
  useEffect(() => {
    if (playing) frame.current?.focus();
  }, [playing]);

  if (!youtube && !file) return null;

  const params = new URLSearchParams({ autoplay: "1", rel: "0" });
  if (youtube?.start) params.set("start", String(youtube.start));

  return (
    <div className={cn("flex flex-col gap-10", className)} data-video>
      {file ? <UploadedVideo file={file} poster={poster} title={title} /> : null}

      {youtube ? (
        <figure className="flex flex-col gap-3">
          <div className="border-ink bg-ink relative aspect-video overflow-hidden border-2 shadow-[6px_6px_0_var(--accent)]">
            {playing ? (
              <iframe
                ref={frame}
                src={`https://www.youtube-nocookie.com/embed/${youtube.id}?${params}`}
                title={`${title}: video`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="absolute inset-0 size-full"
              />
            ) : (
              <button
                type="button"
                className="hk-video-facade group absolute inset-0"
                onClick={() => setPlaying(true)}
                aria-label={`Play video: ${title} (loads YouTube)`}
              >
                <Media
                  media={poster}
                  alt=""
                  seed={`${seed}-video`}
                  accent={accent}
                  ratio={16 / 9}
                  sizes="(min-width: 1024px) 56rem, 92vw"
                  className="absolute inset-0"
                />
                <span className="hk-video-play" aria-hidden="true">
                  <Play className="size-8 translate-x-0.5" fill="currentColor" strokeWidth={0} />
                </span>
                <span className="hk-pixel hk-video-note" aria-hidden="true">
                  Click to load YouTube
                </span>
              </button>
            )}
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
