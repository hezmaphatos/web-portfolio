import Link from "next/link";
import { ArrowUpRight, FolderGit2 } from "lucide-react";

import { contrastOn } from "@/components/ui/GenerativePlaceholder";
import { Media } from "@/components/ui/Media";
import { cn, label } from "@/lib/utils";
import type { ProjectDetail } from "@/lib/types";

import { BossBadge } from "./BossBadge";
import { Gallery } from "./Gallery";
import { ProjectMeta } from "./ProjectMeta";
import { ProjectNav } from "./ProjectNav";
import { StoryBlocks, hasStory } from "./StoryBlocks";
import { TechChips } from "./TechChips";
import { VideoEmbed, parseYouTube } from "./VideoEmbed";

type Props = { project: ProjectDetail };

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** Short titles get poster-size type; long ones step down so they stay within ~3 lines. */
function titleSize(title: string): string {
  if (title.length <= 8) return "text-[clamp(4.5rem,19vw,10rem)]";
  if (title.length <= 12) return "text-[clamp(4rem,13vw,9rem)]";
  if (title.length <= 24) return "text-[clamp(3.25rem,9vw,7.25rem)]";
  return "text-[clamp(2.75rem,7vw,6rem)]";
}

function SectionTitle({ id, kicker, children }: { id: string; kicker: string; children: string }) {
  return (
    <header className="mb-10 md:mb-14">
      <p className="hk-pixel text-ink-2 mb-3 text-xs">
        <span aria-hidden="true">▸ </span>
        {kicker}
      </p>
      <h2 id={id} className="hk-display hk-condensed text-[clamp(2.5rem,6vw,4.5rem)] uppercase">
        {children}
      </h2>
    </header>
  );
}

function ExternalButton({
  href,
  children,
  icon: Icon,
  className,
}: {
  href: string;
  children: string;
  icon: typeof ArrowUpRight;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("hk-btn text-base", className)}
    >
      <Icon aria-hidden="true" className="size-4" />
      {children}
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

/**
 * Project Stage content (spec §6.3), static. Used by the full page today and by the
 * intercepting-route modal in phase 6. The project accent drives the whole stage through
 * `--accent`; small text never sits directly on the accent (mid-tone accents can't carry AA
 * body text), only display type does.
 *
 * Phase 6 hooks: [data-stage-cover] (shared-element target of [data-card-cover]),
 * [data-stage-title] (SplitText), [data-stage-links] (Open site / Repo lock),
 * [data-preview-deck] (tabs), [data-tech] (locked chips via <TechChips openCount>).
 */
export function ProjectStage({ project }: Props) {
  const accent = project.accent_color;
  const onAccent = contrastOn(accent);
  const host = hostOf(project.live_url) ?? `${project.slug}.app`;
  const youtube = project.video_url ? parseYouTube(project.video_url) : null;
  const hasVideo = Boolean(youtube) || Boolean(project.video?.mime.startsWith("video/"));
  const hasDeck = project.gallery.length > 0 || hasVideo;
  const story = hasStory(project);

  return (
    <article
      aria-labelledby="stage-title"
      style={{ "--accent": accent } as React.CSSProperties}
      data-stage
      data-project-id={project.id}
    >
      {/* ── Hero: the accent poster ─────────────────────────────────────── */}
      <header
        className="hk-chapter pt-6 pb-14 md:pt-8 md:pb-16"
        style={{ "--chapter-bg": accent, "--chapter-fg": onAccent } as React.CSSProperties}
        data-stage-hero
      >
        <div className="hk-wrap">
          <nav aria-label="Breadcrumb" className="mb-10 md:mb-14">
            <ol className="hk-pixel border-ink bg-paper text-ink inline-flex flex-wrap items-center gap-x-2 border-2 px-3 py-1.5 text-[0.6875rem] md:text-xs">
              <li>
                <Link href="/" className="hover:underline">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/projects" className="hover:underline">
                  Projects
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="max-w-[14rem] truncate opacity-70">
                {project.title}
              </li>
            </ol>
          </nav>

          <div className="grid gap-10 md:grid-cols-12 md:items-end md:gap-8">
            <div className="md:col-span-7">
              <p className="hk-pixel border-ink bg-paper text-ink mb-6 inline-block -rotate-2 border-2 px-3 py-1.5 text-xs shadow-[3px_3px_0_var(--ink)]">
                Level · {label(project.category)}
              </p>
              <h1
                id="stage-title"
                data-stage-title
                className={cn(
                  "hk-display hk-condensed text-balance [overflow-wrap:anywhere] uppercase",
                  titleSize(project.title),
                )}
              >
                {project.title}
              </h1>
              {project.tagline ? (
                <p className="mt-6 max-w-2xl text-2xl leading-snug font-semibold md:text-[1.75rem]">
                  {project.tagline}
                </p>
              ) : null}
            </div>

            <div className="relative z-10 md:col-span-5 md:-mb-36">
              <div
                className="hk-panel mr-2 rotate-1 p-2 md:mr-0 md:rotate-[1.5deg] md:p-2.5"
                data-stage-cover
              >
                <Media
                  media={project.cover}
                  alt={`${project.title} cover`}
                  seed={project.slug}
                  accent={accent}
                  ratio={16 / 10}
                  priority
                  sizes="(min-width: 768px) 30rem, 100vw"
                  className="border-ink border-2"
                />
              </div>
              <BossBadge
                boss={project.boss}
                withName
                className="absolute -top-4 -left-2 -rotate-3 md:-left-5"
              />
            </div>
          </div>
        </div>
      </header>

      {/* ── Overview: summary, links, spec sheet ──────────────────────────── */}
      <section
        aria-labelledby="stage-overview"
        className="hk-chapter pt-12 pb-14 md:pt-14 md:pb-20"
      >
        <h2 id="stage-overview" className="sr-only">
          Overview
        </h2>
        <div className="hk-wrap grid gap-12 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-7">
            {project.summary ? (
              <p className="max-w-[40ch] text-xl leading-snug md:text-2xl">{project.summary}</p>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center gap-4" data-stage-links>
              {project.live_url ? (
                <ExternalButton href={project.live_url} icon={ArrowUpRight} className="hk-btn-hot">
                  Open site
                </ExternalButton>
              ) : null}
              {project.repo_url ? (
                <ExternalButton href={project.repo_url} icon={FolderGit2}>
                  Repo
                </ExternalButton>
              ) : null}
              {!project.live_url && !project.repo_url ? (
                <p className="hk-pixel text-ink-2 text-xs">No public site or repo for this one.</p>
              ) : null}
            </div>
          </div>

          <div className="md:col-span-5 md:pt-24">
            <div className="hk-panel-flat p-5 shadow-[6px_6px_0_var(--accent)] md:p-6">
              <p className="hk-pixel mb-5 flex items-center justify-between text-xs">
                <span>Spec sheet</span>
                <span aria-hidden="true" className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="border-ink size-2 border-2"
                      style={{ backgroundColor: accent }}
                    />
                  ))}
                </span>
              </p>
              <ProjectMeta project={project} />
            </div>
          </div>
        </div>
      </section>

      {/* Phase 6: the Battle Arena (boss projects only, spec §6.4) goes here. */}

      {/* ── Preview Deck (static: screenshots + video) ─────────────────────── */}
      {hasDeck ? (
        <section
          aria-labelledby="stage-deck"
          className="hk-chapter py-16 [--chapter-bg:var(--paper-2)] md:py-24"
          data-preview-deck
        >
          <div className="hk-wrap">
            <SectionTitle id="stage-deck" kicker="Preview deck">
              Preview
            </SectionTitle>
            {project.gallery.length > 0 ? (
              <div data-deck-tab="screenshots">
                <h3 className="hk-pixel mb-6 text-sm">Screenshots</h3>
                <Gallery
                  items={project.gallery}
                  title={project.title}
                  seed={project.slug}
                  accent={accent}
                  address={host}
                />
              </div>
            ) : null}
            {hasVideo ? (
              <div
                data-deck-tab="video"
                className={cn(project.gallery.length > 0 && "mt-16 md:mt-20")}
              >
                <h3 className="hk-pixel mb-6 text-sm">Video</h3>
                <VideoEmbed
                  url={project.video_url}
                  video={project.video}
                  title={project.title}
                  poster={project.cover}
                  className="max-w-4xl"
                />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ── Story + tech ──────────────────────────────────────────────────── */}
      <div className={cn("hk-chapter pb-20 md:pb-28", hasDeck ? "pt-16 md:pt-24" : "pt-6 md:pt-8")}>
        <div className="hk-wrap flex flex-col gap-20 md:gap-28">
          {story ? (
            <section aria-labelledby="stage-story">
              <SectionTitle id="stage-story" kicker="The quest">
                Story
              </SectionTitle>
              <StoryBlocks project={project} />
            </section>
          ) : null}

          {project.skills.length > 0 ? (
            <section aria-labelledby="stage-tech" data-tech>
              <SectionTitle id="stage-tech" kicker="Loadout used">
                Tech used
              </SectionTitle>
              <TechChips
                skills={project.skills}
                openCount={null}
                className="gap-3"
                renderOpen={(skill) => (
                  <Link
                    href="/#skills"
                    className="hk-chip hover:bg-lime px-3.5 text-[0.9375rem] transition-transform hover:-translate-y-0.5"
                  >
                    {skill.name}
                    <span className="sr-only"> (see the Skill Tree)</span>
                  </Link>
                )}
              />
              <p className="text-ink-2 mt-5 text-sm">Pick a skill to find it in the Skill Tree.</p>
            </section>
          ) : null}
        </div>
      </div>

      {/* ── Next / previous level ─────────────────────────────────────────── */}
      <footer className="hk-chapter py-16 [--chapter-bg:var(--ink)] [--chapter-fg:var(--paper)] md:py-24">
        <div className="hk-wrap">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <h2
              id="stage-more"
              className="hk-display hk-condensed text-[clamp(2.25rem,5vw,3.5rem)] uppercase"
            >
              More levels
            </h2>
            <Link href="/projects" className="hk-btn">
              All projects
            </Link>
          </div>
          <ProjectNav prev={project.prev} next={project.next} titleId="stage-more" />
        </div>
      </footer>
    </article>
  );
}
