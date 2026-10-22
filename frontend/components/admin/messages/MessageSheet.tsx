"use client";

import { useRef, useState, type Ref } from "react";
import { CopyIcon, MailIcon, MailOpenIcon, ReplyIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { ErrorState } from "@/components/admin/shell/ErrorState";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/admin/ui/sheet";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { ApiError } from "@/lib/admin/api";
import type { Message } from "@/lib/types";

import { formatFullDate, formatShortDate, replyHref } from "./format";

type MessageSheetProps = {
  open: boolean;
  /** The open message (undefined while a deep-linked one loads). */
  message: Message | undefined;
  error: unknown;
  isError: boolean;
  onRetry: () => void;
  retrying: boolean;
  onClose: () => void;
  onToggleRead: (message: Message) => void;
  onDelete: (message: Message) => void;
  /** Lets the inbox move focus elsewhere when the trigger row is gone (after a delete). */
  onCloseAutoFocus?: (event: Event) => void;
};

/** Side sheet with the whole message: sender, email, date, text and the inbox actions. */
export function MessageSheet({
  open,
  message,
  error,
  isError,
  onRetry,
  retrying,
  onClose,
  onToggleRead,
  onDelete,
  onCloseAutoFocus,
}: MessageSheetProps) {
  const replyRef = useRef<HTMLAnchorElement>(null);
  // Keep the last message on screen while the sheet slides out (the URL is already cleared).
  const [shown, setShown] = useState(message);
  if (message !== undefined && message !== shown) setShown(message);
  const current = open ? message : shown;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
        onOpenAutoFocus={(event) => {
          // Start on the main action instead of the first link in the header.
          if (replyRef.current) {
            event.preventDefault();
            replyRef.current.focus();
          }
        }}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {current ? (
          <MessageDetail
            message={current}
            replyRef={replyRef}
            onToggleRead={onToggleRead}
            onDelete={onDelete}
          />
        ) : isError ? (
          <>
            <SheetHeader className="border-b pr-12">
              <SheetTitle>Message unavailable</SheetTitle>
              <SheetDescription className="sr-only">
                The message could not be loaded.
              </SheetDescription>
            </SheetHeader>
            <div className="p-4">
              {error instanceof ApiError && error.status === 404 ? (
                <ErrorState
                  title="Message not found"
                  message="It may have been deleted."
                  className="py-8"
                />
              ) : (
                <ErrorState
                  title="Couldn't load the message"
                  error={error}
                  onRetry={onRetry}
                  retrying={retrying}
                  className="py-8"
                />
              )}
            </div>
          </>
        ) : (
          <div role="status" className="flex flex-col">
            <SheetHeader className="border-b pr-12">
              <SheetTitle className="sr-only">Loading message…</SheetTitle>
              <SheetDescription className="sr-only">Please wait.</SheetDescription>
              <Skeleton aria-hidden className="h-5 w-40" />
              <Skeleton aria-hidden className="mt-2 h-4 w-56" />
            </SheetHeader>
            <div aria-hidden className="space-y-2 p-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MessageDetail({
  message,
  replyRef,
  onToggleRead,
  onDelete,
}: {
  message: Message;
  replyRef: Ref<HTMLAnchorElement>;
  onToggleRead: (message: Message) => void;
  onDelete: (message: Message) => void;
}) {
  const unread = message.read_at === null;

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(message.email);
      toast.success("Email address copied");
    } catch {
      toast.error("Could not copy the email address");
    }
  }

  return (
    <>
      <SheetHeader className="gap-1.5 border-b pr-12">
        <div className="flex items-center gap-2">
          <Badge variant={unread ? "default" : "secondary"}>{unread ? "Unread" : "Read"}</Badge>
          {!unread && message.read_at ? (
            <span className="text-muted-foreground text-xs">
              Opened {formatShortDate(message.read_at)}
            </span>
          ) : null}
        </div>
        <SheetTitle className="text-lg leading-snug font-semibold break-words">
          {message.name || message.email}
        </SheetTitle>
        <SheetDescription>
          Received{" "}
          <time dateTime={message.created_at} className="text-foreground">
            {formatFullDate(message.created_at)}
          </time>
        </SheetDescription>
      </SheetHeader>

      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 border-b px-4 py-3 text-sm">
        <dt className="text-muted-foreground">Name</dt>
        <dd className="min-w-0 break-words">{message.name}</dd>
        <dt className="text-muted-foreground">Email</dt>
        <dd className="flex min-w-0 items-center gap-1">
          <a
            href={`mailto:${encodeURIComponent(message.email).replace(/%40/g, "@")}`}
            className="focus-visible:ring-ring/50 min-w-0 truncate rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3"
          >
            {message.email}
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Copy email address"
            onClick={() => void copyEmail()}
          >
            <CopyIcon aria-hidden />
            <span className="sr-only">Copy email address</span>
          </Button>
        </dd>
      </dl>

      <section aria-label="Message" className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{message.message}</p>
      </section>

      <SheetFooter className="flex-row flex-wrap items-center gap-2 border-t">
        <Button
          type="button"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive mr-auto"
          onClick={() => onDelete(message)}
        >
          <Trash2Icon aria-hidden />
          Delete
        </Button>
        <Button type="button" variant="outline" onClick={() => onToggleRead(message)}>
          {unread ? <MailOpenIcon aria-hidden /> : <MailIcon aria-hidden />}
          {unread ? "Mark as read" : "Mark as unread"}
        </Button>
        <Button asChild>
          <a ref={replyRef} href={replyHref(message)}>
            <ReplyIcon aria-hidden />
            Reply via email
          </a>
        </Button>
      </SheetFooter>
    </>
  );
}
