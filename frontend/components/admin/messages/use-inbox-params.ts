"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { MESSAGE_SEARCH_MAX } from "./message-queries";

export type InboxParams = {
  /** `?unread=1` (the dashboard's Unread tile links here). */
  unread: boolean;
  /** `?q=` server-side search on name, email and message. */
  q: string;
  /** `?page=` 1-based. */
  page: number;
  /** `?message=<id>`: the message open in the side sheet. */
  messageId: number | null;
};

export type InboxPatch = Partial<InboxParams>;

/** The `?q=` value as the URL keeps it (and as the API accepts it): trimmed, ≤ 190 chars. */
export function normalizeQuery(value: string): string {
  return value.trim().slice(0, MESSAGE_SEARCH_MAX);
}

function positiveInt(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * Inbox view state lives in the URL, so it survives reloads, can be linked to and resets when
 * the page is reached through a plain /admin/messages link (Cache Components keeps the page
 * mounted in <Activity>, so component state alone would come back stale).
 *
 * Updates use the native History API, which the App Router syncs into `useSearchParams` without
 * a server round trip (docs: Linking and Navigating → Native History API).
 */
export function useInboxParams(): [
  InboxParams,
  (patch: InboxPatch, mode?: "push" | "replace") => void,
] {
  const searchParams = useSearchParams();

  const flag = searchParams.get("unread");
  const params: InboxParams = {
    unread: flag === "1" || flag === "true",
    q: normalizeQuery(searchParams.get("q") ?? ""),
    page: positiveInt(searchParams.get("page")) ?? 1,
    messageId: positiveInt(searchParams.get("message")),
  };

  const update = useCallback((patch: InboxPatch, mode: "push" | "replace" = "replace") => {
    // Read the live URL, not the render snapshot: two updates may land before a re-render.
    const next = new URLSearchParams(window.location.search);
    const set = (key: string, value: string | null) =>
      value === null ? next.delete(key) : next.set(key, value);

    if (patch.unread !== undefined) set("unread", patch.unread ? "1" : null);
    if (patch.q !== undefined) {
      const q = normalizeQuery(patch.q);
      set("q", q === "" ? null : q);
    }
    if (patch.page !== undefined) set("page", patch.page > 1 ? String(patch.page) : null);
    if (patch.messageId !== undefined) {
      set("message", patch.messageId === null ? null : String(patch.messageId));
    }

    const qs = next.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    if (url === `${window.location.pathname}${window.location.search}`) return;
    if (mode === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }, []);

  return [params, update];
}
