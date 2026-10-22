import { FileDown } from "lucide-react";

import { AboutMotion } from "@/components/chapters/about/AboutMotion";
import { FlipCard } from "@/components/chapters/about/FlipCard";
import { HintButton } from "@/components/game/HintButton";
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
 * Without JavaScript the flip button does nothing, so the card falls back to the phase-3 look:
 * portrait in front, the pixel avatar as a small tilted inset (the back face pulled forward).
 */
const NO_JS_FLIP = `
.hk-flip-btn{display:none}
.hk-flip-back{transform:rotate(3deg);backface-visibility:visible;-webkit-backface-visibility:visible;
  inset:auto .75rem .75rem auto;width:34%;height:auto;padding:.25rem;background:var(--paper);
  border-width:2px;box-shadow:var(--shadow-sm)}
.hk-flip-back-body{padding:0;background:none}
.hk-flip-back-caption{display:none}
`;

/**
 * Chapter 2 — CHARACTER SELECT (spec §4.1). A Server Component; all content is in the HTML (= Lite
 * mode). Client islands add the interaction:
 * - <FlipCard>: [data-flip-card] turns between [data-flip-front] (portrait) and [data-flip-back]
 *   (pixel avatar), and owns the About stage hint;
 * - <AboutMotion>: [data-bio-scrub] lights up word by word with the scroll, [data-counter]s count
 *   up when visible (the final value is in the HTML, and a sr-only copy is what screen readers read).
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
        <ChapterHeading
          level={2}
          plain="About"
          section={section}
          id="about-title"
          aside={<HintButton hintKey="about" text={section.hint} className="mt-[0.35em]" />}
        />
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
                <noscript>
                  <style>{NO_JS_FLIP}</style>
                </noscript>
                <FlipCard
                  hint={section.hint}
                  front={
                    <Media
                      media={site.portrait}
                      alt={`Portrait of ${site.full_name}`}
                      seed={`${site.nickname}-portrait`}
                      ratio={4 / 5}
                      sizes="(min-width: 768px) 34vw, 90vw"
                    />
                  }
                  back={
                    <div className="hk-flip-back-body bg-ink flex h-full flex-col justify-center gap-4 p-5">
                      <div className="border-paper border-2">
                        <Media
                          media={site.avatar}
                          alt={`Pixel avatar of ${site.nickname}`}
                          seed={`${site.nickname}-avatar`}
                          accent="#3D5AFE"
                          ratio={1}
                          sizes="(min-width: 768px) 30vw, 80vw"
                        />
                      </div>
                      <p className="hk-flip-back-caption hk-pixel text-lime flex justify-between gap-3 text-xs">
                        <span>8-bit form</span>
                        <span className="text-paper">{site.nickname}</span>
                      </p>
                    </div>
                  }
                />
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
          <AboutMotion className="md:col-span-7">
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
                        {/* Screen readers get the final value; the visible copy may count up. */}
                        <span className="sr-only">{stat.value}</span>
                        <span
                          aria-hidden="true"
                          data-counter={NUMERIC.test(stat.value) ? stat.value : undefined}
                        >
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
          </AboutMotion>
        </div>
      </div>
    </section>
  );
}
