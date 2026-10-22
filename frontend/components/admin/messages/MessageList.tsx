"use client";

import { MailIcon, MailOpenIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

import { formatFullDate, formatListDate, snippet } from "./format";

type MessageListProps = {
  rows: Message[];
  /** The message open in the sheet (highlighted). */
  activeId: number | null;
  onOpen: (message: Message) => void;
  onToggleRead: (message: Message) => void;
  onDelete: (message: Message) => void;
  /** Dims the list while another page/filter loads (keepPreviousData). */
  stale?: boolean;
};

/**
 * Inbox rows, newest first. The row body is one button (opens the message); read/unread and
 * delete are separate buttons beside it, so no interactive element is nested in another.
 */
export function MessageList({
  rows,
  activeId,
  onOpen,
  onToggleRead,
  onDelete,
  stale = false,
}: MessageListProps) {
  return (
    <ul
      aria-label="Messages"
      className={cn(
        "bg-card divide-y overflow-hidden rounded-lg border transition-opacity",
        stale && "opacity-60",
      )}
    >
      {rows.map((message) => {
        const unread = message.read_at === null;
        const active = message.id === activeId;
        const who = message.name || message.email;

        return (
          <li
            key={message.id}
            data-unread={unread || undefined}
            className={cn(
              "flex items-stretch transition-colors",
              active ? "bg-muted" : unread ? "bg-background" : "bg-muted/30",
              !active && "hover:bg-muted/60",
            )}
          >
            <button
              type="button"
              onClick={() => onOpen(message)}
              className="focus-visible:ring-ring/50 flex min-w-0 flex-1 items-start gap-3 rounded-md py-3 pr-2 pl-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-inset sm:pl-4"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  unread ? "bg-primary" : "bg-transparent",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="sr-only">
                    {unread ? "Unread message from " : "Message from "}
                  </span>
                  <span
                    className={cn(
                      "truncate",
                      unread ? "text-foreground font-semibold" : "text-foreground/80 font-normal",
                    )}
                  >
                    {who}
                  </span>
                  <span className="text-muted-foreground hidden min-w-0 truncate text-xs sm:inline">
                    {message.email}
                  </span>
                  <time
                    dateTime={message.created_at}
                    title={formatFullDate(message.created_at)}
                    className={cn(
                      "ml-auto shrink-0 text-xs tabular-nums",
                      unread ? "text-foreground font-medium" : "text-muted-foreground",
                    )}
                  >
                    <span className="sr-only">, received </span>
                    {formatListDate(message.created_at)}
                  </time>
                </span>
                <span
                  className={cn(
                    "mt-0.5 line-clamp-2 text-sm break-words",
                    unread ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span className="sr-only">: </span>
                  {snippet(message.message)}
                </span>
              </span>
            </button>

            <div className="flex shrink-0 items-center gap-0.5 pr-2 sm:pr-3">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title={unread ? "Mark as read" : "Mark as unread"}
                onClick={() => onToggleRead(message)}
              >
                {unread ? <MailOpenIcon aria-hidden /> : <MailIcon aria-hidden />}
                <span className="sr-only">
                  {unread ? "Mark as read" : "Mark as unread"}: message from {who}
                </span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="Delete"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(message)}
              >
                <Trash2Icon aria-hidden />
                <span className="sr-only">Delete message from {who}</span>
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
