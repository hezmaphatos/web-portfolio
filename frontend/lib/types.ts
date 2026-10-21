/**
 * API response shapes — mirror of docs/API.md. Change both together.
 */

// ── Shared ─────────────────────────────────────────────────────────────

export type Media = {
  id: number;
  url: string;
  thumb_url: string | null;
  mime: string;
  width: number | null;
  height: number | null;
  alt: string | null;
  blur_data_url: string | null;
  dominant_color: string | null;
};

export type MediaUsage = {
  type: "project" | "site" | "experience" | "skill" | "award";
  id: number;
  label: string;
  field:
    | "cover"
    | "gallery"
    | "video"
    | "boss"
    | "og"
    | "avatar"
    | "portrait"
    | "cv"
    | "logo"
    | "icon"
    | "media";
};

export type AdminMedia = Media & {
  has_original: boolean;
  original_name: string;
  size: number;
  created_at: string;
  updated_at: string;
  used_in?: MediaUsage[];
};

export type PaginationMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export type Paginated<T> = { data: T[]; meta: PaginationMeta };

export const SECTION_KEYS = [
  "boot",
  "hero",
  "about",
  "journey",
  "skills",
  "projects",
  "trophies",
  "contact",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const SKILL_CATEGORIES = [
  "backend",
  "frontend",
  "mobile",
  "database",
  "design",
  "ml",
  "game",
  "soft",
] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];
export type SkillStatus = "core" | "learning";

export const PROJECT_CATEGORIES = ["web", "mobile", "ml", "game", "other"] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];
export const PROJECT_KINDS = ["personal", "team", "internship", "client", "community"] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];
export const PROJECT_PROGRESS = ["shipped", "in_progress", "archived"] as const;
export type ProjectProgress = (typeof PROJECT_PROGRESS)[number];
export type ProjectStatus = "draft" | "published";
export const DEVICES = ["desktop", "tablet", "mobile"] as const;
export type Device = (typeof DEVICES)[number];

export const BOSS_TIERS = { minion: 50, regular: 100, final: 150 } as const;
export type BossTier = keyof typeof BOSS_TIERS;

export const EXPERIENCE_TYPES = [
  "work",
  "internship",
  "freelance",
  "organization",
  "education",
] as const;
export type ExperienceType = (typeof EXPERIENCE_TYPES)[number];

export const AWARD_PLACEMENTS = ["gold", "silver", "bronze", "finalist", "participant"] as const;
export type AwardPlacement = (typeof AWARD_PLACEMENTS)[number];

// ── Public ─────────────────────────────────────────────────────────────

export type Social = { label: string; url: string; icon: string | null };

export type Stat = {
  label: string;
  value: string;
  prefix: string | null;
  suffix: string | null;
  /** "projects" → value is the published project count, computed by the API. */
  auto: "projects" | null;
};

export type Metric = { label: string; value: number; prefix: string | null; suffix: string | null };

export type Site = {
  full_name: string;
  nickname: string;
  headline: string | null;
  roles: string[];
  tagline: string | null;
  short_bio: string | null;
  long_bio: string | null;
  location: string | null;
  email: string | null;
  phone: string | null;
  socials: Social[];
  stats: Stat[];
  soft_skills: string[];
  avatar: Media | null;
  portrait: Media | null;
  cv: Media | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image: Media | null;
  sound_default: boolean;
  tech_visible_percent: number;
};

export type Section = {
  key: SectionKey;
  title: string;
  subtitle: string | null;
  body: string | null;
  hint: string | null;
  sort_order: number;
};

export type Experience = {
  id: number;
  type: ExperienceType;
  title: string;
  organization: string;
  location: string | null;
  subtitle: string | null;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  bullets: string[];
  metrics: Metric[];
  logo: Media | null;
  sort_order: number;
};

export type Skill = {
  id: number;
  name: string;
  slug: string;
  category: SkillCategory;
  level: number;
  status: SkillStatus;
  icon_key: string | null;
  icon: Media | null;
  description: string | null;
  attack_name: string | null;
  damage: number | null;
  cooldown_ms: number | null;
  sort_order: number;
};

export type SkillRef = Pick<Skill, "id" | "name" | "slug" | "category" | "level" | "icon_key">;

export type Boss = {
  enabled: boolean;
  tier: BossTier;
  name: string;
  hp: number;
  sprite: Media | null;
  intro: string | null;
  defeat_text: string | null;
};

export type ProjectSummary = {
  id: number;
  slug: string;
  title: string;
  tagline: string | null;
  summary: string | null;
  category: ProjectCategory;
  kind: ProjectKind;
  progress: ProjectProgress;
  role: string | null;
  team_size: number | null;
  year_start: number | null;
  year_end: number | null;
  accent_color: string;
  is_featured: boolean;
  sort_order: number;
  cover: Media | null;
  hover_image: Media | null;
  hover_video: Media | null;
  peek: Media[];
  gallery_count: number;
  skills: SkillRef[];
  boss: Boss;
  live_url: string | null;
  repo_url: string | null;
  allow_iframe_preview: boolean;
  has_video: boolean;
};

export type GalleryImage = Media & { device: Device; caption: string | null };

export type ProjectLink = { slug: string; title: string; accent_color: string };

export type ProjectDetail = ProjectSummary & {
  status: ProjectStatus;
  problem: string | null;
  solution: string | null;
  impact: string | null;
  description: string | null;
  highlights: string[];
  challenges: string[];
  video_url: string | null;
  video: Media | null;
  gallery: GalleryImage[];
  seo_title: string | null;
  seo_description: string | null;
  og_image: Media | null;
  prev: ProjectLink | null;
  next: ProjectLink | null;
};

export type Award = {
  id: number;
  title: string;
  event: string;
  issuer: string | null;
  year: number | null;
  placement: AwardPlacement;
  category: string | null;
  description: string | null;
  image: Media | null;
  url: string | null;
  sort_order: number;
};

export type HomePayload = {
  site: Site;
  sections: Section[];
  experiences: Experience[];
  skills: Skill[];
  projects: ProjectSummary[];
  awards: Award[];
};

export type ContactInput = { name: string; email: string; message: string; website: string };

// ── Admin ──────────────────────────────────────────────────────────────

export type AdminUser = { id: number; name: string; email: string };

type Timestamps = { created_at: string; updated_at: string };

export type AdminSite = Omit<Site, "soft_skills" | "phone"> & {
  id: number;
  phone: string | null;
  show_phone: boolean;
  avatar_media_id: number | null;
  portrait_media_id: number | null;
  cv_media_id: number | null;
  og_media_id: number | null;
} & Timestamps;

export type AdminSection = Section & { id: number; is_visible: boolean } & Timestamps;

export type AdminExperience = Experience & {
  is_visible: boolean;
  logo_media_id: number | null;
} & Timestamps;

export type AdminSkill = Skill & {
  is_visible: boolean;
  icon_media_id: number | null;
  projects_count: number;
  dps: number | null;
  dps_warning: "strong" | "weak" | null;
} & Timestamps;

export type AdminProjectRow = {
  id: number;
  slug: string;
  title: string;
  status: ProjectStatus;
  category: ProjectCategory;
  kind: ProjectKind;
  is_featured: boolean;
  accent_color: string;
  cover: Media | null;
  skills_count: number;
  gallery_count: number;
  boss_enabled: boolean;
  boss_tier: BossTier;
  boss_hp: number;
  view_count: number;
  defeat_count: number;
  sort_order: number;
  updated_at: string;
};

export type AdminGalleryItem = {
  media_id: number;
  device: Device;
  caption: string | null;
  media: Media;
};

export type AdminProject = {
  id: number;
  slug: string;
  title: string;
  tagline: string | null;
  category: ProjectCategory;
  kind: ProjectKind;
  progress: ProjectProgress;
  status: ProjectStatus;
  role: string | null;
  team_size: number | null;
  year_start: number | null;
  year_end: number | null;
  accent_color: string;
  is_featured: boolean;
  sort_order: number;
  summary: string | null;
  problem: string | null;
  solution: string | null;
  impact: string | null;
  description: string | null;
  highlights: string[];
  challenges: string[];
  skill_ids: number[];
  skills: SkillRef[];
  boss_enabled: boolean;
  boss_tier: BossTier;
  boss_hp: number;
  boss_name: string | null;
  boss_media_id: number | null;
  boss_sprite: Media | null;
  boss_intro: string | null;
  boss_defeat_text: string | null;
  cover_media_id: number | null;
  cover: Media | null;
  gallery: AdminGalleryItem[];
  video_url: string | null;
  video_media_id: number | null;
  video: Media | null;
  live_url: string | null;
  repo_url: string | null;
  allow_iframe_preview: boolean;
  seo_title: string | null;
  seo_description: string | null;
  og_media_id: number | null;
  og_image: Media | null;
  view_count: number;
  defeat_count: number;
} & Timestamps;

export type AdminAward = Award & { is_visible: boolean; media_id: number | null } & Timestamps;

export type Message = {
  id: number;
  name: string;
  email: string;
  message: string;
  read_at: string | null;
  created_at: string;
};

export type Dashboard = {
  counts: {
    projects: number;
    published_projects: number;
    skills: number;
    messages: number;
    unread_messages: number;
    experiences: number;
    awards: number;
    media: number;
  };
  latest_messages: Message[];
  most_viewed: { id: number; slug: string; title: string; view_count: number }[];
  most_defeated: { id: number; slug: string; title: string; defeat_count: number }[];
};

export type ReorderItem = { id: number; sort_order: number };

/** 422 body. */
export type ValidationErrors = Record<string, string[]>;
