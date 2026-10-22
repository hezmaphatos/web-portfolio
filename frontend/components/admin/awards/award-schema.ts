/**
 * Award form: zod schema mirroring StoreAwardRequest / UpdateAwardRequest
 * (backend/app/Http/Requests/Admin) and the form <-> API mapping.
 */
import { z } from "zod";

import { AWARD_PLACEMENTS, type AdminAward } from "@/lib/types";

const tooLong = (max: number) => `Use at most ${max} characters.`;

const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max, tooLong(max));

const optionalText = (max: number) => z.string().trim().max(max, tooLong(max)).nullable();

export const awardSchema = z.object({
  title: requiredText(255, "Enter a title."),
  event: requiredText(255, "Enter the event."),
  issuer: optionalText(255),
  year: z
    .number({ error: "Enter a year." })
    .int("Use a whole year, e.g. 2025.")
    .min(1990, "Use a year from 1990 to 2100.")
    .max(2100, "Use a year from 1990 to 2100.")
    .nullable(),
  placement: z.enum(AWARD_PLACEMENTS, { error: "Choose a placement." }),
  category: optionalText(60),
  description: z.string().max(5000, tooLong(5000)).nullable(),
  media_id: z.number().int().nullable(),
  // Laravel's `url` rule; the site only links out over http(s).
  url: z
    .url({ protocol: /^https?$/, error: "Enter a full link starting with https://" })
    .max(500, tooLong(500))
    .nullable(),
  is_visible: z.boolean(),
});

export type AwardFormValues = z.input<typeof awardSchema>;
export type AwardFormOutput = z.output<typeof awardSchema>;

export const EMPTY_AWARD: AwardFormValues = {
  title: "",
  event: "",
  issuer: null,
  year: null,
  placement: "participant",
  category: null,
  description: null,
  media_id: null,
  url: null,
  is_visible: true,
};

export function toAwardValues(row: AdminAward): AwardFormValues {
  return {
    title: row.title,
    event: row.event,
    issuer: row.issuer || null,
    year: row.year,
    placement: row.placement,
    category: row.category || null,
    description: row.description || null,
    media_id: row.media_id,
    url: row.url || null,
    is_visible: row.is_visible,
  };
}
