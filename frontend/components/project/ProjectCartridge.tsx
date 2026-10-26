import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { DefeatedStamp } from "@/components/chapters/projects/DefeatedStamp";
import { contrastOn } from "@/components/ui/GenerativePlaceholder";
import { Media } from "@/components/ui/Media";
import { cn, formatYears, label, pad2 } from "@/lib/utils";
import type { ProjectSummary } from "@/lib/types";

import { BossBadge } from "./BossBadge";
import { TechChips } from "./TechChips";

type Props = {
  project: ProjectSummary;
  /** 1-based position in the showcase and the showcase length, for the "01 / 03" counter. */
  position: number;
  total: number;
  className?: string;
};

/**
 * Featured project as a big game cartridge (Scene A, spec §6.1): a ridged top strip in the
 * project accent with the counter, the cover as the label, then title, tagline, years, tech
 * and the boss sticker (tier sprite + HP, struck through once beaten) plus the DEFEATED stamp.
 *
 * Two layouts, chosen by CSS only (app/globals.css, phase 6B block): portrait in the swipe
 * carousel (phones, tablets, Lite), landscape — cover left, text right — while the showcase is
 * pinned on desktop, so a whole cartridge fits a short laptop viewport. The hooks:
 * .hk-cart / .hk-cart-strip / .hk-cart-cover / .hk-cart-body / .hk-cart-title / .hk-cart-tagline,
 * [data-card-cover] (the shared-element source for the Project Stage), `--card-on` (ink or
 * paper, whichever reads on the accent: the focus ring while the section wears that accent).
 */
export function ProjectCartridge({ project, position, total, className }: Props) {
  const years = formatYears(project.year_start, project.year_end);

  return (
    <article
      className={cn(
        "hk-cart group hk-panel relative flex h-full flex-col transition-transform duration-150 ease-out",
        "shadow-[8px_8px_0_var(--card-accent)] hover:-translate-y-1 hover:rotate-0",
        "has-[a:focus-visible]:outline-volt has-[a:focus-visible]:outline-[3px] has-[a:focus-visible]:outline-offset-4 has-[a:focus-visible]:outline-solid",
        position % 2 === 1 ? "-rotate-1" : "rotate-[0.8deg]",
        className,
      )}
      style={
        {
          "--card-accent": project.accent_color,
          "--card-on": contrastOn(project.accent_color),
        } as React.CSSProperties
      }
      data-project-id={project.id}
      data-accent={project.accent_color}
      data-cursor="VIEW"
    >
      {/* Cartridge grip: ridges + counter on the accent strip. */}
      <div
        className="hk-cart-strip border-ink flex items-center justify-between gap-4 rounded-tr-[12px] border-b-2 px-4 py-2.5"
        style={{ backgroundColor: project.accent_color }}
      >
        <span aria-hidden="true" className="flex h-5 gap-1.5">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="bg-ink block w-1.5" />
          ))}
        </span>
        <span className="hk-pixel bg-ink text-paper px-2 py-1 text-[0.6875rem] leading-none">
          <span className="sr-only">Featured project </span>
          {pad2(position)} / {pad2(total)}
        </span>
      </div>

      <div className="hk-cart-cover p-3 pb-0 md:p-4 md:pb-0">
        <div className="border-ink relative border-2" data-card-cover>
          <Media
            media={project.cover}
            alt={`${project.title} cover`}
            seed={project.slug}
            accent={project.accent_color}
            ratio={16 / 9}
            sizes="(min-width: 1024px) 30rem, (min-width: 768px) 34rem, 86vw"
          />
          <DefeatedStamp projectId={project.id} bossEnabled={project.boss.enabled} />
          <BossBadge
            boss={project.boss}
            projectId={project.id}
            className="absolute -bottom-4 left-3 z-[2] -rotate-3"
          />
        </div>
      </div>

      <div className="hk-cart-body flex flex-1 flex-col gap-3 px-4 pt-8 pb-5 md:px-6 md:pb-6">
        <p className="hk-pixel text-ink-2 flex flex-wrap gap-x-2 text-[0.6875rem] md:text-xs">
          {years ? (
            <>
              <span>{years}</span>
              <span aria-hidden="true">·</span>
            </>
          ) : null}
          <span>{label(project.category)}</span>
          <span aria-hidden="true">·</span>
          <span>{label(project.kind)}</span>
        </p>

        <h4 className="hk-cart-title hk-display hk-condensed text-[clamp(2.25rem,6vw,3.25rem)] text-balance uppercase">
          <Link
            href={`/projects/${project.slug}`}
            prefetch={true}
            className="after:absolute after:inset-0 after:z-10 after:content-[''] focus-visible:outline-none"
          >
            {project.title}
          </Link>
        </h4>

        {project.tagline ? (
          <p className="hk-cart-tagline text-base md:text-lg">{project.tagline}</p>
        ) : null}

        <TechChips
          skills={project.skills}
          projectId={project.id}
          bossEnabled={project.boss.enabled}
          className="mt-auto pt-3"
        />

        <p
          aria-hidden="true"
          className="hk-pixel mt-2 flex items-center gap-2 text-xs transition-transform group-hover:translate-x-1"
        >
          Enter level <ArrowRight className="size-4" />
        </p>
      </div>
    </article>
  );
}
