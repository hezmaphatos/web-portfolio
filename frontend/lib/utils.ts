import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { HomePayload, Section, SectionKey } from "@/lib/types";

/** Joins class names and resolves conflicting Tailwind utilities (last one wins). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-01-01" → "Jan 2026". Parsed by hand: no timezone shifts between server and browser. */
export function formatMonth(date: string): string {
  const [y, m] = date.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1] ?? ""} ${y}`.trim();
}

/** "Jan 2026 – Jul 2026", "May 2025 – Present", or a single month when start and end match. */
export function formatPeriod(start: string, end: string | null): string {
  const from = formatMonth(start);
  if (end === null) return `${from} – Present`;
  const to = formatMonth(end);
  return from === to ? from : `${from} – ${to}`;
}

/** Project years: "2026", "2024–2026", "2025–now", or null. */
export function formatYears(start: number | null, end: number | null): string | null {
  if (start === null && end === null) return null;
  if (start !== null && end !== null && end !== start) return `${start}–${end}`;
  return String(start ?? end);
}

/** Visible sections by key (hidden chapters are not in the payload). */
export function sectionsByKey(home: HomePayload): Partial<Record<SectionKey, Section>> {
  return Object.fromEntries(home.sections.map((s) => [s.key, s]));
}

/** Two-digit chapter number for headings ("02"). */
export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Human labels for API enums shown on the site. */
export const LABELS: Record<string, string> = {
  web: "Web",
  mobile: "Mobile",
  ml: "Machine learning",
  game: "Game",
  other: "Other",
  personal: "Personal",
  team: "Team",
  internship: "Internship",
  client: "Client",
  community: "Community",
  shipped: "Shipped",
  in_progress: "In progress",
  archived: "Archived",
  work: "Work",
  freelance: "Freelance",
  organization: "Organization",
  education: "Education",
  backend: "Backend",
  frontend: "Frontend",
  database: "Database",
  design: "Design",
  soft: "Soft skills",
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
  finalist: "Finalist",
  participant: "Participant",
  minion: "Minion",
  regular: "Regular",
  final: "Final boss",
};

export function label(value: string): string {
  return LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}
