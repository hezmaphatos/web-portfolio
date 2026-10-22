import { z } from "zod";

import type { AdminSite } from "@/lib/types";

/** API limits (UpdateSiteRequest). */
export const SITE_LIMITS = {
  roles: 20,
  socials: 20,
  stats: 12,
  seoDescription: 300,
  shortBio: 5000,
  longBio: 50000,
} as const;

/** Spec §8: tech_visible_percent defaults to 50. */
export const DEFAULT_TECH_PERCENT = 50;

const tooLong = (max: number) => `Use at most ${max.toLocaleString("en-US")} characters.`;
const text = (max: number) => z.string().max(max, tooLong(max)).nullable();
const required = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max, tooLong(max));
const mediaId = z.number().int().nullable();

const social = z.object({
  label: required(60, "Enter a label."),
  // Laravel's `url` rule needs "scheme://"; links on the public site are http(s) only.
  url: z
    .url({ protocol: /^https?$/, error: "Enter a full URL starting with https://." })
    .max(500, tooLong(500)),
  icon: text(40),
});

const stat = z.object({
  label: required(60, "Enter a label."),
  value: text(30),
  prefix: text(20),
  suffix: text(20),
  /** "projects" → the public site shows the published project count instead of `value`. */
  auto: z.enum(["projects"]).nullable(),
});

/** Mirrors UpdateSiteRequest (every editable column of site_settings). */
export const siteSchema = z.object({
  full_name: required(255, "Enter the full name."),
  nickname: required(60, "Enter the nickname."),
  headline: text(255),
  roles: z
    .array(required(100, "Enter a role or remove it."))
    .max(SITE_LIMITS.roles, `Add at most ${SITE_LIMITS.roles} roles.`),
  tagline: text(255),
  short_bio: text(SITE_LIMITS.shortBio),
  long_bio: text(SITE_LIMITS.longBio),
  location: text(255),
  email: z.email("Enter a valid email address.").max(255, tooLong(255)).nullable(),
  phone: text(50),
  show_phone: z.boolean(),
  socials: z.array(social).max(SITE_LIMITS.socials, `Add at most ${SITE_LIMITS.socials} links.`),
  stats: z.array(stat).max(SITE_LIMITS.stats, `Add at most ${SITE_LIMITS.stats} stats.`),
  avatar_media_id: mediaId,
  portrait_media_id: mediaId,
  cv_media_id: mediaId,
  seo_title: text(255),
  seo_description: text(SITE_LIMITS.seoDescription),
  og_media_id: mediaId,
  sound_default: z.boolean(),
  tech_visible_percent: z
    .number({ error: "Enter a whole number from 0 to 100." })
    .int("Use a whole number.")
    .min(0, "Use a number from 0 to 100.")
    .max(100, "Use a number from 0 to 100."),
});

export type SiteInput = z.input<typeof siteSchema>;
export type SiteOutput = z.output<typeof siteSchema>;
export type StatInput = SiteInput["stats"][number];
export type SocialInput = SiteInput["socials"][number];

/** "" (how the API returns empty prefix/suffix/value) → null, so untouched fields stay clean. */
const orNull = (value: string | null | undefined) => (value ? value : null);

/** API record → form values. */
export function toSiteValues(site: AdminSite): SiteInput {
  return {
    full_name: site.full_name,
    nickname: site.nickname,
    headline: site.headline,
    roles: [...site.roles],
    tagline: site.tagline,
    short_bio: site.short_bio,
    long_bio: site.long_bio,
    location: site.location,
    email: site.email,
    phone: site.phone,
    show_phone: site.show_phone,
    socials: site.socials.map((item) => ({
      label: item.label,
      url: item.url,
      icon: orNull(item.icon),
    })),
    stats: site.stats.map((item) => ({
      label: item.label,
      value: orNull(item.value),
      prefix: orNull(item.prefix),
      suffix: orNull(item.suffix),
      auto: item.auto === "projects" ? "projects" : null,
    })),
    avatar_media_id: site.avatar_media_id,
    portrait_media_id: site.portrait_media_id,
    cv_media_id: site.cv_media_id,
    seo_title: site.seo_title,
    seo_description: site.seo_description,
    og_media_id: site.og_media_id,
    sound_default: site.sound_default,
    tech_visible_percent: site.tech_visible_percent,
  };
}

export const NEW_SOCIAL = (): SocialInput => ({ label: "", url: "", icon: null });
export const NEW_STAT = (): StatInput => ({
  label: "",
  value: null,
  prefix: null,
  suffix: null,
  auto: null,
});

/** Friendly names for <FormErrorSummary>. */
export const SITE_FIELD_LABELS: Record<string, string> = {
  full_name: "Full name",
  nickname: "Nickname",
  short_bio: "Short bio",
  long_bio: "Long bio",
  show_phone: "Show phone",
  avatar_media_id: "Avatar",
  portrait_media_id: "Portrait",
  cv_media_id: "CV",
  seo_title: "SEO title",
  seo_description: "SEO description",
  og_media_id: "OG image",
  sound_default: "Sound on by default",
  tech_visible_percent: "Visible tech",
  socials: "Social links",
  stats: "Stats",
  roles: "Roles",
};
