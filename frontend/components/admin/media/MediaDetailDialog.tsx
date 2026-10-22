"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangleIcon,
  CopyIcon,
  ExternalLinkIcon,
  FileTextIcon,
  Loader2Icon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/admin/ui/alert-dialog";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { Textarea } from "@/components/admin/ui/textarea";
import { KitError } from "@/components/admin/table/states";
import {
  useDeleteMedia,
  useMediaItem,
  useReplaceMedia,
  useUpdateMediaAlt,
} from "@/components/admin/media/media-queries";
import {
  formatBytes,
  formatDate,
  MEDIA_ACCEPT,
  MEDIA_KIND_LABEL,
  mediaKind,
  mediaName,
  usageHref,
  usageLabel,
  usedInFromBody,
} from "@/components/admin/media/media-utils";
import { ApiError, errorMessage, firstErrors } from "@/lib/admin/api";
import type { AdminMedia, MediaUsage } from "@/lib/types";

type MediaDetailDialogProps = {
  /** Open while non-null. */
  mediaId: number | null;
  /** The grid row, for an instant first paint. */
  initial?: AdminMedia;
  onClose: () => void;
  onDeleted?: (id: number) => void;
};

function kindLabel(mime: string): string {
  const kind = mediaKind(mime);
  return kind === "other" ? "File" : MEDIA_KIND_LABEL[kind];
}

/** Per-file details: preview, alt text, replace, copy URL, usages, delete. */
export function MediaDetailDialog({
  mediaId,
  initial,
  onClose,
  onDeleted,
}: MediaDetailDialogProps) {
  const item = useMediaItem(mediaId, initial);
  const media = item.data;

  return (
    <Dialog open={mediaId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="truncate">{media ? mediaName(media) : "Media"}</DialogTitle>
          <DialogDescription>
            {media
              ? `${kindLabel(media.mime)} · ${formatBytes(media.size)}`
              : "Loading file details…"}
          </DialogDescription>
        </DialogHeader>
        {media ? (
          <DetailBody key={media.id} media={media} onClose={onClose} onDeleted={onDeleted} />
        ) : item.isError ? (
          <KitError
            error={item.error}
            onRetry={() => void item.refetch()}
            title="Could not load this file"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-[3fr_2fr]" aria-hidden>
            <Skeleton className="aspect-video w-full rounded-lg" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Preview({ media }: { media: AdminMedia }) {
  const kind = mediaKind(media.mime);
  if (kind === "image") {
    return (
      // Fixed-height stage: the dialog does not jump while the full-size file loads.
      <div className="flex h-[min(55vh,420px)] items-center justify-center overflow-hidden rounded-lg border bg-[repeating-conic-gradient(#f4f4f5_0%_25%,#fff_0%_50%)] bg-size-[16px_16px]">
        {/* Plain <img> on purpose: admin-only preview straight from Laravel storage. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={media.url}
          alt={media.alt ?? ""}
          className="max-h-full max-w-full object-contain"
          width={media.width ?? undefined}
          height={media.height ?? undefined}
        />
      </div>
    );
  }
  if (kind === "video") {
    return (
      <video
        src={media.url}
        controls
        preload="metadata"
        className="max-h-[55vh] w-full rounded-lg border bg-black"
        aria-label={media.alt ?? mediaName(media)}
      />
    );
  }
  return (
    <div className="bg-muted/40 flex aspect-4/3 flex-col items-center justify-center gap-3 rounded-lg border">
      <FileTextIcon className="text-muted-foreground size-14" aria-hidden />
      <Button asChild variant="outline" size="sm">
        <a href={media.url} target="_blank" rel="noreferrer">
          Open PDF <ExternalLinkIcon aria-hidden />
          <span className="sr-only">(new tab)</span>
        </a>
      </Button>
    </div>
  );
}

function UsageList({ usages }: { usages: MediaUsage[] }) {
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {usages.map((usage) => (
        <li key={`${usage.type}-${usage.id}-${usage.field}`}>
          <Link
            href={usageHref(usage)}
            className="hover:text-foreground focus-visible:ring-ring/50 rounded-sm text-blue-700 underline underline-offset-2 outline-none focus-visible:ring-2"
          >
            {usageLabel(usage)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function DetailBody({
  media,
  onClose,
  onDeleted,
}: {
  media: AdminMedia;
  onClose: () => void;
  onDeleted?: (id: number) => void;
}) {
  const altId = useId();
  const urlId = useId();
  const replaceInput = useRef<HTMLInputElement>(null);
  const [alt, setAlt] = useState(media.alt ?? "");
  const [replaceProgress, setReplaceProgress] = useState<number | null>(null);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [blockedBy, setBlockedBy] = useState<MediaUsage[] | null>(null);

  const updateAlt = useUpdateMediaAlt();
  const replace = useReplaceMedia();
  const remove = useDeleteMedia();

  const kind = mediaKind(media.mime);
  const usages = media.used_in ?? [];
  const altChanged = alt.trim() !== (media.alt ?? "");

  function saveAlt() {
    updateAlt.mutate(
      { id: media.id, alt: alt.trim() === "" ? null : alt.trim() },
      {
        onSuccess: () => toast.success("Alt text saved"),
        onError: (error) => toast.error(firstErrors(error).alt ?? errorMessage(error)),
      },
    );
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(media.url);
      toast.success("URL copied");
    } catch {
      const field = document.getElementById(urlId) as HTMLInputElement | null;
      field?.select();
      toast.message("Press Ctrl+C to copy the selected URL.");
    }
  }

  function onReplaceFile(file: File) {
    // No client-side kind check: the chooser's `accept` filters, and the API's 422 on `file`
    // ("must be the same kind") is the message shown when a wrong file still gets through.
    setReplaceError(null);
    setReplaceProgress(0);
    replace.mutate(
      { id: media.id, file, onProgress: setReplaceProgress },
      {
        onSuccess: () => toast.success("File replaced"),
        onError: (error) => setReplaceError(firstErrors(error).file ?? errorMessage(error)),
        onSettled: () => setReplaceProgress(null),
      },
    );
  }

  function confirmDelete() {
    remove.mutate(media.id, {
      onSuccess: () => {
        toast.success("File deleted");
        setConfirmOpen(false);
        onDeleted?.(media.id);
        onClose();
      },
      onError: (error) => {
        setConfirmOpen(false);
        if (error instanceof ApiError && error.status === 409) {
          const list = usedInFromBody(error.body);
          setBlockedBy(list.length ? list : usages);
        } else {
          toast.error(`Could not delete: ${errorMessage(error)}`);
        }
      },
    });
  }

  return (
    <div className="grid gap-5 sm:grid-cols-[3fr_2fr]">
      <div className="flex min-w-0 flex-col gap-3">
        <Preview media={media} />
        <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt>Type</dt>
          <dd className="text-foreground">{media.mime}</dd>
          {media.width && media.height ? (
            <>
              <dt>Dimensions</dt>
              <dd className="text-foreground tabular-nums">
                {media.width} × {media.height}px
              </dd>
            </>
          ) : null}
          <dt>Size</dt>
          <dd className="text-foreground tabular-nums">{formatBytes(media.size)}</dd>
          <dt>Uploaded</dt>
          <dd className="text-foreground">{formatDate(media.created_at)}</dd>
          {media.updated_at !== media.created_at ? (
            <>
              <dt>Updated</dt>
              <dd className="text-foreground">{formatDate(media.updated_at)}</dd>
            </>
          ) : null}
        </dl>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (altChanged) saveAlt();
          }}
        >
          <Label htmlFor={altId}>Alt text</Label>
          <Textarea
            id={altId}
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            rows={3}
            maxLength={255}
            placeholder={kind === "image" ? "What does the image show?" : "Short description"}
            aria-describedby={`${altId}-help`}
          />
          <p id={`${altId}-help`} className="text-muted-foreground text-xs">
            Read by screen readers. Leave empty when the image is decorative or the context already
            describes it.
          </p>
          <div>
            <Button type="submit" size="sm" disabled={!altChanged || updateAlt.isPending}>
              {updateAlt.isPending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
              Save alt text
            </Button>
          </div>
        </form>

        <div className="flex flex-col gap-2">
          <Label htmlFor={urlId}>Public URL</Label>
          <div className="flex gap-2">
            <Input
              id={urlId}
              value={media.url}
              readOnly
              onFocus={(event) => event.target.select()}
              className="font-mono text-xs"
            />
            <Button type="button" variant="outline" size="sm" onClick={copyUrl} className="h-8">
              <CopyIcon aria-hidden />
              Copy
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Replace file</p>
          <p className="text-muted-foreground text-xs">
            Keeps the id, so every place using it shows the new file. Must be the same kind (
            {kind === "other" ? "file" : MEDIA_KIND_LABEL[kind].toLowerCase()}).
          </p>
          <input
            ref={replaceInput}
            type="file"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            accept={kind === "other" ? undefined : MEDIA_ACCEPT[kind]}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onReplaceFile(file);
            }}
          />
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={replace.isPending}
              onClick={() => replaceInput.current?.click()}
            >
              {replace.isPending ? (
                <Loader2Icon className="animate-spin" aria-hidden />
              ) : (
                <RefreshCwIcon aria-hidden />
              )}
              {replace.isPending ? "Replacing…" : "Choose new file"}
            </Button>
          </div>
          {replaceProgress !== null ? (
            <div
              role="progressbar"
              aria-label="Replacing file"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(replaceProgress * 100)}
              className="bg-muted h-1.5 overflow-hidden rounded-full"
            >
              <div
                className="bg-primary h-full origin-left transition-transform"
                style={{ transform: `scaleX(${replaceProgress})` }}
              />
            </div>
          ) : null}
          {replaceError ? (
            <p className="text-destructive text-xs font-medium" role="alert">
              {replaceError}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Used in</p>
          {usages.length ? (
            <UsageList usages={usages} />
          ) : (
            <p className="text-muted-foreground text-sm">Not used anywhere.</p>
          )}
        </div>

        {blockedBy ? (
          <div
            role="alert"
            className="border-destructive/30 bg-destructive/5 flex flex-col gap-1.5 rounded-lg border p-3 text-sm"
          >
            <p className="text-destructive flex items-center gap-2 font-medium">
              <AlertTriangleIcon className="size-4" aria-hidden />
              Can’t delete: this file is still in use.
            </p>
            <p className="text-muted-foreground text-xs">
              In use by: remove it from these first, then delete it.
            </p>
            <UsageList usages={blockedBy} />
          </div>
        ) : null}

        <div className="border-t pt-4">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={remove.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2Icon aria-hidden />
            Delete file
          </Button>
        </div>
      </div>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => !remove.isPending && setConfirmOpen(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{mediaName(media)}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {usages.length
                ? `It is used in ${usages.length} ${usages.length === 1 ? "place" : "places"}, so the server will refuse until it is removed there.`
                : "The file is removed from storage. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending}
              onClick={confirmDelete}
            >
              {remove.isPending ? (
                <Loader2Icon className="animate-spin" aria-hidden />
              ) : (
                <Trash2Icon aria-hidden />
              )}
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
