import type { AdminMedia, Media, MediaUsage } from "@/lib/types";

/** The three upload kinds the API knows (`?type=` filter, replace rule, field rules). */
export type MediaKind = "image" | "video" | "pdf";

export const MEDIA_KINDS: readonly MediaKind[] = ["image", "video", "pdf"];

export const MEDIA_KIND_LABEL: Record<MediaKind, string> = {
  image: "Image",
  video: "Video",
  pdf: "PDF",
};

/** `accept` attribute per kind (mirrors the backend whitelist: no SVG). */
export const MEDIA_ACCEPT: Record<MediaKind, string> = {
  image: "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif",
  video: "video/mp4,video/webm,.mp4,.webm",
  pdf: "application/pdf,.pdf",
};

/** Upload limits from docs/API.md (the server still decides). */
export const MEDIA_MAX_BYTES: Record<MediaKind, number> = {
  image: 8 * 1024 * 1024,
  video: 30 * 1024 * 1024,
  pdf: 10 * 1024 * 1024,
};

export function mediaKind(mime: string | null | undefined): MediaKind | "other" {
  if (!mime) return "other";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  return "other";
}

const EXTENSION_KIND: Record<string, MediaKind> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  webp: "image",
  gif: "image",
  mp4: "video",
  webm: "video",
  pdf: "pdf",
};

/** Kind of a local file before upload, or null when the API would reject its type. */
export function fileKind(file: File): MediaKind | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const byExt = EXTENSION_KIND[ext];
  if (byExt) return byExt;
  const byMime = mediaKind(file.type);
  return byMime === "other" || file.type === "image/svg+xml" ? null : byMime;
}

/** Client-side pre-check; returns an error message or null. */
export function checkFile(file: File, accept?: MediaKind): string | null {
  const kind = fileKind(file);
  if (!kind) return "Unsupported file type (allowed: JPG, PNG, WebP, GIF, MP4, WebM, PDF).";
  if (accept && kind !== accept) return `Only ${MEDIA_KIND_LABEL[accept]} files are allowed here.`;
  if (file.size > MEDIA_MAX_BYTES[kind]) {
    return `Too large: ${MEDIA_KIND_LABEL[kind]} files may be at most ${formatBytes(MEDIA_MAX_BYTES[kind])}.`;
  }
  return null;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

/** Human file name: the admin `original_name`, else the last URL segment. */
export function mediaName(media: Media | AdminMedia): string {
  if ("original_name" in media && media.original_name) return media.original_name;
  try {
    const path = new URL(media.url).pathname;
    return decodeURIComponent(path.split("/").pop() ?? `Media #${media.id}`);
  } catch {
    return `Media #${media.id}`;
  }
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const USAGE_TYPE_LABEL: Record<MediaUsage["type"], string> = {
  project: "Project",
  site: "Profile & Site",
  experience: "Experience",
  skill: "Skill",
  award: "Award",
};

const USAGE_FIELD_LABEL: Record<MediaUsage["field"], string> = {
  cover: "cover",
  gallery: "gallery",
  video: "video",
  boss: "boss sprite",
  og: "OG image",
  avatar: "avatar",
  portrait: "portrait",
  cv: "CV",
  logo: "logo",
  icon: "icon",
  media: "certificate image",
};

/** "Project “Mindlens” — cover" */
export function usageLabel(usage: MediaUsage): string {
  const type = USAGE_TYPE_LABEL[usage.type];
  const name = usage.type === "site" ? "" : ` “${usage.label}”`;
  return `${type}${name} — ${USAGE_FIELD_LABEL[usage.field]}`;
}

/** Admin edit page of the record that uses a file. */
export function usageHref(usage: MediaUsage): string {
  switch (usage.type) {
    case "site":
      return "/admin/site";
    case "project":
      return `/admin/projects/${usage.id}`;
    case "experience":
      return `/admin/experiences/${usage.id}`;
    case "skill":
      return `/admin/skills/${usage.id}`;
    case "award":
      return `/admin/awards/${usage.id}`;
  }
}

/** Reads `used_in` from a 409 body (`{ message, used_in: [...] }`). */
export function usedInFromBody(body: unknown): MediaUsage[] {
  if (body && typeof body === "object" && "used_in" in body) {
    const list = (body as { used_in: unknown }).used_in;
    if (Array.isArray(list)) return list as MediaUsage[];
  }
  return [];
}
