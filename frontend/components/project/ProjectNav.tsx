import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { contrastOn } from "@/components/ui/GenerativePlaceholder";
import { cn } from "@/lib/utils";
import type { ProjectLink } from "@/lib/types";

type Props = {
  prev: ProjectLink | null;
  next: ProjectLink | null;
  /** Id of the heading that labels the nav. */
  titleId?: string;
  className?: string;
};

function Tile({
  link,
  dir,
  className,
}: {
  link: ProjectLink;
  dir: "prev" | "next";
  className?: string;
}) {
  const Arrow = dir === "prev" ? ArrowLeft : ArrowRight;
  return (
    <Link
      href={`/projects/${link.slug}`}
      prefetch={true}
      rel={dir}
      className={cn(
        "group border-paper relative flex min-h-48 flex-col justify-between gap-8 border-2 p-6 md:min-h-60 md:p-8",
        "shadow-[6px_6px_0_var(--paper)] transition-transform duration-150 ease-out hover:-translate-y-1",
        dir === "prev" ? "md:-rotate-1" : "md:rotate-1 md:items-end md:text-right",
        className,
      )}
      style={{ backgroundColor: link.accent_color, color: contrastOn(link.accent_color) }}
      data-nav={dir}
    >
      <span
        className={cn(
          "hk-pixel bg-ink text-paper inline-flex items-center gap-2 self-start px-2 py-1 text-[0.6875rem]",
          dir === "next" && "md:self-end",
        )}
      >
        {dir === "prev" ? (
          <>
            <Arrow aria-hidden="true" className="size-3.5" />
            Previous level
          </>
        ) : (
          <>
            Next level
            <Arrow aria-hidden="true" className="size-3.5" />
          </>
        )}
      </span>
      <span className="hk-display hk-condensed flex items-end gap-3 text-[clamp(2rem,4.5vw,3.5rem)] uppercase">
        <span className="text-balance">{link.title}</span>
        <Arrow
          aria-hidden="true"
          className={cn(
            "mb-1 size-8 shrink-0 transition-transform",
            dir === "prev" ? "order-first group-hover:-translate-x-1" : "group-hover:translate-x-1",
          )}
        />
      </span>
    </Link>
  );
}

/**
 * Previous / next project footer of the Project Stage (spec §6.3 item 6), coloured with each
 * neighbour's accent. Neighbours come from the API (published projects by sort_order); a missing
 * side simply leaves the other tile alone. Phase 6 adds the hover reveal.
 */
export function ProjectNav({ prev, next, titleId, className }: Props) {
  if (!prev && !next) return null;

  return (
    <nav aria-labelledby={titleId} className={cn("grid gap-8 md:grid-cols-2 md:gap-10", className)}>
      {prev ? <Tile link={prev} dir="prev" /> : null}
      {next ? <Tile link={next} dir="next" className={cn(!prev && "md:col-start-2")} /> : null}
    </nav>
  );
}
