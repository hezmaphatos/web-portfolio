import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";

import { ProjectGrid } from "@/components/chapters/projects/ProjectGrid";
import { ProjectsHint } from "@/components/chapters/projects/ProjectsHint";
import { ShowcaseMotion } from "@/components/chapters/projects/ShowcaseMotion";
import { HintButton } from "@/components/game/HintButton";
import { ProjectCartridge } from "@/components/project/ProjectCartridge";
import { ChapterHeading } from "@/components/ui/ChapterHeading";
import { Markdown } from "@/components/ui/Markdown";
import { pad2 } from "@/lib/utils";
import type { ProjectSummary, Section, Site } from "@/lib/types";

type Props = { projects: ProjectSummary[]; section: Section; site: Site };

/** Spec §6.1: at most 6 cartridges in the showcase; the rest live in the grid. */
const MAX_FEATURED = 6;

/**
 * Scene A track: a native horizontal scroller with scroll snap that bleeds to the section edges
 * while the first card lines up with .hk-wrap (max 76rem, centred). `--gutter` (set on
 * .hk-showcase) mirrors the .hk-chapter inline padding. Padding % resolves against the section's
 * content width, scroll padding % against the scrollport (two gutters wider), hence the two
 * formulas. Block padding leaves room for the tilts and hard shadows the scroller would otherwise
 * clip. While pinned (desktop) the CSS turns it into a plain row that GSAP translates.
 * (Tailwind rather than a CSS module: the Turbopack CSS rule in next.config treats *.module.css
 * as global CSS.)
 */
const TRACK = [
  "hk-showcase-track relative flex gap-[clamp(1.25rem,3vw,2.5rem)]",
  "mx-[calc(-1*var(--gutter))] px-[max(var(--gutter),calc((100%_-_76rem)/2_+_var(--gutter)))]",
  "scroll-px-[max(var(--gutter),calc((100%_-_76rem)/2))] pt-5 pb-10",
  "snap-x snap-mandatory overflow-x-auto overscroll-x-contain motion-safe:scroll-smooth",
  "[scrollbar-color:var(--paper)_transparent] [scrollbar-width:thin]",
].join(" ");

/**
 * Chapter 5 — LEVEL SELECT (spec §4.1, §6), on ink. A Server Component; the HTML is the Lite
 * version and client islands add the motion:
 * - Scene A (<ShowcaseMotion>): featured projects as cartridges. Desktop: the stage pins (CSS
 *   sticky) while ScrollTrigger scrubs the track sideways; the active cartridge lifts, the stage
 *   takes its accent colour, the counter reads "02 / 03". Phones / tablets / Lite: the native
 *   swipe carousel. Hooks: [data-showcase], [data-showcase-stage], [data-showcase-bg],
 *   [data-showcase-track], [data-card], [data-showcase-index], [data-showcase-progress].
 * - Scene B (<ProjectGrid>): every published project, filter chips + search with a Flip
 *   re-flow, hover swap + tilt, Peek. The same grid is the /projects page.
 * Cartridges and cards carry data-cursor="VIEW" for the custom cursor, and gated tech chips +
 * the DEFEATED stamp from the save cookie.
 */
export function ProjectsChapter({ projects, section }: Props) {
  // The API already orders by sort_order; keep that order for both scenes.
  const featured = projects.filter((project) => project.is_featured).slice(0, MAX_FEATURED);
  const bosses = projects.filter((project) => project.boss.enabled).length;
  const rest = projects.length - featured.length;

  return (
    <section
      id="projects"
      aria-labelledby="projects-title"
      className="hk-chapter [--accent:var(--lime)] [--chapter-bg:var(--ink)] [--chapter-fg:var(--paper)]"
      data-chapter="projects"
    >
      <ProjectsHint hint={section.hint} />
      <div className="hk-wrap">
        <ChapterHeading
          level={5}
          plain="Projects"
          section={section}
          id="projects-title"
          aside={
            <>
              <HintButton hintKey="projects" text={section.hint} className="mt-[0.35em]" />
              {projects.length > 0 ? (
                <p className="hk-sticker hk-pixel mt-2 hidden shrink-0 rotate-3 text-xs sm:block md:mt-4">
                  {projects.length} {projects.length === 1 ? "level" : "levels"}
                  {bosses > 0 ? (
                    <>
                      {" "}
                      · {bosses} {bosses === 1 ? "boss" : "bosses"}
                    </>
                  ) : null}
                </p>
              ) : null}
            </>
          }
        />
        <Markdown className="-mt-4 mb-12 text-lg md:-mt-6 md:mb-16">{section.body}</Markdown>

        {projects.length === 0 ? (
          <p className="hk-panel-flat bg-paper text-ink hk-pixel inline-block px-4 py-3 text-sm">
            No levels yet. New stages are being built.
          </p>
        ) : null}
      </div>

      {/* ── Scene A: featured cartridges ─────────────────────────────────── */}
      {featured.length > 0 ? (
        <ShowcaseMotion
          accents={featured.map((project) => project.accent_color)}
          labelledBy="featured-title"
        >
          <div className="hk-showcase-stage" data-showcase-stage>
            <div className="hk-showcase-bg" data-showcase-bg aria-hidden="true" />

            <div className="hk-showcase-head hk-wrap">
              <h3 id="featured-title" className="hk-showcase-tag hk-pixel text-sm md:text-base">
                <span aria-hidden="true" className="text-lime">
                  ★{" "}
                </span>
                Featured · Boss rush
              </h3>
              <div className="flex items-center gap-4">
                {featured.length > 1 ? (
                  <p aria-hidden="true" className="hk-showcase-hint hk-pixel text-xs">
                    <span data-hint="swipe">Scroll the row →</span>
                    <span data-hint="pin">Keep scrolling ↓</span>
                  </p>
                ) : null}
                <p aria-hidden="true" className="hk-showcase-counter hk-pixel">
                  <span>
                    <span data-showcase-index>01</span> / {pad2(featured.length)}
                  </span>
                  <span className="hk-showcase-rail">
                    <span data-showcase-progress />
                  </span>
                </p>
              </div>
            </div>

            <ol className={TRACK} data-showcase-track>
              {featured.map((project, i) => (
                <li
                  key={project.id}
                  className="hk-showcase-card w-[min(86vw,34rem)] shrink-0 snap-start"
                  data-card
                >
                  <ProjectCartridge project={project} position={i + 1} total={featured.length} />
                </li>
              ))}
              {/* End cap: points at the full grid; also keeps a one-cartridge row from looking empty. */}
              <li className="hk-showcase-cap w-[min(70vw,19rem)] shrink-0 snap-start">
                <a
                  href="#all-projects"
                  className="group border-paper/70 bg-ink text-paper hover:border-lime flex h-full min-h-64 flex-col justify-between gap-6 border-2 border-dashed p-6 transition-colors"
                >
                  <span className="hk-pixel text-xs opacity-80">
                    <span aria-hidden="true">▸ </span>Continue
                  </span>
                  <span className="hk-display hk-condensed text-[2.5rem] uppercase">
                    {rest > 0
                      ? `+${rest} more ${rest === 1 ? "level" : "levels"}`
                      : "New levels soon"}
                  </span>
                  <span className="hk-pixel flex items-center gap-2 text-xs">
                    {rest > 0 ? "Jump to the grid" : "Browse the grid"}
                    <ArrowDown
                      aria-hidden="true"
                      className="size-4 transition-transform group-hover:translate-y-0.5"
                    />
                  </span>
                </a>
              </li>
            </ol>
          </div>
        </ShowcaseMotion>
      ) : null}

      {/* ── Scene B: all projects ────────────────────────────────────────── */}
      {projects.length > 0 ? (
        <div
          aria-labelledby="all-projects-title"
          role="region"
          id="all-projects"
          className="hk-wrap mt-16 scroll-mt-16 md:mt-24"
          data-grid
        >
          <div className="mb-8 flex flex-wrap items-end justify-between gap-6 md:mb-10">
            <div>
              <p className="hk-pixel mb-3 text-xs opacity-80">
                <span aria-hidden="true">▸ </span>Every stage · {projects.length}
              </p>
              <h3
                id="all-projects-title"
                className="hk-display hk-condensed text-[clamp(2.25rem,5vw,3.75rem)] uppercase"
              >
                All projects
              </h3>
            </div>
            <Link href="/projects" className="hk-btn hk-btn-hot text-base" data-magnetic>
              All projects
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>

          <ProjectGrid projects={projects} as="h4" tone="ink" />
        </div>
      ) : null}
    </section>
  );
}
