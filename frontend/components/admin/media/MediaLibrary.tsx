"use client";

import { useId, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, ImagesIcon, SearchIcon, XIcon } from "lucide-react";

import { EmptyState } from "@/components/admin/shell/EmptyState";
import { ErrorState } from "@/components/admin/shell/ErrorState";
import { LoadingState } from "@/components/admin/shell/LoadingState";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { MediaDetailDialog } from "@/components/admin/media/MediaDetailDialog";
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
  type MediaKind,
} from "@/components/admin/media/media-utils";
import type { AdminMedia } from "@/lib/types";
import { cn } from "@/lib/utils";

const PER_PAGE = 30;

/** Spec §7 Media Library: every upload, search, type filter, multi-upload, per-file details. */
export function MediaLibrary() {
  const searchId = useId();
  const typeId = useId();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<MediaKind | null>(null);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);
  const [openRow, setOpenRow] = useState<AdminMedia | undefined>(undefined);
  const debounced = useDebouncedValue(query.trim(), 300);
  const list = useMediaList({ q: debounced, type, page, perPage: PER_PAGE });
  const uploads = useMediaUploads({ onUploaded: () => setPage(1) });

  const rows = list.data?.data ?? [];
  const meta = list.data?.meta;
  const filtered = debounced !== "" || type !== null;

  function open(media: AdminMedia) {
    setOpenRow(media);
    setOpenId(media.id);
  }

  return (
    <>
      <PageHeader
        title="Media Library"
        description="Every uploaded image, video and PDF. Files that are still in use can’t be deleted."
        actions={
          meta ? (
            <span className="text-muted-foreground text-sm tabular-nums">
              {meta.total} {meta.total === 1 ? "file" : "files"}
              {filtered ? " found" : ""}
            </span>
          ) : null
        }
      />

      <div className="flex flex-col gap-4">
        <MediaUploadZone onFiles={uploads.addFiles} />
        <UploadProgressList
          uploads={uploads.uploads}
          onDismiss={uploads.dismiss}
          onClearFinished={uploads.clearFinished}
        />

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
              placeholder="Search by file name or alt…"
              className="pl-8"
            />
          </div>
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
              <SelectTrigger id={typeId} className="w-36">
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
          {filtered ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setType(null);
                setPage(1);
              }}
            >
              <XIcon aria-hidden />
              Clear filters
            </Button>
          ) : null}
        </div>

        {list.isPending ? (
          <LoadingState variant="cards" rows={12} label="Loading media…" />
        ) : list.isError ? (
          <ErrorState
            title="Could not load the media library"
            error={list.error}
            onRetry={() => void list.refetch()}
            retrying={list.isFetching}
          />
        ) : rows.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={SearchIcon}
              title="No files match these filters"
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setType(null);
                    setPage(1);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={ImagesIcon}
              title="No uploads yet"
              description="Drop images, videos or PDFs on the area above, or use Choose files."
            />
          )
        ) : (
          <ul
            className={cn(
              "grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
              list.isPlaceholderData && "opacity-60",
            )}
            aria-busy={list.isFetching || undefined}
            aria-label="Media files"
          >
            {rows.map((media) => {
              const used = media.used_in?.length ?? 0;
              return (
                <li key={media.id}>
                  <MediaTile
                    media={media}
                    onClick={() => open(media)}
                    badge={used ? `In use ×${used}` : undefined}
                    className="w-full"
                  />
                </li>
              );
            })}
          </ul>
        )}

        {meta && meta.last_page > 1 ? (
          <nav
            className="text-muted-foreground flex items-center justify-between gap-2 text-sm"
            aria-label="Media pages"
          >
            <span className="tabular-nums">
              {(meta.current_page - 1) * meta.per_page + 1}–
              {Math.min(meta.total, meta.current_page * meta.per_page)} of {meta.total}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || list.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeftIcon aria-hidden />
                Previous
              </Button>
              <span className="px-2 tabular-nums">
                Page {meta.current_page} of {meta.last_page}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= meta.last_page || list.isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRightIcon aria-hidden />
              </Button>
            </div>
          </nav>
        ) : null}
      </div>

      <MediaDetailDialog
        mediaId={openId}
        initial={openRow}
        onClose={() => setOpenId(null)}
        onDeleted={() => {
          // Deleting the only file on the last page: step back a page.
          if (rows.length === 1 && page > 1) setPage(page - 1);
        }}
      />
    </>
  );
}
