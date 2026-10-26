/*
 * Search helpers for the project grid filter (spec §6.2). No "use client": the server builds
 * each card's haystack once (ProjectGrid) and the client island matches the typed query against
 * it with the same normalisation.
 */

import { formatYears, label } from "@/lib/utils";
import type { ProjectSummary } from "@/lib/types";

/** Lower case, no accents ("Café" → "cafe"), single spaces. */
export function normalise(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Everything a visitor might type to find a project: title, tagline, summary, tech, type, … */
export function searchText(project: ProjectSummary): string {
  return normalise(
    [
      project.title,
      project.tagline,
      project.summary,
      project.role,
      label(project.category),
      label(project.kind),
      project.boss.enabled ? project.boss.name : null,
      formatYears(project.year_start, project.year_end),
      ...project.skills.map((skill) => skill.name),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

/** Every word of the query must appear somewhere in the haystack (order does not matter). */
export function matchesQuery(haystack: string, query: string): boolean {
  const words = normalise(query).split(" ").filter(Boolean);
  return words.every((word) => haystack.includes(word));
}
