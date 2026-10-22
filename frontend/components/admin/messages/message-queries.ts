"use client";

import { useCallback } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type Query,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { dashboardQueryKey } from "@/components/admin/shell/dashboard-query";
import { adminRequest, adminSend, ApiError, errorMessage } from "@/lib/admin/api";
import type { Dashboard, Message, Paginated } from "@/lib/types";

/** Backend default (MessageService::PER_PAGE); `per_page` may go up to 100. */
export const MESSAGES_PER_PAGE = 20;

/** Backend rule on `q` (IndexMessageRequest). */
export const MESSAGE_SEARCH_MAX = 190;

export type MessageListParams = {
  unread: boolean;
  q: string;
  page: number;
  perPage?: number;
};

/** `["admin","messages"]` prefix: list pages under "list", single messages under "item". */
export const messageKeys = {
  all: ["admin", "messages"] as const,
  lists: () => ["admin", "messages", "list"] as const,
  list: (params: Required<MessageListParams>) => ["admin", "messages", "list", params] as const,
  item: (id: number) => ["admin", "messages", "item", id] as const,
};

/**
 * GET messages?page&per_page&unread&q — newest first, paginated on the server. Polls every
 * minute (like the sidebar badge) so new contact messages show up without a reload.
 */
export function useMessageList({
  unread,
  q,
  page,
  perPage = MESSAGES_PER_PAGE,
}: MessageListParams) {
  const params = { unread, q: q.trim(), page, perPage };
  return useQuery({
    queryKey: messageKeys.list(params),
    queryFn: ({ signal }) =>
      adminRequest<Paginated<Message>>("messages", {
        query: {
          unread: params.unread ? 1 : undefined,
          q: params.q,
          page: params.page,
          per_page: params.perPage,
        },
        signal,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

/**
 * GET messages/{id}. A list row already holds the whole message, so pass it as `initial`
 * (with the list's `dataUpdatedAt`) to open instantly; a deep link (`?message=12`) fetches.
 */
export function useMessage(id: number | null, initial?: { row: Message; updatedAt: number }) {
  return useQuery({
    queryKey: id === null ? [...messageKeys.all, "item", "none"] : messageKeys.item(id),
    queryFn: async ({ signal }) => {
      const res = await adminRequest<{ data: Message }>(`messages/${id}`, { signal });
      return res.data;
    },
    enabled: id !== null,
    initialData: initial && initial.row.id === id ? initial.row : undefined,
    initialDataUpdatedAt: initial?.updatedAt,
  });
}

/**
 * Opening a message from the list: copy the row into the item cache unless the cached copy is
 * at least as new. Without this, a message opened earlier (cached as read) and since marked
 * unread elsewhere would reopen from the stale copy and skip the automatic mark-as-read.
 */
export function usePrimeMessage() {
  const queryClient = useQueryClient();
  return useCallback(
    (row: Message, updatedAt: number) => {
      const state = queryClient.getQueryState<Message>(messageKeys.item(row.id));
      if (state?.data !== undefined && state.dataUpdatedAt >= updatedAt) return;
      queryClient.setQueryData<Message>(messageKeys.item(row.id), row, { updatedAt });
    },
    [queryClient],
  );
}

/* ── Cache helpers ───────────────────────────────────────────────────── */

/** Only cancel refetches of queries that already hold data: cancelling a first fetch would
 * revert it to an idle pending query that nothing restarts. */
const hasData = (query: Query) => query.state.data !== undefined;

type Snapshot = {
  lists: [QueryKey, Paginated<Message> | undefined][];
  item: Message | undefined;
  dashboard: Dashboard | undefined;
};

function snapshot(queryClient: QueryClient, id: number): Snapshot {
  return {
    lists: queryClient.getQueriesData<Paginated<Message>>({ queryKey: messageKeys.lists() }),
    item: queryClient.getQueryData<Message>(messageKeys.item(id)),
    dashboard: queryClient.getQueryData<Dashboard>(dashboardQueryKey),
  };
}

function restore(queryClient: QueryClient, id: number, snap: Snapshot) {
  for (const [key, data] of snap.lists) queryClient.setQueryData(key, data);
  queryClient.setQueryData(messageKeys.item(id), snap.item);
  queryClient.setQueryData(dashboardQueryKey, snap.dashboard);
}

/** The cached copy of a message (item first, then any list page), to know its read state. */
function findCached(queryClient: QueryClient, id: number): Message | undefined {
  const item = queryClient.getQueryData<Message>(messageKeys.item(id));
  if (item) return item;
  for (const [, page] of queryClient.getQueriesData<Paginated<Message>>({
    queryKey: messageKeys.lists(),
  })) {
    const row = page?.data.find((message) => message.id === id);
    if (row) return row;
  }
  return undefined;
}

function patchRows(queryClient: QueryClient, id: number, patch: (row: Message) => Message) {
  queryClient.setQueriesData<Paginated<Message>>({ queryKey: messageKeys.lists() }, (page) =>
    page ? { ...page, data: page.data.map((row) => (row.id === id ? patch(row) : row)) } : page,
  );
  queryClient.setQueryData<Message>(messageKeys.item(id), (row) => (row ? patch(row) : row));
}

/** Keeps the sidebar badge and the dashboard's latest messages in step until the refetch. */
function patchDashboard(
  queryClient: QueryClient,
  id: number,
  unreadDelta: number,
  readAt: string | null,
) {
  queryClient.setQueryData<Dashboard>(dashboardQueryKey, (dashboard) =>
    dashboard
      ? {
          ...dashboard,
          counts: {
            ...dashboard.counts,
            unread_messages: Math.max(0, dashboard.counts.unread_messages + unreadDelta),
          },
          latest_messages: dashboard.latest_messages.map((message) =>
            message.id === id ? { ...message, read_at: readAt } : message,
          ),
        }
      : dashboard,
  );
}

/* ── Mutations ───────────────────────────────────────────────────────── */

export type MarkReadVariables = {
  id: number;
  read: boolean;
  /** Opening an unread message marks it read without a toast. */
  silent?: boolean;
};

/**
 * PATCH messages/{id}/read `{ read }`. Optimistic: list rows, the open message and the dashboard
 * badge change at once and roll back on error. Lists are only marked stale afterwards (not
 * refetched), so a message just read in the Unread view stays put until the next page/filter
 * change or poll instead of vanishing under the reader.
 */
export function useMarkMessageRead() {
  const queryClient = useQueryClient();

  return useMutation<Message, unknown, MarkReadVariables, Snapshot>({
    mutationFn: ({ id, read }) => adminSend<Message>("PATCH", `messages/${id}/read`, { read }),
    onMutate: async ({ id, read }) => {
      // A background refetch (the list poll, the open message) must not land after this and
      // overwrite the optimistic row with what the server had before the PATCH.
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: messageKeys.item(id),
          exact: true,
          predicate: hasData,
        }),
        queryClient.cancelQueries({ queryKey: messageKeys.lists(), predicate: hasData }),
      ]);
      const snap = snapshot(queryClient, id);
      const cached = findCached(queryClient, id);
      const readAt = read ? (cached?.read_at ?? new Date().toISOString()) : null;

      patchRows(queryClient, id, (row) => ({
        ...row,
        read_at: read ? (row.read_at ?? readAt) : null,
      }));
      // Only adjust the count when the state really flips (unknown → wait for the refetch).
      if (cached && (cached.read_at === null) === read) {
        patchDashboard(queryClient, id, read ? -1 : 1, readAt);
      }
      return snap;
    },
    onError: (error, { id, read }, snap) => {
      if (snap) restore(queryClient, id, snap);
      if (error instanceof ApiError && error.status === 404) {
        toast.error("This message no longer exists.");
        void queryClient.invalidateQueries({ queryKey: messageKeys.lists() });
        return;
      }
      toast.error(`Could not mark the message as ${read ? "read" : "unread"}`, {
        description: errorMessage(error),
      });
    },
    onSuccess: (message, { silent }) => {
      patchRows(queryClient, message.id, () => message);
      if (!silent) toast.success(message.read_at === null ? "Marked as unread" : "Marked as read");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: messageKeys.lists(), refetchType: "none" });
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
    },
  });
}

/** DELETE messages/{id}. Drops the row from every cached page at once, then refetches. */
export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation<unknown, unknown, number>({
    mutationFn: (id) => adminSend("DELETE", `messages/${id}`),
    onSuccess: (_data, id) => {
      removeFromCache(queryClient, id);
      toast.success("Message deleted");
    },
    onError: (error, id) => {
      if (error instanceof ApiError && error.status === 404) {
        // Already gone (another tab): treat it as deleted.
        removeFromCache(queryClient, id);
        toast.info("This message was already deleted.");
        return;
      }
      toast.error("Could not delete the message", { description: errorMessage(error) });
    },
  });
}

function removeFromCache(queryClient: QueryClient, id: number) {
  queryClient.setQueriesData<Paginated<Message>>({ queryKey: messageKeys.lists() }, (page) => {
    if (!page || !page.data.some((row) => row.id === id)) return page;
    return {
      ...page,
      data: page.data.filter((row) => row.id !== id),
      meta: { ...page.meta, total: Math.max(0, page.meta.total - 1) },
    };
  });
  // Not removed: the closing sheet still observes it and would refetch into a 404. Marked
  // invalid instead, so reopening it (deep link) refetches and shows "no longer exists".
  void queryClient.invalidateQueries({
    queryKey: messageKeys.item(id),
    exact: true,
    refetchType: "none",
  });
  void queryClient.invalidateQueries({ queryKey: messageKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
}
