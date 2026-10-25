import { label } from "@/lib/utils";
import type { Award } from "@/lib/types";

export type AwardText = {
  /** Participation titles are just the placement ("Participant"): the event is the headline. */
  headline: string;
  /** Event (unless it is the headline) and issuer. */
  facts: string[];
  /** "Gold · Olympiad". */
  meta: string;
};

/** The words of a trophy, shared by the card (server) and the detail dialog (client). */
export function awardText(award: Award): AwardText {
  const titleIsPlacement =
    award.title.trim().toLowerCase() === label(award.placement).toLowerCase();
  return {
    headline: titleIsPlacement ? award.event : award.title,
    facts: [titleIsPlacement ? null : award.event, award.issuer].filter((fact): fact is string =>
      Boolean(fact),
    ),
    meta: [label(award.placement), award.category].filter(Boolean).join(" · "),
  };
}
