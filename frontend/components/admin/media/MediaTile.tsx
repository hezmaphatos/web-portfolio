"use client";

import type { ReactNode } from "react";
import { CheckIcon, FileTextIcon, FilmIcon } from "lucide-react";

import { formatBytes, mediaKind, mediaName } from "@/components/admin/media/media-utils";
import type { AdminMedia } from "@/lib/types";
import { cn } from "@/lib/utils";

type MediaTileProps = {
  media: AdminMedia;
  onClick: () => void;
  onDoubleClick?: () => void;
  /** Picker selection state (renders aria-pressed + a check / order number). */
  selected?: boolean;
  /** 1-based position in a multi-selection. */
  order?: number;
  disabled?: boolean;
  /** Small label in the corner, e.g. "Added" or "Used ×2". */
  badge?: ReactNode;
  className?: string;
};

/** Grid tile for the Media Library and the picker: image preview, or an icon card for PDF/video. */
export function MediaTile({
  media,
  onClick,
  onDoubleClick,
  selected,
  order,
  disabled,
  badge,
  className,
}: MediaTileProps) {
  const kind = mediaKind(media.mime);
  const name = mediaName(media);
  const pressable = selected !== undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      disabled={disabled}
      aria-pressed={pressable ? selected : undefined}
      title={name}
      className={cn(
        "group bg-card focus-visible:ring-ring/60 relative flex flex-col overflow-hidden rounded-lg border text-left transition-shadow outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
        selected ? "border-primary ring-primary ring-2" : "hover:shadow-md",
        className,
      )}
    >
      <span
        className="bg-muted relative flex aspect-square items-center justify-center overflow-hidden"
        style={{
          backgroundColor: kind === "image" ? (media.dominant_color ?? undefined) : undefined,
        }}
      >
        {kind === "image" ? (
          // Plain <img> on purpose: admin-only thumbnails straight from Laravel storage.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.thumb_url ?? media.url}
            alt={media.alt ?? ""}
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <span className="text-muted-foreground flex flex-col items-center gap-2 px-3 text-center">
            {kind === "video" ? (
              <FilmIcon className="size-10" aria-hidden />
            ) : (
              <FileTextIcon className="size-10" aria-hidden />
            )}
            <span className="text-xs font-semibold uppercase">
              {kind === "other" ? "file" : kind}
            </span>
          </span>
        )}
        {selected ? (
          <span className="bg-primary text-primary-foreground absolute top-2 right-2 flex size-6 items-center justify-center rounded-full text-xs font-semibold shadow">
            {order ?? <CheckIcon className="size-3.5" aria-hidden />}
          </span>
        ) : null}
        {badge ? (
          <span className="bg-background/90 absolute bottom-2 left-2 rounded px-1.5 py-0.5 text-[11px] font-medium shadow-sm">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="flex flex-col gap-0.5 px-2 py-1.5">
        <span className="truncate text-xs font-medium">{name}</span>
        <span className="text-muted-foreground truncate text-[11px]">
          {media.width && media.height ? `${media.width}×${media.height} · ` : ""}
          {formatBytes(media.size)}
        </span>
      </span>
      {selected && order ? <span className="sr-only">, selected as number {order}</span> : null}
    </button>
  );
}
