/**
 * Project form model: zod schema mirroring StoreProjectRequest / UpdateProjectRequest
 * (docs/API.md → Projects), API row ⇄ form values, the request body, and the tab layout.
 */
import { z } from "zod";

import {
  BOSS_TIERS,
  DEVICES,
  PROJECT_CATEGORIES,
  PROJECT_KINDS,
  PROJECT_PROGRESS,
  type AdminProject,
  type BossTier,
  type Device,
  type Media,
} from "@/lib/types";

/* ── Tabs ─────────────────────────────────────────────────────────────── */

export const PROJECT_TABS = [
  { id: "basic", label: "Basic" },
  { id: "story", label: "Story" },
  { id: "tech", label: "Tech" },
  { id: "boss", label: "Boss" },
  { id: "media", label: "Media" },
  { id: "links", label: "Links & Preview" },
  { id: "seo", label: "SEO" },
] as const;

export type ProjectTab = (typeof PROJECT_TABS)[number]["id"];

export const PROJECT_TAB_IDS: readonly ProjectTab[] = PROJECT_TABS.map((tab) => tab.id);

const FIELD_TAB: Record<string, ProjectTab> = {
  summary: "story",
  problem: "story",
  solution: "story",
  impact: "story",
  description: "story",
  highlights: "story",
  challenges: "story",
  skill_ids: "tech",
  cover_media_id: "media",
  gallery: "media",
  video_url: "media",
  video_media_id: "media",
  live_url: "links",
  repo_url: "links",
  allow_iframe_preview: "links",
  seo_title: "seo",
  seo_description: "seo",
  og_media_id: "seo",
};

/** Tab that holds a field path ("gallery.2.media_id" → "media"). Unknown paths → "basic". */
export function tabOf(path: string): ProjectTab {
  const root = path.split(".")[0] ?? "";
  if (root.startsWith("boss_")) return "boss";
  return FIELD_TAB[root] ?? "basic";
}

/** The first tab (in tab order) that has an error, or null. */
export function firstTabWithError(paths: readonly string[]): ProjectTab | null {
  const tabs = new Set(paths.map(tabOf));
  return PROJECT_TAB_IDS.find((tab) => tabs.has(tab)) ?? null;
}

/** Friendly names for <FormErrorSummary>. */
export const PROJECT_FIELD_LABELS: Record<string, string> = {
  title: "Title",
  slug: "Slug",
  tagline: "Tagline",
  category: "Category",
  kind: "Kind",
  progress: "Progress",
  status: "Status",
  role: "Role",
  team_size: "Team size",
  year_start: "Start year",
  year_end: "End year",
  accent_color: "Accent colour",
  is_featured: "Featured",
  sort_order: "Sort order",
  summary: "Summary",
  problem: "Problem",
  solution: "Solution",
  impact: "Impact",
  description: "Description",
  highlights: "Highlights",
  challenges: "Challenges",
  skill_ids: "Tech stack",
  boss_enabled: "Boss enabled",
  boss_tier: "Boss tier",
  boss_hp: "Boss HP",
  boss_name: "Boss name",
  boss_media_id: "Boss sprite",
  boss_intro: "Boss intro",
  boss_defeat_text: "Defeat text",
  cover_media_id: "Cover",
  gallery: "Gallery",
  video_url: "YouTube URL",
  video_media_id: "Uploaded video",
  live_url: "Live URL",
  repo_url: "Repository URL",
  allow_iframe_preview: "Live preview",
  seo_title: "SEO title",
  seo_description: "SEO description",
  og_media_id: "OG image",
};

/* ── Rules (same as the Form Requests) ────────────────────────────────── */

/** StoreProjectRequest::SLUG_PATTERN */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** StoreProjectRequest::YOUTUBE_PATTERN */
export const YOUTUBE_PATTERN =
  /^https?:\/\/(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|shorts\/)|youtu\.be\/|(?:www\.)?youtube-nocookie\.com\/embed\/)[A-Za-z0-9_-]{6,}/i;

export const BOSS_HP_MIN = 10;
export const BOSS_HP_MAX = 300;

/** Spec §6.4: a fight should take roughly 3–8 s with the default numbers. */
export const CLEAR_TIME_TARGET_MS = { min: 3000, max: 8000 } as const;

const maxText = (max: number) =>
  z.string().max(max, `Use at most ${max.toLocaleString("en-US")} characters.`);

const nullableText = (max: number) => maxText(max).nullable();

const httpUrl = z
  .url({
    protocol: /^https?$/,
    error: "Enter a full URL starting with http:// or https://.",
  })
  .max(500, "Use at most 500 characters.")
  .nullable();

const year = z
  .number({ error: "Enter a year." })
  .int("Enter a whole year.")
  .min(1990, "Use a year from 1990 to 2100.")
  .max(2100, "Use a year from 1990 to 2100.")
  .nullable();

const mediaId = z.number().int().positive().nullable();

const listItem = maxText(500);

export const gallerySchema = z.object({
  media_id: z.number({ error: "Choose an image." }).int().positive(),
  device: z.enum(DEVICES),
  caption: nullableText(255),
  /** Display only (thumbnail); stripped from the request body. */
  media: z.custom<Media>().optional(),
});

export const projectSchema = z
  .object({
    // Basic
    title: z.string().trim().min(1, "Enter a title.").max(255, "Use at most 255 characters."),
    slug: z
      .string()
      .trim()
      .max(120, "Use at most 120 characters.")
      .refine(
        (value) => value === "" || SLUG_PATTERN.test(value),
        "Use lowercase letters, numbers and single dashes (e.g. my-project).",
      ),
    tagline: nullableText(255),
    category: z.enum(PROJECT_CATEGORIES),
    kind: z.enum(PROJECT_KINDS),
    progress: z.enum(PROJECT_PROGRESS),
    status: z.enum(["draft", "published"]),
    role: nullableText(255),
    team_size: z
      .number({ error: "Enter a number." })
      .int("Enter a whole number.")
      .min(1, "Use 1 to 255.")
      .max(255, "Use 1 to 255.")
      .nullable(),
    year_start: year,
    year_end: year,
    accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a hex colour like #FF4B2B."),
    is_featured: z.boolean(),
    sort_order: z
      .number({ error: "Enter a number." })
      .int("Enter a whole number.")
      .min(0, "Use 0 or more.")
      .max(65535, "Use at most 65535.")
      .nullable(),

    // Story
    summary: nullableText(2000),
    problem: nullableText(16000),
    solution: nullableText(16000),
    impact: nullableText(16000),
    description: nullableText(100000),
    highlights: z.array(listItem).max(50, "At most 50 highlights."),
    challenges: z.array(listItem).max(50, "At most 50 challenges."),

    // Tech
    skill_ids: z.array(z.number().int().positive()).max(50, "At most 50 skills."),

    // Boss
    boss_enabled: z.boolean(),
    boss_tier: z.enum(["minion", "regular", "final"]),
    boss_hp: z
      .number({ error: `Enter the boss HP (${BOSS_HP_MIN}–${BOSS_HP_MAX}).` })
      .int("Enter a whole number.")
      .min(BOSS_HP_MIN, `At least ${BOSS_HP_MIN} HP.`)
      .max(BOSS_HP_MAX, `At most ${BOSS_HP_MAX} HP.`),
    boss_name: nullableText(80),
    boss_media_id: mediaId,
    boss_intro: nullableText(200),
    boss_defeat_text: nullableText(200),

    // Media
    cover_media_id: mediaId,
    gallery: z.array(gallerySchema).max(100, "At most 100 gallery images."),
    video_url: httpUrl.refine(
      (value) => value === null || YOUTUBE_PATTERN.test(value),
      "Use a YouTube link (youtube.com/watch, youtu.be, youtube.com/shorts or youtube-nocookie.com/embed).",
    ),
    video_media_id: mediaId,

    // Links
    live_url: httpUrl,
    repo_url: httpUrl,
    allow_iframe_preview: z.boolean(),

    // SEO
    seo_title: nullableText(255),
    seo_description: nullableText(300),
    og_media_id: mediaId,
  })
  .superRefine(
    (values, ctx) => {
      // Cross-field rules (also checked by the API on the merged row). `when` below runs this even
      // while other fields are invalid, so read the values defensively.
      const summary = typeof values.summary === "string" ? values.summary.trim() : "";
      if (values.status === "published" && summary === "") {
        ctx.addIssue({
          code: "custom",
          path: ["summary"],
          message: "A published project needs a summary.",
        });
      }
      const start = values.year_start;
      const end = values.year_end;
      if (typeof start === "number" && typeof end === "number" && end < start) {
        ctx.addIssue({
          code: "custom",
          path: ["year_end"],
          message: "The end year must be the start year or later.",
        });
      }
    },
    { when: () => true },
  );

export type ProjectFormValues = z.input<typeof projectSchema>;
export type ProjectFormOutput = z.output<typeof projectSchema>;
export type GalleryFormItem = z.input<typeof gallerySchema>;

/* ── Values ⇄ API ─────────────────────────────────────────────────────── */

export const EMPTY_PROJECT: ProjectFormValues = {
  title: "",
  slug: "",
  tagline: null,
  category: "web",
  kind: "personal",
  progress: "shipped",
  status: "draft",
  role: null,
  team_size: null,
  year_start: null,
  year_end: null,
  accent_color: "#FF4B2B",
  is_featured: false,
  sort_order: null,
  summary: null,
  problem: null,
  solution: null,
  impact: null,
  description: null,
  highlights: [],
  challenges: [],
  skill_ids: [],
  boss_enabled: true,
  boss_tier: "regular",
  boss_hp: BOSS_TIERS.regular,
  boss_name: null,
  boss_media_id: null,
  boss_intro: null,
  boss_defeat_text: null,
  cover_media_id: null,
  gallery: [],
  video_url: null,
  video_media_id: null,
  live_url: null,
  repo_url: null,
  allow_iframe_preview: false,
  seo_title: null,
  seo_description: null,
  og_media_id: null,
};

/** API `show` row → form values. */
export function toValues(row: AdminProject): ProjectFormValues {
  return {
    title: row.title,
    slug: row.slug,
    tagline: row.tagline,
    category: row.category,
    kind: row.kind,
    progress: row.progress,
    status: row.status,
    role: row.role,
    team_size: row.team_size,
    year_start: row.year_start,
    year_end: row.year_end,
    accent_color: (row.accent_color || EMPTY_PROJECT.accent_color).toUpperCase(),
    is_featured: row.is_featured,
    sort_order: row.sort_order,
    summary: row.summary,
    problem: row.problem,
    solution: row.solution,
    impact: row.impact,
    description: row.description,
    highlights: [...row.highlights],
    challenges: [...row.challenges],
    skill_ids: [...row.skill_ids],
    boss_enabled: row.boss_enabled,
    boss_tier: row.boss_tier,
    boss_hp: row.boss_hp,
    boss_name: row.boss_name,
    boss_media_id: row.boss_media_id,
    boss_intro: row.boss_intro,
    boss_defeat_text: row.boss_defeat_text,
    cover_media_id: row.cover_media_id,
    gallery: row.gallery.map((item) => ({
      media_id: item.media_id,
      device: item.device,
      caption: item.caption,
      media: item.media,
    })),
    video_url: row.video_url,
    video_media_id: row.video_media_id,
    live_url: row.live_url,
    repo_url: row.repo_url,
    allow_iframe_preview: row.allow_iframe_preview,
    seo_title: row.seo_title,
    seo_description: row.seo_description,
    og_media_id: row.og_media_id,
  };
}

const cleanList = (items: readonly string[]) =>
  items.map((item) => item.trim()).filter((item) => item !== "");

/**
 * Validated values → Store/Update body: every editable column, `skill_ids[]` in reveal order and
 * `gallery[] { media_id, device, caption }` in display order. Blank list items are dropped; an
 * empty slug becomes null (the API generates it from the title).
 */
export function toPayload(values: ProjectFormOutput): Record<string, unknown> {
  const { gallery, slug, highlights, challenges, ...rest } = values;
  return {
    ...rest,
    slug: slug === "" ? null : slug,
    highlights: cleanList(highlights),
    challenges: cleanList(challenges),
    gallery: gallery.map(({ media_id, device, caption }) => ({
      media_id,
      device,
      caption: caption?.trim() ? caption.trim() : null,
    })),
  };
}

/* ── Small helpers ────────────────────────────────────────────────────── */

export const BOSS_TIER_LABEL: Record<BossTier, string> = {
  minion: "Minion",
  regular: "Regular",
  final: "Final",
};

export const DEVICE_LABEL: Record<Device, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

/** Guess a gallery frame from the image shape (portrait → mobile, ~4:3 → tablet, wide → desktop). */
export function guessDevice(media: Pick<Media, "width" | "height">): Device {
  if (!media.width || !media.height) return "desktop";
  const ratio = media.width / media.height;
  if (ratio < 0.8) return "mobile";
  if (ratio < 1.45) return "tablet";
  return "desktop";
}

/** Public URL of a project page. */
export function projectPath(slug: string): string {
  return `/projects/${encodeURIComponent(slug)}`;
}

/** BFF preview route: enables draft mode, then opens the page (drafts included). */
export function previewHref(slug: string): string {
  return `/api/admin/preview?slug=${encodeURIComponent(slug)}`;
}
