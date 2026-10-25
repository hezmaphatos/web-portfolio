import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Media } from "@/components/ui/Media";
import { cn, formatYears, label } from "@/lib/utils";
import type { ProjectSummary } from "@/lib/types";

import { BossBadge } from "./BossBadge";
import { TechChips } from "./TechChips";

type Props = {
  project: ProjectSummary;
  /** Heading level of the card title, so the outline stays ordered wherever the grid sits. */
  as?: "h3" | "h4";
  /** Background the card sits on: on ink, the hard shadow takes the project accent. */
  tone?: "paper" | "ink";
  /** Position in the grid; picks the (small) tilt so neighbours never match. */
  index?: number;
  className?: string;
};

const TILTS = [
  "md:-rotate-[0.6deg]",
  "md:rotate-[0.5deg]",
  "md:-rotate-[0.2deg]",
  "md:rotate-[0.8deg]",
];

/**
 * Grid card (Scene B and /projects, spec §6.2): cover, category + years, title, tagline, tech,
 * boss sticker. The whole card is clickable through the title link (stretched with ::after),
 * so the accessible name stays the title. Phase 6 adds the Flip filter ([data-grid-item],
 * [data-category], [data-skills]), the hover cover swap and Peek.
 */
export function ProjectCard({
  project,
  as: Heading = "h3",
  tone = "paper",
  index = 0,
  className,
}: Props) {
  const years = formatYears(project.year_start, project.year_end);

  return (
    <article
      className={cn(
        // Phones: compact row (cover strip + text) so a long catalogue stays scannable.
        "group hk-panel relative grid h-full grid-cols-[6.5rem_minmax(0,1fr)] overflow-hidden sm:flex sm:flex-col",
        "transition-transform duration-150 ease-out hover:-translate-x-0.5 hover:-translate-y-1 hover:rotate-0 active:translate-x-0.5 active:translate-y-0.5",
        "has-[a:focus-visible]:outline-volt has-[a:focus-visible]:outline-[3px] has-[a:focus-visible]:outline-offset-4 has-[a:focus-visible]:outline-solid",
        tone === "ink" && "shadow-[6px_6px_0_var(--card-accent)]",
        TILTS[index % TILTS.length],
        className,
      )}
      style={{ "--card-accent": project.accent_color } as React.CSSProperties}
      data-grid-item
      data-project-id={project.id}
      data-category={project.category}
      data-skills={project.skills.map((s) => s.slug).join(" ")}
    >
      <div className="border-ink relative border-r-2 sm:border-r-0 sm:border-b-2" data-card-cover>
        <Media
          media={project.cover}
          alt={`${project.title} cover`}
          seed={project.slug}
          accent={project.accent_color}
          ratio={16 / 10}
          thumb
          sizes="(min-width: 1024px) 24rem, (min-width: 640px) 50vw, 7rem"
          className="max-sm:aspect-auto! max-sm:h-full"
        />
        <BossBadge
          boss={project.boss}
          size="sm"
          className="absolute bottom-3 left-3 -rotate-2 max-sm:hidden"
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2 p-3.5 sm:flex-1 sm:gap-3 sm:p-4 md:p-5">
        <p className="hk-pixel text-ink-2 flex flex-wrap items-center gap-x-2 text-[0.6875rem]">
          <span
            aria-hidden="true"
            className="border-ink inline-block size-2.5 border-2"
            style={{ backgroundColor: project.accent_color }}
          />
          <span>{label(project.category)}</span>
          {years ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{years}</span>
            </>
          ) : null}
        </p>

        <Heading className="hk-display hk-condensed text-[1.5rem] uppercase sm:text-[1.75rem] md:text-[2rem]">
          <Link
            href={`/projects/${project.slug}`}
            prefetch={true}
            className="after:absolute after:inset-0 after:z-10 after:content-[''] focus-visible:outline-none"
          >
            {project.title}
          </Link>
        </Heading>

        {project.tagline ? (
          <p className="line-clamp-2 text-sm sm:line-clamp-3 sm:text-[0.9375rem]">
            {project.tagline}
          </p>
        ) : null}

        <BossBadge boss={project.boss} size="sm" className="self-start sm:hidden" />

        <TechChips
          skills={project.skills}
          projectId={project.id}
          bossEnabled={project.boss.enabled}
          className="mt-auto pt-1 sm:pt-2"
        />

        <p
          aria-hidden="true"
          className="hk-pixel border-ink mt-1 hidden items-center justify-between border-t-2 border-dashed pt-3 text-[0.6875rem] sm:flex"
        >
          <span>Enter level</span>
          <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </p>
      </div>
    </article>
  );
}
