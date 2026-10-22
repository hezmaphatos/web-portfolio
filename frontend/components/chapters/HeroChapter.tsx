import { ArrowDown, FileDown } from "lucide-react";

import type { Section, Site } from "@/lib/types";

type Props = { site: Site; section: Section };

/**
 * Chapter 1 — PLAYER ONE (spec §4.1). Static version: every piece of content is in the HTML and
 * readable without JavaScript (= Lite mode). Phase 4 animates it: the name reveals per character
 * (SplitText on [data-hero-name]), the roles cycle, the stickers ([data-sticker]) become
 * draggable and the layers get mouse parallax ([data-depth]).
 */
export function HeroChapter({ site, section }: Props) {
  const [first, ...rest] = site.full_name.split(" ");
  const last = rest.join(" ");
  const stickers = site.stats.slice(0, 2);

  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      className="hk-chapter flex min-h-svh items-center"
      data-chapter="hero"
    >
      <div className="hk-wrap relative">
        <div className="hk-pixel mb-8 flex flex-wrap items-center justify-between gap-3 text-xs md:mb-12 md:text-sm">
          <p>
            <span aria-hidden="true">● </span>Player 1 · Ready
          </p>
          {site.location ? <p className="opacity-80">{site.location}</p> : null}
        </div>

        <p className="sr-only">{section.title}</p>
        <h1
          id="hero-title"
          data-hero-name
          // Tracking stays slightly open: at -0.03em the condensed glyphs touch edge to edge and the
          // anti-aliasing draws hairline seams between letters. No text-stroke either: the variable
          // font's overlapping contours would show through it.
          className="hk-display hk-condensed relative text-[clamp(4.25rem,22vw,15rem)] tracking-[-0.005em] uppercase"
        >
          <span className="block">{first}</span>
          {last ? (
            <span className="text-hot block pl-[0.06em] [text-shadow:0.045em_0.045em_0_var(--ink)]">
              {last}
            </span>
          ) : null}
        </h1>

        <p
          data-depth="0.6"
          className="hk-sticker hk-pixel mt-5 inline-block -rotate-3 text-sm md:absolute md:top-[clamp(6rem,24vw,13rem)] md:right-[6%] md:mt-0 md:-rotate-6 md:text-base"
        >
          Player: {site.nickname}
        </p>

        <div className="mt-10 grid gap-8 md:mt-14 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            {site.headline ? (
              <p className="hk-pixel text-ink-2 mb-3 text-xs md:text-sm">{site.headline}</p>
            ) : null}
            {site.roles.length > 0 ? (
              <ul
                data-hero-roles
                aria-label="Roles"
                className="flex flex-wrap gap-x-4 gap-y-1 text-2xl font-bold md:text-3xl"
              >
                {site.roles.map((role, i) => (
                  <li key={role} className="flex items-center gap-4">
                    {i > 0 ? (
                      <span aria-hidden="true" className="text-hot">
                        /
                      </span>
                    ) : null}
                    {role}
                  </li>
                ))}
              </ul>
            ) : null}
            {site.tagline ? (
              <p className="mt-5 max-w-xl text-lg md:text-xl">{site.tagline}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-4 md:col-span-5 md:justify-end">
            <a href="#about" className="hk-btn hk-btn-hot text-base">
              Press start
              <ArrowDown aria-hidden="true" className="size-4" />
            </a>
            {site.cv ? (
              <a href={site.cv.url} className="hk-btn text-base" download>
                <FileDown aria-hidden="true" className="size-4" />
                Download CV
              </a>
            ) : null}
          </div>
        </div>

        {/* Decorative stat stickers; draggable toys from phase 4. The same facts are in About. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden md:block">
          {stickers.map((stat, i) => (
            <span
              key={stat.label}
              data-sticker
              data-depth={i === 0 ? "1" : "1.4"}
              className={
                i === 0
                  ? "hk-panel-flat hk-pixel bg-lime absolute top-2 left-[46%] rotate-3 px-3 py-2 text-xs shadow-[3px_3px_0_var(--ink)]"
                  : "hk-panel-flat hk-pixel bg-volt text-paper absolute right-[2%] bottom-[38%] -rotate-2 px-3 py-2 text-xs shadow-[3px_3px_0_var(--ink)]"
              }
            >
              {stat.label} {stat.prefix}
              {stat.value}
              {stat.suffix}
            </span>
          ))}
        </div>

        {section.hint ? (
          <p className="hk-pixel mt-16 text-xs opacity-70">
            <span aria-hidden="true">↓ </span>Scroll down to start walking
          </p>
        ) : null}
      </div>
    </section>
  );
}
