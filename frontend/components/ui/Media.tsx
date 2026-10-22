import Image from "next/image";

import { cn } from "@/lib/utils";
import type { Media as MediaObject } from "@/lib/types";

import { GenerativePlaceholder } from "./GenerativePlaceholder";

type Props = {
  media: MediaObject | null | undefined;
  /** Used when the media has no alt text of its own. */
  alt: string;
  /** Seeds the generative placeholder (e.g. the project slug). */
  seed: string;
  accent?: string;
  /** Box aspect ratio (width / height); also shapes the placeholder grid. */
  ratio?: number;
  sizes?: string;
  priority?: boolean;
  /** Use the 480 px thumbnail (small cards). */
  thumb?: boolean;
  className?: string;
  imgClassName?: string;
};

/**
 * The one image component of the site (spec §11): next/image with the blur preview from the
 * API, or a generative placeholder when there is no image (or the media is not an image).
 * Always fills a box with a fixed aspect ratio, so it never causes layout shift.
 */
export function Media({
  media,
  alt,
  seed,
  accent,
  ratio = 16 / 10,
  sizes = "100vw",
  priority = false,
  thumb = false,
  className,
  imgClassName,
}: Props) {
  const isImage = media?.mime.startsWith("image/") ?? false;
  const src = media && isImage ? (thumb && media.thumb_url ? media.thumb_url : media.url) : null;

  return (
    <div
      className={cn("bg-paper-2 relative overflow-hidden", className)}
      style={{ aspectRatio: String(ratio) }}
    >
      {media && src ? (
        <Image
          src={src}
          alt={media.alt ?? alt}
          fill
          sizes={sizes}
          priority={priority}
          placeholder={media.blur_data_url ? "blur" : "empty"}
          blurDataURL={media.blur_data_url ?? undefined}
          className={cn("object-cover", imgClassName)}
          style={media.dominant_color ? { backgroundColor: media.dominant_color } : undefined}
        />
      ) : (
        <GenerativePlaceholder
          seed={seed}
          accent={accent}
          ratio={ratio}
          label={`${alt} (placeholder artwork)`}
          className="absolute inset-0 h-full w-full"
        />
      )}
    </div>
  );
}
