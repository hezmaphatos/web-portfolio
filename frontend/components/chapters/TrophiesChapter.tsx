import { ArrowUpRight } from "lucide-react";

import { ChapterHeading } from "@/components/ui/ChapterHeading";
import { Markdown } from "@/components/ui/Markdown";
import { Media } from "@/components/ui/Media";
import { cn, label } from "@/lib/utils";
import type { Award, AwardPlacement, Section } from "@/lib/types";

type Props = { awards: Award[]; section: Section };

/** Podium placements go on the top shelf; finalists and participants on the lower one. */
const MEDALS: readonly AwardPlacement[] = ["gold", "silver", "bronze"];

/** Medal disc colours (the palette has no yellow: lime is this site's "gold"). */
const DISC: Record<AwardPlacement, string> = {
  gold: "#C6F432",
  silver: "#F3EFE6",
  bronze: "#FF4B2B",
  finalist: "#3D5AFE",
  participant: "#F3EFE6",
};

const RANK: Partial<Record<AwardPlacement, string>> = { gold: "1", silver: "2", bronze: "3" };

/**
 * Chapter 6 — TROPHY ROOM (spec §4.1). Static version (= Lite mode): a two-shelf cabinet, every
 * detail is on the card. Gold is the loud one (ink card, medal, bigger); participation is plain.
 * Hooks for phase 5: [data-tilt] gets the 3D hover tilt, [data-award] opens the detail modal.
 */
export function TrophiesChapter({ awards, section }: Props) {
  const medals = awards.filter((award) => MEDALS.includes(award.placement));
  const others = awards.filter((award) => !MEDALS.includes(award.placement));

  return (
    <section
      id="trophies"
      aria-labelledby="trophies-title"
      className="hk-chapter [--accent:var(--ink)] [--chapter-bg:var(--lime)]"
      data-chapter="trophies"
    >
      <div className="hk-wrap">
        <ChapterHeading level={6} plain="Awards" section={section} id="trophies-title" />
        <Markdown className="-mt-4 mb-12 text-lg md:-mt-6">{section.body}</Markdown>

        {medals.length > 0 ? (
          <Shelf label="Top shelf · Medals">
            <ul className="grid items-end gap-x-10 gap-y-14 pt-8 md:grid-cols-2">
              {medals.map((award, i) => (
                <li key={award.id} className={cn(i % 2 === 0 ? "hk-tilt-l" : "hk-tilt-r")}>
                  <TrophyCard award={award} featured />
                </li>
              ))}
            </ul>
          </Shelf>
        ) : null}

        {others.length > 0 ? (
          <Shelf label="Lower shelf · Contests" className={medals.length > 0 ? "mt-20" : undefined}>
            <ul className="grid items-end gap-6 pt-4 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((award, i) => (
                <li key={award.id} className={cn(i % 2 === 0 ? "rotate-[0.6deg]" : "-rotate-1")}>
                  <TrophyCard award={award} />
                </li>
              ))}
            </ul>
          </Shelf>
        ) : null}
      </div>
    </section>
  );
}

/** One shelf of the cabinet: a label, the cards standing on an ink plank. */
function Shelf({
  label: shelfLabel,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <p className="hk-pixel mb-2 text-xs">
        <span aria-hidden="true">▾ </span>
        {shelfLabel}
      </p>
      {children}
      <div
        aria-hidden="true"
        className="bg-ink mt-3 h-4 rounded-[2px] shadow-[0_8px_0_color-mix(in_oklab,var(--ink)_25%,transparent)]"
      />
    </div>
  );
}

function TrophyCard({ award, featured = false }: { award: Award; featured?: boolean }) {
  // Participation titles are just the placement ("Participant"): the event is the real headline.
  const titleIsPlacement =
    award.title.trim().toLowerCase() === label(award.placement).toLowerCase();
  const headline = titleIsPlacement ? award.event : award.title;
  const facts = [titleIsPlacement ? null : award.event, award.issuer].filter(Boolean);
  const meta = [label(award.placement), award.category].filter(Boolean).join(" · ");

  return (
    <article
      data-tilt
      data-award={award.id}
      data-placement={award.placement}
      className={cn(
        "relative",
        featured
          ? "hk-panel bg-ink text-paper border-ink px-6 pt-7 pb-6 shadow-[6px_6px_0_var(--hot)] md:px-8 md:pt-9 md:pb-8"
          : "hk-panel-flat px-5 py-5 shadow-[var(--shadow-sm)]",
      )}
    >
      {featured ? (
        <Medal
          placement={award.placement}
          className="absolute -top-9 right-5 w-16 rotate-6 md:right-8 md:w-20"
        />
      ) : null}

      <p className={cn("hk-pixel text-xs", featured ? "text-lime pr-20" : "text-ink-2")}>{meta}</p>
      <h3
        className={cn(
          "mt-3",
          featured
            ? "hk-display hk-condensed text-[clamp(2.25rem,4.4vw,3.5rem)] tracking-[-0.005em] uppercase"
            : "text-xl leading-tight font-bold",
        )}
      >
        {headline}
      </h3>
      {facts.length > 0 ? (
        <p className={cn("mt-3 font-semibold", featured && "text-lg")}>{facts.join(" · ")}</p>
      ) : null}
      {award.description ? (
        <p className={cn("mt-2", featured ? "opacity-90" : "text-ink-2 text-sm")}>
          {award.description}
        </p>
      ) : null}

      {award.image ? (
        <Media
          media={award.image}
          alt={`Certificate: ${headline}`}
          seed={award.title}
          ratio={4 / 3}
          thumb={!featured}
          sizes={featured ? "(min-width: 768px) 40vw, 90vw" : "(min-width: 1024px) 25vw, 90vw"}
          className={cn("mt-5 border-2", featured ? "border-paper" : "border-ink")}
        />
      ) : null}

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        {award.year ? (
          <p
            className={cn(
              "hk-mono font-bold",
              featured ? "border-paper/40 border-2 px-2 py-0.5 text-sm" : "text-sm",
            )}
          >
            {award.year}
          </p>
        ) : (
          <span />
        )}
        {award.url ? (
          <a
            href={award.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hk-btn min-h-0 px-3 py-1.5 text-sm"
          >
            Details
            <ArrowUpRight aria-hidden="true" className="size-4" />
            <span className="sr-only"> about {headline} (opens in a new tab)</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}

/** Ribbon + disc. Decorative: the placement is also written on the card. */
function Medal({ placement, className }: { placement: AwardPlacement; className?: string }) {
  const rank = RANK[placement];
  return (
    <svg
      viewBox="0 0 64 84"
      aria-hidden="true"
      focusable="false"
      className={cn("overflow-visible drop-shadow-[3px_3px_0_var(--hot)]", className)}
    >
      <g stroke="#111111" strokeWidth="3" strokeLinejoin="round">
        <path d="M14 2 H30 L38 34 L24 38 Z" fill="#FF4B2B" />
        <path d="M50 2 H34 L26 34 L40 38 Z" fill="#3D5AFE" />
        <circle cx="32" cy="58" r="23" fill={DISC[placement]} strokeWidth="4" />
        <circle cx="32" cy="58" r="15" fill="none" strokeWidth="2" strokeDasharray="3 3" />
      </g>
      {rank ? (
        <text
          x="32"
          y="66"
          textAnchor="middle"
          fill="#111111"
          fontSize="22"
          fontWeight="700"
          className="hk-pixel"
        >
          {rank}
        </text>
      ) : null}
    </svg>
  );
}
