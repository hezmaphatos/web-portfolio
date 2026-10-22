"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { FieldPath, FieldValues } from "react-hook-form";
import { ExternalLinkIcon, ImagePlusIcon, XIcon } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import { FieldError } from "@/components/admin/form/FieldShell";
import type { FieldBaseProps } from "@/components/admin/form/types";
import { useBoundField } from "@/components/admin/form/use-bound-field";
import { MediaPicker } from "@/components/admin/media/MediaPicker";
import { mediaKeys } from "@/components/admin/media/media-queries";
import {
  formatBytes,
  MEDIA_KIND_LABEL,
  mediaName,
  type MediaKind,
} from "@/components/admin/media/media-utils";
import { MediaThumb } from "@/components/admin/table/MediaThumb";
import { adminRequest } from "@/lib/admin/api";
import type { AdminMedia, Media } from "@/lib/types";
import { cn } from "@/lib/utils";

type MediaFieldProps<T extends FieldValues, N extends FieldPath<T>> = FieldBaseProps<T, N> & {
  /** Kind of file this field takes (the API rejects other kinds with 422). */
  accept: MediaKind;
  /** The Media object the API returned next to the id (e.g. `cover` for `cover_media_id`). */
  initialMedia?: Media | null;
};

/**
 * A `*_media_id` field: preview + Choose / Replace / Remove, picking from the Media Library.
 * Stores the id (or null).
 */
export function MediaField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  required,
  disabled,
  className,
  accept,
  initialMedia,
}: MediaFieldProps<T, N>) {
  const { id, inputRef, value: fieldValue, onChange, onBlur, error } = useBoundField(control, name);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Media | AdminMedia | null>(null);
  const value = (fieldValue as number | null | undefined) ?? null;

  const known =
    value === null
      ? null
      : picked?.id === value
        ? picked
        : initialMedia?.id === value
          ? initialMedia
          : null;

  // Value set from outside without a Media object (e.g. reset): load it for the preview.
  const lookup = useQuery({
    queryKey: value === null ? ["admin", "media", "item", "none"] : mediaKeys.item(value),
    queryFn: async ({ signal }) =>
      (await adminRequest<{ data: AdminMedia }>(`media/${value}`, { signal })).data,
    enabled: value !== null && known === null,
  });
  const media: Media | AdminMedia | null = known ?? lookup.data ?? null;
  const missing = value !== null && !media && lookup.isError;

  return (
    // A group named by the label (not <label for>): a label on the button would replace its
    // "Choose" / "Replace" name for screen readers.
    <div
      className={cn("flex min-w-0 flex-col gap-1.5", className)}
      data-field={name}
      role="group"
      aria-labelledby={`${id}-label`}
    >
      <span id={`${id}-label`} className="flex items-center gap-2 text-sm leading-none font-medium">
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        ) : null}
      </span>
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border p-2",
          error && "border-destructive",
        )}
      >
        <MediaThumb media={media} size="md" label={label} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {media ? (
            <>
              <span className="truncate text-sm font-medium" title={mediaName(media)}>
                {mediaName(media)}
              </span>
              <span className="text-muted-foreground text-xs">
                {media.width && media.height ? `${media.width}×${media.height}` : media.mime}
                {"size" in media ? ` · ${formatBytes((media as AdminMedia).size)}` : ""}
              </span>
              <a
                href={media.url}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-xs underline-offset-2 hover:underline"
              >
                Open <ExternalLinkIcon className="size-3" aria-hidden />
                <span className="sr-only">(new tab)</span>
              </a>
            </>
          ) : value !== null && !missing ? (
            <span className="text-muted-foreground text-sm">Loading #{value}…</span>
          ) : missing ? (
            <span className="text-destructive text-sm">File #{value} not found.</span>
          ) : (
            <span className="text-muted-foreground text-sm">
              No {accept === "pdf" ? "PDF" : MEDIA_KIND_LABEL[accept].toLowerCase()} selected.
            </span>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
          <Button
            id={id}
            ref={inputRef}
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => setOpen(true)}
            aria-invalid={error ? true : undefined}
            aria-describedby={
              [description && `${id}-description`, error && `${id}-error`]
                .filter(Boolean)
                .join(" ") || undefined
            }
          >
            <ImagePlusIcon aria-hidden />
            {value === null ? "Choose" : "Replace"}
            <span className="sr-only">{label}</span>
          </Button>
          {value !== null ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => {
                onChange(null);
                setPicked(null);
              }}
            >
              <XIcon aria-hidden />
              Remove
              <span className="sr-only">{label}</span>
            </Button>
          ) : null}
        </div>
      </div>
      {description ? (
        <p id={`${id}-description`} className="text-muted-foreground text-xs">
          {description}
        </p>
      ) : null}
      <FieldError id={`${id}-error`} message={error} />

      <MediaPicker
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) onBlur();
        }}
        accept={accept}
        title={`${label}: choose ${accept === "image" ? "an image" : accept === "pdf" ? "a PDF" : "a video"}`}
        selectedId={value}
        onSelect={(chosen) => {
          setPicked(chosen);
          onChange(chosen.id);
        }}
      />
    </div>
  );
}
