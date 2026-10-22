import type { SectionKey } from "@/lib/types";

/** Admin page that holds a chapter's content (everything except the section texts). */
type ContentSource = { href: string; label: string };

export type ChapterInfo = {
  /** What the chapter is on the home page (spec §4.1). */
  summary: string;
  /** Where its content is edited, besides this section record. */
  sources: readonly ContentSource[];
};

const SITE: ContentSource = { href: "/admin/site", label: "Profile & Site" };

/** The eight fixed home-page chapters (spec §4.1), keyed like the `sections` table. */
export const CHAPTERS: Record<SectionKey, ChapterInfo> = {
  boot: { summary: "Splash screen: loading bar, tips and PRESS START.", sources: [SITE] },
  hero: { summary: "Name, nickname, rotating roles and tagline.", sources: [SITE] },
  about: { summary: "Portrait card, bio, stat counters and the CV download.", sources: [SITE] },
  journey: {
    summary: "Experience timeline with filters.",
    sources: [{ href: "/admin/experiences", label: "Experiences" }],
  },
  skills: {
    summary: "Skill tree, inventory, 4-slot loadout and training dummy.",
    sources: [{ href: "/admin/skills", label: "Skills" }],
  },
  projects: {
    summary: "Featured showcase and the project grid; every project is a boss.",
    sources: [{ href: "/admin/projects", label: "Projects" }],
  },
  trophies: {
    summary: "Award shelf with certificate details.",
    sources: [{ href: "/admin/awards", label: "Awards" }],
  },
  contact: {
    summary: "Contact form, email copy and social links.",
    sources: [SITE, { href: "/admin/messages", label: "Messages" }],
  },
};

export function chapterInfo(key: string): ChapterInfo | null {
  return Object.hasOwn(CHAPTERS, key) ? CHAPTERS[key as SectionKey] : null;
}

/** API `hint` limit (UpdateSectionRequest). */
export const HINT_MAX = 300;
/** API `body` limit. */
export const BODY_MAX = 5000;
