"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adminRequest, adminSend, adminUpload, ApiError, firstErrors } from "@/lib/admin/api";
import type { AdminMedia, Paginated } from "@/lib/types";
import { checkFile, type MediaKind } from "@/components/admin/media/media-utils";

/** `["admin","media"]` prefix: list pages under "list", single files under "item". */
export const mediaKeys = {
  all: ["admin", "media"] as const,
  list: (params: MediaListParams) => ["admin", "media", "list", params] as const,
  item: (id: number) => ["admin", "media", "item", id] as const,
};

export type MediaListParams = {
  q?: string;
  type?: MediaKind | null;
  page?: number;
  perPage?: number;
};

/** GET media (newest first, server-side pagination; `per_page` ≤ 100). */
export function useMediaList({ q = "", type = null, page = 1, perPage = 24 }: MediaListParams) {
  const params = { q: q.trim(), type, page, perPage };
  return useQuery({
    queryKey: mediaKeys.list(params),
    queryFn: ({ signal }) =>
      adminRequest<Paginated<AdminMedia>>("media", {
        query: { q: params.q, type: params.type, page: params.page, per_page: params.perPage },
        signal,
      }),
    placeholderData: keepPreviousData,
  });
}

/** GET media/{id} (includes `used_in`). */
export function useMediaItem(id: number | null, initialData?: AdminMedia) {
  return useQuery({
    queryKey: id === null ? ["admin", "media", "item", "none"] : mediaKeys.item(id),
    queryFn: async ({ signal }) => {
      const res = await adminRequest<{ data: AdminMedia }>(`media/${id}`, { signal });
      return res.data;
    },
    enabled: id !== null,
    initialData: initialData && initialData.id === id ? initialData : undefined,
    // The list row is a fine first paint, but always refresh `used_in`.
    initialDataUpdatedAt: 0,
  });
}

function useMediaWritten() {
  const queryClient = useQueryClient();
  return (media: AdminMedia) => {
    queryClient.setQueryData(mediaKeys.item(media.id), media);
    void queryClient.invalidateQueries({ queryKey: [...mediaKeys.all, "list"] });
    // Rows that embed this file (cover, logo…) show its new alt/URL after a refetch.
    void queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === "admin" && query.queryKey[1] !== "media",
    });
  };
}

/** PATCH media/{id} `{ alt }`. */
export function useUpdateMediaAlt() {
  const written = useMediaWritten();
  return useMutation<AdminMedia, unknown, { id: number; alt: string | null }>({
    mutationFn: ({ id, alt }) => adminSend<AdminMedia>("PATCH", `media/${id}`, { alt }),
    onSuccess: written,
  });
}

/** POST media/{id}/replace (multipart `file`, same kind) with upload progress. */
export function useReplaceMedia() {
  const written = useMediaWritten();
  return useMutation<
    AdminMedia,
    unknown,
    { id: number; file: File; onProgress?: (fraction: number) => void }
  >({
    mutationFn: ({ id, file, onProgress }) => {
      const form = new FormData();
      form.append("file", file);
      return adminUpload<AdminMedia>(`media/${id}/replace`, form, onProgress);
    },
    onSuccess: written,
  });
}

/** DELETE media/{id}. A 409 error's `body.used_in` lists where the file is used. */
export function useDeleteMedia() {
  const queryClient = useQueryClient();
  return useMutation<unknown, unknown, number>({
    mutationFn: (id) => adminSend("DELETE", `media/${id}`),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: mediaKeys.item(id), exact: true });
      void queryClient.invalidateQueries({ queryKey: [...mediaKeys.all, "list"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });
}

/* ── Upload queue ─────────────────────────────────────────────────────── */

export type UploadItem = {
  key: string;
  name: string;
  size: number;
  /** 0–1 */
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
  media?: AdminMedia;
};

const CONCURRENCY = 3;

function uploadErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const first = Object.values(firstErrors(error))[0];
    return (first ?? error.message).replace(/\bfiles\.\d+\b/g, "file");
  }
  return error instanceof Error ? error.message : "Upload failed.";
}

/**
 * Multi-file upload with per-file progress: each file is its own `POST media` (`files[]`), at
 * most 3 at a time. `onUploaded` fires once per finished file, in completion order.
 */
export function useMediaUploads({
  accept,
  onUploaded,
}: { accept?: MediaKind; onUploaded?: (media: AdminMedia) => void } = {}) {
  const queryClient = useQueryClient();
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const queue = useRef<Array<{ key: string; file: File }>>([]);
  const active = useRef(0);
  const counter = useRef(0);
  const onUploadedRef = useRef(onUploaded);
  useEffect(() => {
    onUploadedRef.current = onUploaded;
  }, [onUploaded]);

  const patch = useCallback((key: string, changes: Partial<UploadItem>) => {
    setUploads((list) => list.map((item) => (item.key === key ? { ...item, ...changes } : item)));
  }, []);

  const pump = useCallback(() => {
    const run = () => {
      while (active.current < CONCURRENCY && queue.current.length > 0) {
        const next = queue.current.shift();
        if (!next) break;
        active.current += 1;
        const { key, file } = next;
        patch(key, { status: "uploading" });

        const form = new FormData();
        form.append("files[]", file);
        adminUpload<AdminMedia[]>("media", form, (progress) => patch(key, { progress }))
          .then((created) => {
            const media = created?.[0];
            patch(key, { status: "done", progress: 1, media });
            if (media) onUploadedRef.current?.(media);
          })
          .catch((error: unknown) => {
            patch(key, { status: "error", error: uploadErrorMessage(error) });
          })
          .finally(() => {
            active.current -= 1;
            if (active.current === 0 && queue.current.length === 0) {
              void queryClient.invalidateQueries({ queryKey: [...mediaKeys.all, "list"] });
              void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
            }
            run();
          });
      }
    };
    run();
  }, [patch, queryClient]);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const added: UploadItem[] = [];
      for (const file of Array.from(files)) {
        counter.current += 1;
        const key = `upload-${counter.current}`;
        const problem = checkFile(file, accept);
        added.push({
          key,
          name: file.name,
          size: file.size,
          progress: 0,
          status: problem ? "error" : "queued",
          error: problem ?? undefined,
        });
        if (!problem) queue.current.push({ key, file });
      }
      setUploads((list) => [...added, ...list]);
      pump();
    },
    [accept, pump],
  );

  const dismiss = useCallback((key: string) => {
    setUploads((list) => list.filter((item) => item.key !== key));
  }, []);

  const clearFinished = useCallback(() => {
    setUploads((list) =>
      list.filter((item) => item.status === "queued" || item.status === "uploading"),
    );
  }, []);

  const busy = uploads.some((item) => item.status === "queued" || item.status === "uploading");

  return { uploads, addFiles, dismiss, clearFinished, busy };
}

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
