import { ArrowDown, FileDown } from "lucide-react";

import { HeroScene } from "@/components/chapters/hero/HeroScene";
import { HeroStickers, StickerToss } from "@/components/chapters/hero/HeroStickers";
import { RoleCycler } from "@/components/chapters/hero/RoleCycler";
import { HintButton } from "@/components/game/HintButton";
import type { Section, Site } from "@/lib/types";

type Props = { site: Site; section: Section };

/**
 * Chapter 1 — PLAYER ONE (spec §4.1). A Server Component: every piece of content is in the HTML
 * and readable without JavaScript (= Lite mode). The motion lives in small client islands:
 * <HeroScene> (name reveal on [data-hero-name], draggable [data-sticker]s bouncing inside
 * [data-sticker-bounds], [data-depth] parallax, the stage hint), <RoleCycler> (typewriter roles)
 * and <HeroStickers>/<StickerToss> (the sticker buttons and their keyboard alternative).
 */
export function HeroChapter({ site, section }: Props) {
  const [first, ...rest] = site.full_name.split(" ");
  const last = rest.join(" ");
  const stickers = site.stats.slice(0, 2).map((stat) => ({
    key: stat.label,
    text: `${stat.label} ${stat.prefix ?? ""}${stat.value}${stat.suffix ?? ""}`,
  }));

  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      className="hk-chapter flex min-h-svh items-center"
      data-chapter="hero"
    >
      {/* The box thrown stickers bounce inside: the hero minus a margin, so they never clip. */}
      <div
        data-sticker-bounds
        aria-hidden="true"
        className="pointer-events-none absolute inset-3 md:inset-6"
      />

      {/* isolate: a sticker brought to the front (z-index) stays below the fixed HUD. */}
      <HeroScene hint={section.hint} className="hk-wrap relative isolate">
        <div className="hk-pixel mb-8 flex flex-wrap items-center justify-between gap-3 text-xs md:mb-12 md:text-sm">
          <div className="flex items-center gap-3">
            <p>
              <span aria-hidden="true">● </span>Player 1 · Ready
            </p>
            <HintButton hintKey="hero" text={section.hint} />
          </div>
          {site.location ? <p className="opacity-80">{site.location}</p> : null}
        </div>

        <p className="sr-only">{section.title}</p>
        <h1
          id="hero-title"
          data-hero-name
          data-depth="0.2"
          // The name is split into letters while it animates; the label keeps one clean name.
          aria-label={site.full_name}
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

        {/* The player tag is content (the nickname), so it stays a paragraph — draggable by
            pointer; keyboard users move it with "Toss stickers". */}
        <div
          data-depth="0.6"
          className="mt-5 md:absolute md:top-[clamp(6rem,24vw,13rem)] md:right-[6%] md:mt-0"
        >
          <p
            data-sticker
            className="hk-sticker hk-pixel relative inline-block -rotate-3 text-sm md:-rotate-6 md:text-base"
          >
            Player: {site.nickname}
          </p>
        </div>

        <div className="mt-10 grid gap-8 md:mt-14 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            {site.headline ? (
              <p className="hk-pixel text-ink-2 mb-3 text-xs md:text-sm">{site.headline}</p>
            ) : null}
            <RoleCycler roles={site.roles} />
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

        <HeroStickers stickers={stickers} />

        <div className="mt-16 flex flex-wrap items-center justify-between gap-4">
          {section.hint ? (
            <p className="hk-pixel text-xs opacity-70">
              <span aria-hidden="true">↓ </span>Scroll down to start walking
            </p>
          ) : (
            <span />
          )}
          <StickerToss />
        </div>
      </HeroScene>
    </section>
  );
}
