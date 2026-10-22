"use client";

import { useId, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react";

import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Input } from "@/components/admin/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { KitEmpty, KitError } from "@/components/admin/table/states";
import { MediaTile } from "@/components/admin/media/MediaTile";
import { MediaUploadZone, UploadProgressList } from "@/components/admin/media/MediaUploadZone";
import {
  useDebouncedValue,
  useMediaList,
  useMediaUploads,
} from "@/components/admin/media/media-queries";
import {
  MEDIA_KIND_LABEL,
  MEDIA_KINDS,
  mediaKind,
  type MediaKind,
} from "@/components/admin/media/media-utils";
import type { AdminMedia } from "@/lib/types";

type PickerBase = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lock the list (and uploads) to one kind. */
  accept?: MediaKind;
  title?: string;
  description?: string;
  /** Shown as already used (disabled), e.g. the ids already in a gallery. */
  excludeIds?: number[];
};

type SinglePickerProps = PickerBase & {
  multiple?: false;
  /** Pre-highlighted file (the field's current value). */
  selectedId?: number | null;
  onSelect: (media: AdminMedia) => void;
};

type MultiPickerProps = PickerBase & {
  multiple: true;
  /** Upper bound for one pick (default unlimited). */
  maxSelect?: number;
  /** Receives the files in the order they were selected. */
  onSelect: (media: AdminMedia[]) => void;
};

export type MediaPickerProps = SinglePickerProps | MultiPickerProps;

const PER_PAGE = 24;

/**
 * Modal media browser: search, type filter, pagination, drag-and-drop upload, and single or
 * ordered multi selection. Fresh uploads are selected automatically.
 */
export function MediaPicker(props: MediaPickerProps) {
  const { open, onOpenChange, accept } = props;
  const title =
    props.title ??
    (props.multiple
      ? "Choose files"
      : accept === "pdf"
        ? "Choose a PDF"
        : accept === "video"
          ? "Choose a video"
          : "Choose an image");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-4 py-3 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {props.description ??
              (props.multiple
                ? "Select one or more files; they are added in the order you pick them."
                : "Select a file, or upload a new one.")}
          </DialogDescription>
        </DialogHeader>
        {/* Rendered only while open, so every opening starts fresh. */}
        {open ? <PickerBody {...props} title={title} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PickerBody(props: MediaPickerProps & { title: string }) {
  const { accept, onOpenChange, excludeIds = [] } = props;
  const searchId = useId();
  const typeId = useId();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<MediaKind | null>(accept ?? null);
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<AdminMedia[]>([]);
  const [initialId] = useState(() => (!props.multiple ? (props.selectedId ?? null) : null));
  const debounced = useDebouncedValue(query, 300);
  const list = useMediaList({ q: debounced, type, page, perPage: PER_PAGE });
  const maxSelect = props.multiple ? props.maxSelect : 1;

  const uploads = useMediaUploads({
    accept,
    onUploaded: (media) => {
      if (accept && mediaKind(media.mime) !== accept) return;
      setSelection((current) => {
        if (!props.multiple) return [media];
        if (maxSelect !== undefined && current.length >= maxSelect) return current;
        return [...current, media];
      });
      setPage(1);
    },
  });

  const rows = list.data?.data ?? [];
  const meta = list.data?.meta;
  const selectedIds = selection.map((m) => m.id);
  const highlightId = selection[0]?.id ?? initialId;

  function toggle(media: AdminMedia) {
    if (!props.multiple) {
      setSelection([media]);
      return;
    }
    setSelection((current) => {
      if (current.some((m) => m.id === media.id)) return current.filter((m) => m.id !== media.id);
      if (maxSelect !== undefined && current.length >= maxSelect) return current;
      return [...current, media];
    });
  }

  function confirm(chosen: AdminMedia[] = selection) {
    if (chosen.length === 0) return;
    if (props.multiple) props.onSelect(chosen);
    else props.onSelect(chosen[0]);
    onOpenChange(false);
  }

  return (
    <>
      <div className="flex flex-col gap-3 border-b px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <label htmlFor={searchId} className="sr-only">
              Search media
            </label>
            <SearchIcon
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search by name or alt…"
              className="pl-8"
            />
          </div>
          {accept ? (
            <Badge variant="secondary" className="h-7 px-2.5">
              {MEDIA_KIND_LABEL[accept]} only
            </Badge>
          ) : (
            <div className="flex items-center gap-2">
              <label htmlFor={typeId} className="text-muted-foreground text-sm">
                Type
              </label>
              <Select
                value={type ?? "all"}
                onValueChange={(value) => {
                  setType(value === "all" ? null : (value as MediaKind));
                  setPage(1);
                }}
              >
                <SelectTrigger id={typeId} className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {MEDIA_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {MEDIA_KIND_LABEL[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <MediaUploadZone
            compact
            accept={accept}
            multiple={props.multiple ?? false}
            onFiles={uploads.addFiles}
            className="ml-auto min-w-0 flex-1 basis-80"
          />
        </div>
        <UploadProgressList
          uploads={uploads.uploads}
          onDismiss={uploads.dismiss}
          onClearFinished={uploads.clearFinished}
        />
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
        aria-busy={list.isFetching || undefined}
      >
        {list.isPending ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6" aria-hidden>
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} className="aspect-4/5 rounded-lg" />
            ))}
          </div>
        ) : list.isError ? (
          <KitError
            error={list.error}
            onRetry={() => void list.refetch()}
            title="Could not load media"
          />
        ) : rows.length === 0 ? (
          <KitEmpty
            title={debounced ? `No files match “${debounced}”` : "No files yet"}
            description={debounced ? undefined : "Drop files above or use Choose files to upload."}
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {rows.map((media) => {
              const excluded = excludeIds.includes(media.id);
              const index = selectedIds.indexOf(media.id);
              const selected = props.multiple ? index >= 0 : highlightId === media.id;
              return (
                <li key={media.id}>
                  <MediaTile
                    media={media}
                    selected={selected}
                    order={props.multiple && index >= 0 ? index + 1 : undefined}
                    disabled={excluded}
                    badge={excluded ? "Added" : undefined}
                    onClick={() => toggle(media)}
                    onDoubleClick={props.multiple ? undefined : () => confirm([media])}
                    className="w-full"
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <DialogFooter className="mx-0 mb-0 items-center px-4 py-3 sm:justify-between">
        <div className="flex items-center gap-2">
          {meta && meta.last_page > 1 ? (
            <nav className="flex items-center gap-1" aria-label="Media pages">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeftIcon aria-hidden />
                <span className="sr-only">Previous page</span>
              </Button>
              <span className="text-muted-foreground px-1 text-sm tabular-nums">
                {meta.current_page} / {meta.last_page}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={page >= meta.last_page}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRightIcon aria-hidden />
                <span className="sr-only">Next page</span>
              </Button>
            </nav>
          ) : null}
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {props.multiple
              ? `${selection.length} selected${maxSelect ? ` (max ${maxSelect})` : ""}`
              : selection[0]
                ? "1 selected"
                : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={selection.length === 0 || uploads.busy}
            onClick={() => confirm()}
          >
            {props.multiple
              ? selection.length > 1
                ? `Add ${selection.length} files`
                : "Add file"
              : "Use this file"}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
