"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import { CheckCircle2Icon, UploadCloudIcon, XCircleIcon, XIcon } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import {
  formatBytes,
  MEDIA_ACCEPT,
  MEDIA_KIND_LABEL,
  MEDIA_KINDS,
  type MediaKind,
} from "@/components/admin/media/media-utils";
import type { UploadItem } from "@/components/admin/media/media-queries";
import { cn } from "@/lib/utils";

type MediaUploadZoneProps = {
  onFiles: (files: File[]) => void;
  /** Restrict the file chooser to one kind. */
  accept?: MediaKind;
  multiple?: boolean;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
};

function hasFiles(event: DragEvent) {
  return Array.from(event.dataTransfer.types).includes("Files");
}

/** Drag & drop target + "Choose files" button (keyboard path). */
export function MediaUploadZone({
  onFiles,
  accept,
  multiple = true,
  disabled = false,
  compact = false,
  className,
}: MediaUploadZoneProps) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const acceptAttr = accept
    ? MEDIA_ACCEPT[accept]
    : MEDIA_KINDS.map((k) => MEDIA_ACCEPT[k]).join(",");
  const hint = accept
    ? `${MEDIA_KIND_LABEL[accept]} files only`
    : "JPG, PNG, WebP, GIF (≤ 8 MB) · MP4, WebM (≤ 30 MB) · PDF (≤ 10 MB)";

  return (
    <div
      onDragEnter={(event) => {
        if (!disabled && hasFiles(event)) {
          event.preventDefault();
          setOver(true);
        }
      }}
      onDragOver={(event) => {
        if (!disabled && hasFiles(event)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(event) => {
        if (disabled || !hasFiles(event)) return;
        event.preventDefault();
        setOver(false);
        const files = Array.from(event.dataTransfer.files);
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
      }}
      className={cn(
        "flex items-center justify-center gap-3 rounded-lg border-2 border-dashed text-center transition-colors",
        compact ? "flex-row px-4 py-3" : "flex-col px-6 py-8",
        over ? "border-primary bg-primary/5" : "border-border bg-muted/30",
        disabled && "opacity-60",
        className,
      )}
    >
      <UploadCloudIcon
        className={cn("text-muted-foreground", compact ? "size-5" : "size-8")}
        aria-hidden
      />
      <div className={cn("flex flex-col gap-0.5", compact && "items-start text-left")}>
        <p className="text-sm font-medium">
          {over ? "Drop to upload" : multiple ? "Drag files here, or" : "Drag a file here, or"}{" "}
          <span className="sr-only">use the button</span>
        </p>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </div>
      <input
        ref={input}
        id={inputId}
        type="file"
        className="sr-only"
        tabIndex={-1}
        accept={acceptAttr}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) onFiles(files);
          event.target.value = ""; // allow choosing the same file again
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        {multiple ? "Choose files" : "Choose file"}
      </Button>
    </div>
  );
}

/** Per-file progress rows for `useMediaUploads().uploads`. */
export function UploadProgressList({
  uploads,
  onDismiss,
  onClearFinished,
  className,
}: {
  uploads: UploadItem[];
  onDismiss?: (key: string) => void;
  onClearFinished?: () => void;
  className?: string;
}) {
  if (uploads.length === 0) return null;
  const finished = uploads.filter((u) => u.status === "done" || u.status === "error").length;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Uploads</p>
        {onClearFinished && finished > 0 ? (
          <Button type="button" variant="ghost" size="xs" onClick={onClearFinished}>
            Clear finished
          </Button>
        ) : null}
      </div>
      <ul className="flex max-h-48 flex-col gap-1.5 overflow-y-auto" aria-live="polite">
        {uploads.map((item) => {
          const percent = Math.round(item.progress * 100);
          return (
            <li
              key={item.key}
              className="bg-card flex items-center gap-3 rounded-md border px-3 py-2"
            >
              {item.status === "done" ? (
                <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600" aria-hidden />
              ) : item.status === "error" ? (
                <XCircleIcon className="text-destructive size-4 shrink-0" aria-hidden />
              ) : (
                <UploadCloudIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium" title={item.name}>
                    {item.name}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {item.status === "uploading"
                      ? `${percent}%`
                      : item.status === "queued"
                        ? "Waiting…"
                        : item.status === "done"
                          ? "Uploaded"
                          : "Failed"}{" "}
                    · {formatBytes(item.size)}
                  </span>
                </div>
                {item.status === "uploading" || item.status === "queued" ? (
                  <div
                    role="progressbar"
                    aria-label={`Uploading ${item.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                    className="bg-muted h-1.5 overflow-hidden rounded-full"
                  >
                    <div
                      className="bg-primary h-full origin-left rounded-full transition-transform"
                      style={{ transform: `scaleX(${item.progress})` }}
                    />
                  </div>
                ) : null}
                {item.error ? <p className="text-destructive text-xs">{item.error}</p> : null}
              </div>
              {onDismiss && (item.status === "done" || item.status === "error") ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onDismiss(item.key)}
                  aria-label={`Dismiss ${item.name}`}
                >
                  <XIcon aria-hidden />
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
