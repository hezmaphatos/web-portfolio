/**
 * Skill form: zod schema mirroring StoreSkillRequest / UpdateSkillRequest (docs/API.md → Skills),
 * the row ↔ form value mapping, and the DPS helpers shared by the table and the form.
 */
import { z } from "zod";

import { dps } from "@/lib/battle";
import { SKILL_CATEGORIES, type AdminSkill, type SkillCategory } from "@/lib/types";

/* ── Game number limits (spec §6.4 / §8, same as the Form Requests) ───── */

export const DAMAGE_MIN = 25;
export const DAMAGE_MAX = 70;
export const COOLDOWN_MIN_MS = 1000;
export const COOLDOWN_MAX_MS = 4000;
export const COOLDOWN_STEP_MS = 500;

/** DPS guideline thresholds; same numbers as SkillService::DPS_WEAK / DPS_STRONG. */
export const DPS_WEAK = 15;
export const DPS_STRONG = 30;

/** Starting numbers for a new game skill: DPS 20, inside the guideline. */
export const NEW_SKILL_DAMAGE = 40;
export const NEW_SKILL_COOLDOWN_MS = 2000;

export const SOFT: SkillCategory = "soft";

export const SKILL_STATUSES = ["core", "learning"] as const;

export const CATEGORY_LABEL: Record<SkillCategory, string> = {
  backend: "Backend",
  frontend: "Frontend",
  mobile: "Mobile",
  database: "Database",
  design: "Design",
  ml: "ML",
  game: "Game",
  soft: "Soft skill",
};

export const CATEGORY_OPTIONS = SKILL_CATEGORIES.map((value) => ({
  value,
  label: CATEGORY_LABEL[value],
}));

export const STATUS_OPTIONS = [
  { value: "core", label: "Core" },
  { value: "learning", label: "Learning" },
];

export const LEVEL_OPTIONS = [1, 2, 3, 4, 5].map((value) => ({
  value,
  label: `Level ${value}`,
}));

/* ── DPS ──────────────────────────────────────────────────────────────── */

export type DpsWarning = AdminSkill["dps_warning"];

/** Damage per second rounded to 1 decimal like the API (`dps`); null without usable numbers. */
export function skillDps(
  damage: number | null | undefined,
  cooldownMs: number | null | undefined,
): number | null {
  if (typeof damage !== "number" || typeof cooldownMs !== "number") return null;
  if (!(damage > 0) || !(cooldownMs > 0)) return null;
  return Math.round(dps({ damage, cooldown_ms: cooldownMs }) * 10) / 10;
}

/** Same rule as the API's `dps_warning`: "strong" above 30, "weak" below 15. */
export function dpsWarning(value: number | null): DpsWarning {
  if (value === null) return null;
  if (value > DPS_STRONG) return "strong";
  if (value < DPS_WEAK) return "weak";
  return null;
}

/** "1.5" / "4" (seconds, at most 1 decimal: cooldowns are multiples of 0.5 s). */
export function formatSeconds(ms: number): string {
  return String(Math.round(ms / 100) / 10);
}

/* ── Schema ───────────────────────────────────────────────────────────── */

const SLUG = /^[a-z0-9_-]*$/;

export const skillSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name.").max(80, "Use at most 80 characters."),
    /** Empty → the API generates it from the name. */
    slug: z
      .string()
      .trim()
      .max(100, "Use at most 100 characters.")
      .regex(SLUG, "Use lowercase letters, numbers, dashes and underscores."),
    category: z.enum(SKILL_CATEGORIES, { error: "Choose a category." }),
    level: z
      .number({ error: "Choose a level." })
      .int()
      .min(1, "Level is 1 to 5.")
      .max(5, "Level is 1 to 5."),
    status: z.enum(SKILL_STATUSES, { error: "Choose a status." }),
    icon_key: z.string().trim().max(50, "Use at most 50 characters.").nullable(),
    icon_media_id: z.number().int().nullable(),
    description: z.string().max(5000, "Use at most 5,000 characters.").nullable(),
    // Game fields: required and range-checked below unless the category is soft.
    attack_name: z.string().nullable(),
    damage: z.number().nullable(),
    cooldown_ms: z.number().nullable(),
    is_visible: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.category === SOFT) return;

    const attack = values.attack_name?.trim() ?? "";
    if (attack === "") {
      ctx.addIssue({ code: "custom", path: ["attack_name"], message: "Enter an attack name." });
    } else if (attack.length > 60) {
      ctx.addIssue({
        code: "custom",
        path: ["attack_name"],
        message: "Use at most 60 characters.",
      });
    }

    const { damage } = values;
    if (damage === null) {
      ctx.addIssue({ code: "custom", path: ["damage"], message: "Enter the damage." });
    } else if (!Number.isInteger(damage)) {
      ctx.addIssue({ code: "custom", path: ["damage"], message: "Use a whole number." });
    } else if (damage < DAMAGE_MIN || damage > DAMAGE_MAX) {
      ctx.addIssue({
        code: "custom",
        path: ["damage"],
        message: `Damage is ${DAMAGE_MIN} to ${DAMAGE_MAX}.`,
      });
    }

    const cooldown = values.cooldown_ms;
    if (cooldown === null) {
      ctx.addIssue({ code: "custom", path: ["cooldown_ms"], message: "Enter the cooldown." });
    } else if (cooldown < COOLDOWN_MIN_MS || cooldown > COOLDOWN_MAX_MS) {
      ctx.addIssue({
        code: "custom",
        path: ["cooldown_ms"],
        message: "Cooldown is 1 to 4 seconds.",
      });
    } else if (cooldown % COOLDOWN_STEP_MS !== 0) {
      ctx.addIssue({
        code: "custom",
        path: ["cooldown_ms"],
        message: "Use steps of 0.5 seconds (1, 1.5, 2 … 4).",
      });
    }
  });

export type SkillFormInput = z.input<typeof skillSchema>;
export type SkillFormOutput = z.output<typeof skillSchema>;

export const EMPTY_SKILL: SkillFormInput = {
  name: "",
  slug: "",
  category: "frontend",
  level: 3,
  status: "core",
  icon_key: null,
  icon_media_id: null,
  description: null,
  attack_name: "",
  damage: NEW_SKILL_DAMAGE,
  cooldown_ms: NEW_SKILL_COOLDOWN_MS,
  is_visible: true,
};

export function toFormValues(row: AdminSkill): SkillFormInput {
  return {
    name: row.name,
    slug: row.slug,
    category: row.category,
    level: row.level,
    status: row.status,
    icon_key: row.icon_key,
    icon_media_id: row.icon_media_id,
    description: row.description,
    attack_name: row.attack_name ?? "",
    damage: row.damage,
    cooldown_ms: row.cooldown_ms,
    is_visible: row.is_visible,
  };
}

/** Request body (store, or the partial update with every editable field). */
export function toPayload(values: SkillFormOutput): Record<string, unknown> {
  const soft = values.category === SOFT;
  return {
    name: values.name,
    // null → the API (re)generates the slug from the name.
    slug: values.slug === "" ? null : values.slug,
    category: values.category,
    level: values.level,
    status: values.status,
    icon_key: values.icon_key === "" ? null : values.icon_key,
    icon_media_id: values.icon_media_id,
    description: values.description === "" ? null : values.description,
    // Soft skills are never game skills: the API stores their game fields as null.
    attack_name: soft ? null : (values.attack_name?.trim() ?? null),
    damage: soft ? null : values.damage,
    cooldown_ms: soft ? null : values.cooldown_ms,
    is_visible: values.is_visible,
  };
}

/** Friendly names for <FormErrorSummary>. */
export const SKILL_FIELD_LABELS: Record<string, string> = {
  name: "Name",
  slug: "Slug",
  category: "Category",
  level: "Level",
  status: "Status",
  icon_key: "Icon key",
  icon_media_id: "Icon image",
  description: "Description",
  attack_name: "Attack name",
  damage: "Damage",
  cooldown_ms: "Cooldown",
  is_visible: "Visible",
};
