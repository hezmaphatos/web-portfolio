import Link from "next/link";

import { contrastOn } from "@/components/ui/GenerativePlaceholder";
import { Media } from "@/components/ui/Media";
import { cn, label } from "@/lib/utils";
import type { ProjectDetail, Skill } from "@/lib/types";

import { BossBadge } from "./BossBadge";
import { BattleArena } from "./arena/BattleArena";
import { PreviewDeck } from "./deck/PreviewDeck";
import { deckTabs, hostOf } from "./deck/media";
import { ProjectMeta } from "./ProjectMeta";
import { ProjectNav } from "./ProjectNav";
import { StageIntro } from "./stage/StageIntro";
import { StageLinks } from "./stage/StageLinks";
import { StoryBlocks, hasStory } from "./StoryBlocks";
import { TechChips } from "./TechChips";

type Props = {
  project: ProjectDetail;
  /** Visible game skills (Home payload): the Arena loadout is built from them. */
  skills: Skill[];
  /**
   * "page": the full page (/projects/[slug] after a direct visit or refresh).
   * "modal": inside the intercepting-route modal over Home or /projects (no breadcrumb — the
   * modal has ✕ / Esc; next / previous swap the project in place).
   */
  variant?: "page" | "modal";
  /** Count this opening (off for admin previews and drafts). */
  countView?: boolean;
};

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

/**
 * Project Stage (spec §6.3), shared by the full page and the modal. Server-rendered and fully
 * readable without JS; client islands add the motion and the game: <StageIntro> (title reveal,
 * shared-element cover, view count), <StageLinks> / <TechChips> (boss lock),
 * <BattleArena>, <PreviewDeck>. The project accent drives the whole stage through `--accent`;
 * small text never sits directly on the accent (mid-tone accents can't carry AA body text),
 * only display type does.
 *
 * Ids carry the variant and slug: a full page and a modal (or Activity-kept copies of other
 * stages) can be in the document at the same time.
 *
 * Hooks for the client parts: [data-stage] (root), [data-stage-cover] (shared-element target
 * of the card's [data-card-cover]), [data-stage-title] (SplitText), [data-stage-links],
 * [data-preview-deck], [data-tech], and [data-stage-scroller] on the modal's scroll container.
 */
export function ProjectStage({ project, skills, variant = "page", countView = true }: Props) {
  const accent = project.accent_color;
  const onAccent = contrastOn(accent);
  const host = hostOf(project.live_url) ?? `${project.slug}.app`;
  const tabs = deckTabs(project);
  const hasDeck = tabs.length > 0;
  const story = hasStory(project);

  const prefix = `stage-${variant}-${project.slug}`;
  const ids = {
    title: `${prefix}-title`,
    overview: `${prefix}-overview`,
    deck: `${prefix}-deck`,
    story: `${prefix}-story`,
    tech: `${prefix}-tech`,
    more: `${prefix}-more`,
  };

  return (
    <article
      aria-labelledby={ids.title}
      style={{ "--accent": accent } as React.CSSProperties}
      data-stage
      data-stage-variant={variant}
      data-project-id={project.id}
    >
      <StageIntro
        projectId={project.id}
        slug={project.slug}
        accent={accent}
        titleId={ids.title}
        countView={countView}
      />

      {/* ── Hero: the accent poster ─────────────────────────────────────── */}
      <header
        className={cn(
          "hk-chapter pb-14 md:pb-16",
          variant === "modal" ? "pt-16 md:pt-14" : "pt-6 md:pt-8",
        )}
        style={{ "--chapter-bg": accent, "--chapter-fg": onAccent } as React.CSSProperties}
        data-stage-hero
      >
        <div className="hk-wrap">
          {variant === "page" ? (
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
          ) : null}

          <div className="grid gap-10 md:grid-cols-12 md:items-end md:gap-8">
            <div className="md:col-span-7">
              <p className="hk-pixel border-ink bg-paper text-ink mb-6 inline-block -rotate-2 border-2 px-3 py-1.5 text-xs shadow-[3px_3px_0_var(--ink)]">
                Level · {label(project.category)}
              </p>
              <h1
                id={ids.title}
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
      <section aria-labelledby={ids.overview} className="hk-chapter pt-12 pb-14 md:pt-14 md:pb-20">
        <h2 id={ids.overview} className="sr-only">
          Overview
        </h2>
        <div className="hk-wrap grid gap-12 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-7">
            {project.summary ? (
              <p className="max-w-[40ch] text-xl leading-snug md:text-2xl">{project.summary}</p>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-4" data-stage-links>
              <StageLinks
                projectId={project.id}
                bossEnabled={project.boss.enabled}
                liveUrl={project.live_url}
                repoUrl={project.repo_url}
              />
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

      {/* Battle Arena (boss projects only, spec §6.4). */}
      {project.boss.enabled ? <BattleArena project={project} skills={skills} /> : null}

      {/* ── Preview Deck: Screenshots / Video / Live ───────────────────────── */}
      {hasDeck ? (
        <section
          aria-labelledby={ids.deck}
          className="hk-chapter py-16 [--chapter-bg:var(--paper-2)] md:py-24"
          data-preview-deck
        >
          <div className="hk-wrap">
            <SectionTitle id={ids.deck} kicker="Preview deck">
              Preview
            </SectionTitle>
            <PreviewDeck
              projectId={project.id}
              slug={project.slug}
              title={project.title}
              accent={accent}
              bossEnabled={project.boss.enabled}
              gallery={project.gallery}
              videoUrl={project.video_url}
              video={project.video}
              cover={project.cover}
              liveUrl={project.live_url}
              allowIframe={project.allow_iframe_preview}
              address={host}
              idPrefix={prefix}
            />
          </div>
        </section>
      ) : null}

      {/* ── Story + tech ──────────────────────────────────────────────────── */}
      <div className={cn("hk-chapter pb-20 md:pb-28", hasDeck ? "pt-16 md:pt-24" : "pt-6 md:pt-8")}>
        <div className="hk-wrap flex flex-col gap-20 md:gap-28">
          {story ? (
            <section aria-labelledby={ids.story}>
              <SectionTitle id={ids.story} kicker="The quest">
                Story
              </SectionTitle>
              <StoryBlocks project={project} />
            </section>
          ) : null}

          {project.skills.length > 0 ? (
            <section aria-labelledby={ids.tech} data-tech>
              <SectionTitle id={ids.tech} kicker="Loadout used">
                Tech used
              </SectionTitle>
              <TechChips
                skills={project.skills}
                projectId={project.id}
                bossEnabled={project.boss.enabled}
                className="gap-3"
                link={{
                  href: "/#skills",
                  className:
                    "hover:bg-lime px-3.5 text-[0.9375rem] transition-transform hover:-translate-y-0.5",
                  srSuffix: "(see the Skill Tree)",
                }}
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
              id={ids.more}
              className="hk-display hk-condensed text-[clamp(2.25rem,5vw,3.5rem)] uppercase"
            >
              More levels
            </h2>
            <Link href="/projects" className="hk-btn">
              All projects
            </Link>
          </div>
          <ProjectNav
            prev={project.prev}
            next={project.next}
            titleId={ids.more}
            replace={variant === "modal"}
          />
        </div>
      </footer>
    </article>
  );
}
