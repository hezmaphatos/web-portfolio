/**
 * Experience form: zod schema mirroring StoreExperienceRequest / UpdateExperienceRequest
 * (backend/app/Http/Requests/Admin), the form <-> API mapping and the period label.
 */
import { z } from "zod";

import { EXPERIENCE_TYPES, type AdminExperience, type ExperienceType } from "@/lib/types";

export const EXPERIENCE_TYPE_LABEL: Record<ExperienceType, string> = {
  work: "Work",
  internship: "Internship",
  freelance: "Freelance",
  organization: "Organization",
  education: "Education",
};

export function isExperienceType(value: string): value is ExperienceType {
  return (EXPERIENCE_TYPES as readonly string[]).includes(value);
}

export const MAX_BULLETS = 30;
export const MAX_METRICS = 10;
const METRIC_LIMIT = 1_000_000_000;

const tooLong = (max: number) => `Use at most ${max} characters.`;

const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max, tooLong(max));

const optionalText = (max: number) => z.string().trim().max(max, tooLong(max)).nullable();

const metricSchema = z.object({
  label: requiredText(100, "Enter a label."),
  // NumberField stores null while empty; the API requires a number.
  value: z
    .number()
    .nullable()
    .pipe(
      z
        .number({ error: "Enter a number." })
        .min(-METRIC_LIMIT, "The number is too small.")
        .max(METRIC_LIMIT, "The number is too large."),
    ),
  prefix: optionalText(20),
  suffix: optionalText(20),
});

/** Runs a cross-field date check only when none of `fields` already has its own error. */
const unlessErrorsOn =
  (...fields: string[]) =>
  ({ issues }: { issues: ReadonlyArray<{ path?: PropertyKey[] }> }) =>
    !issues.some((issue) => fields.includes(String(issue.path?.[0] ?? "")));

export const experienceSchema = z
  .object({
    type: z.enum(EXPERIENCE_TYPES, { error: "Choose a type." }),
    title: requiredText(255, "Enter a title."),
    organization: requiredText(255, "Enter the organization."),
    location: optionalText(255),
    subtitle: optionalText(255),
    // DateField stores null while empty.
    start_date: z
      .string()
      .nullable()
      .pipe(z.iso.date({ error: "Pick a start date." })),
    end_date: z.iso.date({ error: "Pick a valid date." }).nullable(),
    /** Form-only: ticked = no end date ("– Present"). Not sent to the API. */
    present: z.boolean(),
    description: z.string().max(10_000, tooLong(10_000)).nullable(),
    bullets: z
      .array(z.string().trim().min(1, "Write the bullet or remove it.").max(500, tooLong(500)))
      .max(MAX_BULLETS, `Use at most ${MAX_BULLETS} bullets.`),
    metrics: z.array(metricSchema).max(MAX_METRICS, `Use at most ${MAX_METRICS} metrics.`),
    logo_media_id: z.number().int().nullable(),
    is_visible: z.boolean(),
  })
  .refine((values) => values.present || values.end_date !== null, {
    path: ["end_date"],
    error: "Pick an end date, or tick “Present”.",
    // Shown together with the other field errors (it does not need a valid start date).
    when: unlessErrorsOn("end_date", "present"),
  })
  .refine(
    // Y-m-d strings: string order is date order (same check as the API's after_or_equal).
    (values) => values.present || values.end_date === null || values.end_date >= values.start_date,
    {
      path: ["end_date"],
      error: "The end date must be on or after the start date.",
      when: unlessErrorsOn("start_date", "end_date", "present"),
    },
  );

export type ExperienceFormValues = z.input<typeof experienceSchema>;
export type ExperienceFormOutput = z.output<typeof experienceSchema>;

export const EMPTY_EXPERIENCE: ExperienceFormValues = {
  type: "work",
  title: "",
  organization: "",
  location: null,
  subtitle: null,
  start_date: null,
  end_date: null,
  present: false,
  description: null,
  bullets: [],
  metrics: [],
  logo_media_id: null,
  is_visible: true,
};

/** API row → form values. Empty prefix/suffix strings become null, like a cleared input. */
export function toExperienceValues(row: AdminExperience): ExperienceFormValues {
  return {
    type: row.type,
    title: row.title,
    organization: row.organization,
    location: row.location || null,
    subtitle: row.subtitle || null,
    start_date: row.start_date ? row.start_date.slice(0, 10) : null,
    end_date: row.end_date ? row.end_date.slice(0, 10) : null,
    present: row.end_date === null,
    description: row.description || null,
    bullets: [...row.bullets],
    metrics: row.metrics.map((metric) => ({
      label: metric.label,
      value: metric.value,
      prefix: metric.prefix || null,
      suffix: metric.suffix || null,
    })),
    logo_media_id: row.logo_media_id,
    is_visible: row.is_visible,
  };
}

/** Validated form values → request body (POST or partial PUT with every field). */
export function toExperiencePayload(values: ExperienceFormOutput): Record<string, unknown> {
  const { present, end_date, ...rest } = values;
  return { ...rest, end_date: present ? null : end_date };
}

/* ── Period label ─────────────────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-01-01" → "Jan 2026". Parsed by hand so no time zone can shift the month. */
export function formatMonth(date: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(date);
  const month = match ? MONTHS[Number(match[2]) - 1] : undefined;
  return match && month ? `${month} ${match[1]}` : date;
}

/** "Jan 2026 – Present", "Feb 2025 – Nov 2025", or "Nov 2022" when both ends share a month. */
export function formatPeriod(start: string | null, end: string | null): string {
  if (!start) return "—";
  const from = formatMonth(start);
  if (end === null) return `${from} – Present`;
  const to = formatMonth(end);
  return from === to ? from : `${from} – ${to}`;
}
