import type { Message } from "@/lib/types";

const timeFormat = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const dateFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const fullFormat = new Intl.DateTimeFormat("en", { dateStyle: "full", timeStyle: "short" });
const shortFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

function parse(iso: string | null): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Inbox column: time for today, "Oct 21" this year, "Oct 21, 2025" before. Client-only. */
export function formatListDate(iso: string | null): string {
  const date = parse(iso);
  if (!date) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return timeFormat.format(date);
  if (date.getFullYear() === now.getFullYear()) return dayFormat.format(date);
  return dateFormat.format(date);
}

/** "Wednesday, October 21, 2026 at 2:05 PM" */
export function formatFullDate(iso: string | null): string {
  const date = parse(iso);
  return date ? fullFormat.format(date) : "Unknown date";
}

/** "Oct 21, 2026, 2:05 PM" */
export function formatShortDate(iso: string | null): string {
  const date = parse(iso);
  return date ? shortFormat.format(date) : "";
}

/** One-line preview; also keeps the row button's accessible name short. */
export function snippet(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

const QUOTE_MAX = 1200;

/**
 * "Reply via email": `mailto:` with the subject "Re: your message" and the original quoted
 * below an empty first line. The quote is capped so the URL stays short enough for mail apps.
 */
export function replyHref(message: Pick<Message, "email" | "name" | "message" | "created_at">) {
  const original =
    message.message.length > QUOTE_MAX
      ? `${message.message.slice(0, QUOTE_MAX).trimEnd()}…`
      : message.message;
  const quoted = original
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");
  const body = `\n\nOn ${formatShortDate(message.created_at)}, ${message.name} wrote:\n${quoted}`;

  // Percent-encode the address too ("+", "%", "?" or "#" in a local part would break the URL),
  // but keep "@" readable; mail apps decode both.
  const to = encodeURIComponent(message.email).replace(/%40/g, "@");
  const query = `subject=${encodeURIComponent("Re: your message")}&body=${encodeURIComponent(body)}`;
  return `mailto:${to}?${query}`;
}
