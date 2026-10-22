import { FileTextIcon, FilmIcon, ImageIcon } from "lucide-react";

import { mediaKind } from "@/components/admin/media/media-utils";
import type { Media } from "@/lib/types";
import { cn } from "@/lib/utils";

const SIZES = {
  xs: "size-8 rounded-md",
  sm: "size-10 rounded-md",
  md: "size-16 rounded-lg",
  lg: "size-24 rounded-lg",
} as const;

export type MediaThumbSize = keyof typeof SIZES;

type MediaThumbProps = {
  media: Media | null | undefined;
  /** xs 32px · sm 40px (default, table rows) · md 64px · lg 96px. Or pass `className` sizes. */
  size?: MediaThumbSize;
  /** Used for the placeholder initials and as alt fallback. */
  label?: string;
  /** "cover" (default) crops to the square; "contain" letterboxes (logos, icons). */
  fit?: "cover" | "contain";
  className?: string;
};

function initials(label: string | undefined): string {
  if (!label) return "";
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Square thumbnail for tables, pickers and fields. Images use the 480px `thumb_url`;
 * video / PDF render an icon tile; a missing file renders a neutral placeholder.
 */
export function MediaThumb({
  media,
  size = "sm",
  label,
  fit = "cover",
  className,
}: MediaThumbProps) {
  const box = cn(
    "bg-muted text-muted-foreground relative inline-flex shrink-0 items-center justify-center overflow-hidden border",
    SIZES[size],
    className,
  );
  const iconSize = size === "xs" || size === "sm" ? "size-4" : "size-6";

  if (!media) {
    const text = initials(label);
    return (
      <span
        className={cn(
          box,
          "bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(0_0_0/0.04)_6px_12px)]",
        )}
        role="img"
        aria-label={label ? `${label}: no image` : "No image"}
      >
        {text && size !== "xs" ? (
          <span className="text-xs font-semibold tracking-wide" aria-hidden>
            {text}
          </span>
        ) : (
          <ImageIcon className={cn(iconSize, "opacity-50")} aria-hidden />
        )}
      </span>
    );
  }

  const kind = mediaKind(media.mime);

  if (kind === "image") {
    return (
      <span className={box} style={{ backgroundColor: media.dominant_color ?? undefined }}>
        {/* Plain <img> on purpose: admin-only thumbnails straight from Laravel storage. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={media.thumb_url ?? media.url}
          alt={media.alt ?? label ?? ""}
          loading="lazy"
          decoding="async"
          className={cn("size-full", fit === "contain" ? "object-contain" : "object-cover")}
        />
      </span>
    );
  }

  const Icon = kind === "video" ? FilmIcon : FileTextIcon;
  return (
    <span
      className={box}
      role="img"
      aria-label={`${kind === "video" ? "Video" : kind === "pdf" ? "PDF" : "File"}${label ? `: ${label}` : ""}`}
    >
      <Icon className={iconSize} aria-hidden />
      {size === "md" || size === "lg" ? (
        <span className="absolute bottom-1 text-[10px] font-semibold uppercase" aria-hidden>
          {kind === "other" ? "file" : kind}
        </span>
      ) : null}
    </span>
  );
}
