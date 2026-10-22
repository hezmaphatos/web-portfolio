"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  InboxIcon,
  MailCheckIcon,
  RefreshCwIcon,
  SearchIcon,
  SearchXIcon,
  XIcon,
} from "lucide-react";

import { dashboardQueryOptions } from "@/components/admin/shell/dashboard-query";
import { EmptyState } from "@/components/admin/shell/EmptyState";
import { ErrorState } from "@/components/admin/shell/ErrorState";
import { LoadingState } from "@/components/admin/shell/LoadingState";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Switch } from "@/components/admin/ui/switch";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

import { DeleteMessageDialog } from "./DeleteMessageDialog";
import { MessageList } from "./MessageList";
import { MessageSheet } from "./MessageSheet";
import {
  MESSAGE_SEARCH_MAX,
  useMarkMessageRead,
  useMessage,
  useMessageList,
  usePrimeMessage,
} from "./message-queries";
import { normalizeQuery, useInboxParams } from "./use-inbox-params";

const SEARCH_DEBOUNCE_MS = 300;
const numberFormat = new Intl.NumberFormat("en");

function plural(n: number, one: string, many: string) {
  return `${numberFormat.format(n)} ${n === 1 ? one : many}`;
}

/**
 * Spec §7 Messages: server-paginated inbox with an unread filter and search; a message opens in
 * a side sheet (and is marked read automatically), can be marked read/unread, deleted after a
 * confirmation, or answered with "Reply via email". Every change refreshes the dashboard query,
 * which also feeds the sidebar's unread badge.
 */
export function MessagesInbox() {
  const searchId = useId();
  const unreadId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const [params, update] = useInboxParams();
  const list = useMessageList(params);
  const unreadCount = useQuery({
    ...dashboardQueryOptions,
    select: (dashboard) => dashboard.counts.unread_messages,
  });

  const rows = list.data?.data;
  const meta = list.data?.meta;
  const openRow = rows?.find((row) => row.id === params.messageId);
  const detail = useMessage(
    params.messageId,
    openRow ? { row: openRow, updatedAt: list.dataUpdatedAt } : undefined,
  );

  const primeMessage = usePrimeMessage();
  const markRead = useMarkMessageRead();
  const { mutate: mark } = markRead;

  /* ── Search box: local draft, debounced into ?q= ─────────────────── */
  const [draft, setDraft] = useState(params.q);
  const [syncedQ, setSyncedQ] = useState(params.q);
  // The last q this box wrote. The router applies a history update a moment later (in a
  // transition), so keys typed in between must not be overwritten when that q arrives.
  const [ownQ, setOwnQ] = useState(params.q);
  if (params.q !== syncedQ) {
    setSyncedQ(params.q);
    if (params.q !== ownQ) {
      // Changed from outside (back/forward, a plain /admin/messages link): follow it.
      setOwnQ(params.q);
      setDraft(params.q);
    }
  }
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(debounce.current ?? undefined), []);

  function commitSearch(value: string) {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = null;
    setOwnQ(normalizeQuery(value));
    update({ q: value, page: 1 });
  }

  function onSearchChange(value: string) {
    setDraft(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => commitSearch(value), SEARCH_DEBOUNCE_MS);
  }

  function clearFilters() {
    setDraft("");
    setOwnQ("");
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = null;
    update({ q: "", unread: false, page: 1 }, "push");
  }

  /* ── Opening / closing the sheet (?message=) ─────────────────────── */
  // Opening pushes a history entry so Back closes the sheet; closing then goes back to it.
  const pushedFor = useRef<number | null>(null);
  const focusListOnClose = useRef(false);

  function openMessage(message: Message) {
    focusListOnClose.current = false;
    primeMessage(message, list.dataUpdatedAt);
    pushedFor.current = message.id;
    update({ messageId: message.id }, "push");
  }

  function closeMessage() {
    if (params.messageId !== null && pushedFor.current === params.messageId) {
      pushedFor.current = null;
      window.history.back();
    } else {
      pushedFor.current = null;
      update({ messageId: null });
    }
  }

  // Opening an unread message marks it read, once per opening (marking it unread again while
  // it is open sticks; closing and reopening it marks it read again).
  const autoMarked = useRef<number | null>(null);
  const openMessageData = detail.data;
  useEffect(() => {
    const id = params.messageId;
    if (id === null) {
      autoMarked.current = null;
      return;
    }
    if (!openMessageData || openMessageData.id !== id || autoMarked.current === id) return;
    autoMarked.current = id;
    if (openMessageData.read_at === null) mark({ id, read: true, silent: true });
  }, [params.messageId, openMessageData, mark]);

  /* ── Delete confirmation ────────────────────────────────────────── */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);

  function requestDelete(message: Message) {
    focusListOnClose.current = false;
    setDeleteTarget(message);
    setDeleteOpen(true);
  }

  function onDeleted(message: Message) {
    setDeleteOpen(false);
    // The row (and the button that opened the dialog/sheet) is gone: focus the list instead.
    focusListOnClose.current = true;
    if (params.messageId === message.id) closeMessage();
  }

  function restoreFocus(event: Event) {
    if (!focusListOnClose.current) return;
    event.preventDefault();
    listRef.current?.focus();
  }

  // Cache Components keeps this page mounted (hidden) after navigating away: don't come back
  // to a half-finished confirmation (docs: Preserving UI state → dialogs).
  useLayoutEffect(() => () => setDeleteOpen(false), []);

  /* ── Pagination ─────────────────────────────────────────────────── */
  const lastPage = meta?.last_page;
  const isPlaceholder = list.isPlaceholderData;
  useEffect(() => {
    // Past the end (deleted the last row of the last page, or a stale ?page=): step back.
    if (lastPage !== undefined && !isPlaceholder && params.page > lastPage) {
      update({ page: lastPage });
    }
  }, [lastPage, isPlaceholder, params.page, update]);

  function goToPage(page: number) {
    update({ page }, "push");
    listRef.current?.scrollIntoView({ block: "nearest" });
  }

  /* ── Render ─────────────────────────────────────────────────────── */
  const searching = params.q !== "";
  const filtered = searching || params.unread;
  const unread = unreadCount.data;

  let summary = "";
  if (meta) {
    if (searching) {
      summary = `${plural(meta.total, "result", "results")} for “${params.q}”`;
      if (params.unread) summary += " (unread only)";
    } else if (params.unread) {
      summary = plural(meta.total, "unread message", "unread messages");
    } else {
      summary = plural(meta.total, "message", "messages");
      if (unread !== undefined && meta.total > 0)
        summary += ` · ${numberFormat.format(unread)} unread`;
    }
  }

  let content: ReactNode;
  if (list.isPending || (rows && rows.length === 0 && meta && params.page > meta.last_page)) {
    content = <LoadingState variant="list" rows={6} label="Loading messages…" />;
  } else if (!rows) {
    content = (
      <ErrorState
        title="Couldn't load the messages"
        error={list.error}
        onRetry={() => void list.refetch()}
        retrying={list.isFetching}
      />
    );
  } else if (rows.length === 0) {
    content = searching ? (
      <EmptyState
        icon={SearchXIcon}
        title={`No messages match “${params.q}”`}
        description="The search looks at names, email addresses and message text."
        action={
          <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
            Clear search
          </Button>
        }
      />
    ) : params.unread ? (
      <EmptyState
        icon={MailCheckIcon}
        title="No unread messages"
        description="You're all caught up."
        action={
          <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
            Show all messages
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={InboxIcon}
        title="No messages yet"
        description="Messages sent through the Contact chapter of the site show up here."
      />
    );
  } else {
    content = (
      <MessageList
        rows={rows}
        activeId={params.messageId}
        onOpen={openMessage}
        onToggleRead={(message) => mark({ id: message.id, read: message.read_at === null })}
        onDelete={requestDelete}
        stale={isPlaceholder}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <form
          role="search"
          className="relative w-full sm:max-w-xs"
          onSubmit={(event) => {
            event.preventDefault();
            commitSearch(draft);
          }}
        >
          <label htmlFor={searchId} className="sr-only">
            Search messages
          </label>
          <SearchIcon
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            id={searchId}
            type="search"
            value={draft}
            maxLength={MESSAGE_SEARCH_MAX}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search name, email or text…"
            className="pl-8"
            autoComplete="off"
          />
        </form>

        <div className="flex items-center gap-2">
          <Switch
            id={unreadId}
            checked={params.unread}
            onCheckedChange={(checked) => update({ unread: checked, page: 1 }, "push")}
          />
          <Label htmlFor={unreadId} className="cursor-pointer">
            Unread only
          </Label>
        </div>

        {filtered ? (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            <XIcon aria-hidden />
            Clear filters
          </Button>
        ) : null}

        <div className="ml-auto flex items-center gap-3">
          <p aria-live="polite" className="text-muted-foreground text-sm tabular-nums">
            {summary}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={list.isFetching}
            onClick={() => {
              void list.refetch();
              void unreadCount.refetch();
            }}
          >
            <RefreshCwIcon className={cn(list.isFetching && "animate-spin")} aria-hidden />
            Refresh
          </Button>
        </div>
      </div>

      {list.isError && rows ? (
        <p role="alert" className="text-destructive text-sm">
          Couldn&apos;t refresh the messages. Showing the last loaded list.
        </p>
      ) : null}

      <div
        ref={listRef}
        tabIndex={-1}
        aria-busy={list.isFetching || undefined}
        className="scroll-mt-4 outline-none"
      >
        {content}
      </div>

      {meta && meta.last_page > 1 && rows && rows.length > 0 ? (
        <nav
          aria-label="Message pages"
          className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-sm"
        >
          <span className="tabular-nums">
            {numberFormat.format((meta.current_page - 1) * meta.per_page + 1)}–
            {numberFormat.format(Math.min(meta.total, meta.current_page * meta.per_page))} of{" "}
            {numberFormat.format(meta.total)}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={params.page <= 1 || list.isFetching}
              onClick={() => goToPage(params.page - 1)}
            >
              <ChevronLeftIcon aria-hidden />
              Newer
            </Button>
            <span className="px-2 tabular-nums">
              Page {meta.current_page} of {meta.last_page}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={params.page >= meta.last_page || list.isFetching}
              onClick={() => goToPage(params.page + 1)}
            >
              Older
              <ChevronRightIcon aria-hidden />
            </Button>
          </div>
        </nav>
      ) : null}

      <MessageSheet
        open={params.messageId !== null}
        message={detail.data}
        isError={detail.isError}
        error={detail.error}
        onRetry={() => void detail.refetch()}
        retrying={detail.isFetching}
        onClose={closeMessage}
        onToggleRead={(message) => mark({ id: message.id, read: message.read_at === null })}
        onDelete={requestDelete}
        onCloseAutoFocus={restoreFocus}
      />

      <DeleteMessageDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        message={deleteTarget}
        onDeleted={onDeleted}
        onCloseAutoFocus={restoreFocus}
      />
    </div>
  );
}
