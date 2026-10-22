import { FileDown } from "lucide-react";

import { ChapterHeading } from "@/components/ui/ChapterHeading";
import { Markdown } from "@/components/ui/Markdown";
import { Media } from "@/components/ui/Media";
import { cn } from "@/lib/utils";
import type { Section, Site, Stat } from "@/lib/types";

type Props = { site: Site; section: Section; projectsCount: number };

/** Each stat card gets its own surface and tilt: a stat row, not a grid of identical cards. */
const STAT_STYLES = [
  "bg-lime -rotate-2",
  "bg-paper rotate-1 md:translate-y-3",
  "bg-hot -rotate-1",
  "bg-volt text-paper rotate-2 md:translate-y-2",
];

/** Plain decimal numbers get a counter hook; anything else ("A+", "3rd") is shown as-is. */
const NUMERIC = /^-?\d+(\.\d+)?$/;

/**
 * Chapter 2 — CHARACTER SELECT (spec §4.1). Static version (= Lite mode): the character card shows
 * the portrait with the pixel avatar as an inset, the bio is plain text and the stats show their
 * final values. Phase 4 adds the interaction on top of the hooks below:
 * - [data-flip-card] flips between [data-flip-front] (portrait) and [data-flip-back] (avatar);
 * - [data-bio-scrub] reveals the lead word by word, scrubbed by scroll;
 * - [data-counter] counts up to its value.
 */
export function AboutChapter({ site, section, projectsCount }: Props) {
  // `auto: "projects"` stats are computed by the API; the page's own count is the same number
  // and keeps the card in step with the projects actually rendered below.
  const stats: Stat[] = site.stats.map((stat) =>
    stat.auto === "projects" ? { ...stat, value: String(projectsCount) } : stat,
  );
  const characterClass = site.headline ?? site.roles[0] ?? null;

  return (
    <section
      id="about"
      aria-labelledby="about-title"
      className="hk-chapter [--chapter-bg:var(--paper-2)]"
      data-chapter="about"
    >
      <div className="hk-wrap">
        <ChapterHeading level={2} plain="About" section={section} id="about-title" />
        <Markdown className="-mt-4 mb-12 text-lg md:-mt-6 md:mb-16">{section.body}</Markdown>

        <div className="grid gap-14 md:grid-cols-12 md:gap-10 lg:gap-14">
          {/* Character card */}
          <div className="md:col-span-5">
            <figure
              data-flip-card
              className="hk-panel hk-tilt-l relative mx-auto w-full max-w-sm md:sticky md:top-24 md:max-w-none"
            >
              <div className="bg-ink text-paper hk-pixel flex items-center justify-between gap-3 rounded-tr-[12px] px-4 py-2 text-xs">
                <span>P1 · {site.nickname}</span>
                <span aria-hidden="true">◂ ▸</span>
              </div>

              <div className="p-3 md:p-4">
                <div data-flip-front className="border-ink relative border-2">
                  <Media
                    media={site.portrait}
                    alt={`Portrait of ${site.full_name}`}
                    seed={`${site.nickname}-portrait`}
                    ratio={4 / 5}
                    sizes="(min-width: 768px) 34vw, 90vw"
                  />
                  <div
                    data-flip-back
                    className="border-ink bg-paper absolute right-3 bottom-3 w-[34%] rotate-3 border-2 p-1 shadow-[var(--shadow-sm)]"
                  >
                    <Media
                      media={site.avatar}
                      alt={`Pixel avatar of ${site.nickname}`}
                      seed={`${site.nickname}-avatar`}
                      accent="#3D5AFE"
                      ratio={1}
                      thumb
                      sizes="160px"
                    />
                  </div>
                </div>
              </div>

              <figcaption className="px-4 pb-5 md:px-5">
                <p className="hk-display hk-condensed text-4xl tracking-[-0.005em] uppercase md:text-5xl">
                  {site.full_name}
                </p>
                <dl className="hk-mono mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  {characterClass ? (
                    <>
                      <dt className="text-ink-2">Class</dt>
                      <dd>{characterClass}</dd>
                    </>
                  ) : null}
                  {site.location ? (
                    <>
                      <dt className="text-ink-2">Base</dt>
                      <dd>{site.location}</dd>
                    </>
                  ) : null}
                </dl>
              </figcaption>

              <p
                aria-hidden="true"
                className="hk-sticker hk-pixel absolute -top-4 -right-3 rotate-6 text-xs"
              >
                Selected
              </p>
            </figure>
          </div>

          {/* Bio, stats, soft skills */}
          <div className="md:col-span-7">
            <h3 className="hk-pixel mb-4 text-xs md:text-sm">
              <span aria-hidden="true">▸ </span>Bio
            </h3>
            {site.short_bio ? (
              <p
                data-bio-scrub
                className="text-[clamp(1.35rem,2.5vw,1.95rem)] leading-[1.32] font-medium tracking-[-0.01em]"
              >
                {site.short_bio}
              </p>
            ) : null}
            <Markdown className="mt-6 text-lg">{site.long_bio}</Markdown>

            {stats.length > 0 ? (
              <>
                <h3 className="hk-pixel mt-14 mb-5 text-xs md:text-sm">
                  <span aria-hidden="true">▸ </span>Stats
                </h3>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-2 xl:grid-cols-4 xl:gap-5">
                  {stats.map((stat, i) => (
                    <div
                      key={stat.label}
                      className={cn(
                        "hk-panel-flat flex flex-col-reverse justify-end px-3 py-3 shadow-[var(--shadow-sm)] md:px-4",
                        STAT_STYLES[i % STAT_STYLES.length],
                      )}
                    >
                      <dt className="hk-pixel mt-2 text-[0.7rem] leading-tight">{stat.label}</dt>
                      <dd className="hk-display hk-condensed flex items-baseline text-5xl tracking-[-0.005em] whitespace-nowrap xl:text-6xl">
                        {stat.prefix ? <span>{stat.prefix}</span> : null}
                        <span data-counter={NUMERIC.test(stat.value) ? stat.value : undefined}>
                          {stat.value}
                        </span>
                        {stat.suffix ? (
                          <span className="hk-mono ml-1 text-sm font-bold tracking-normal">
                            {stat.suffix}
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : null}

            {site.soft_skills.length > 0 ? (
              <>
                <h3 className="hk-pixel mt-14 mb-4 text-xs md:text-sm">
                  <span aria-hidden="true">▸ </span>Passive skills
                  <span className="text-ink-2"> · soft skills</span>
                </h3>
                <ul className="flex flex-wrap gap-2.5">
                  {site.soft_skills.map((skill) => (
                    <li key={skill} className="hk-chip px-3 text-sm">
                      {skill}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {site.cv ? (
              <a href={site.cv.url} className="hk-btn hk-btn-hot mt-12 text-base" download>
                <FileDown aria-hidden="true" className="size-4" />
                Download CV
                {site.cv.mime === "application/pdf" ? (
                  <span className="sr-only"> (PDF)</span>
                ) : null}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
