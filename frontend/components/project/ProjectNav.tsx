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
  /**
   * Inside the Stage modal: swap the project in place (history replace), so closing the modal
   * returns to the page it was opened from instead of walking back through every level.
   */
  replace?: boolean;
  className?: string;
};

function TileFace({ link, dir }: { link: ProjectLink; dir: "prev" | "next" }) {
  const Arrow = dir === "prev" ? ArrowLeft : ArrowRight;
  return (
    <>
      <span className="hk-level-tile-kicker hk-pixel">
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
      <span className="hk-level-tile-title hk-display hk-condensed">
        <span className="text-balance">{link.title}</span>
        <Arrow aria-hidden="true" className="hk-level-tile-arrow" strokeWidth={2.5} />
      </span>
    </>
  );
}

/**
 * One neighbour tile. Two identical faces share the tile: the ink base and, on top, the
 * neighbour's accent face, clipped away (clip-path: inset) and wiped in from the side the arrow
 * points to on hover / keyboard focus. Only clip-path and transform move (CSS transitions,
 * instant in Lite / reduced motion). The accent face is aria-hidden: one accessible name.
 */
function Tile({
  link,
  dir,
  replace,
  className,
}: {
  link: ProjectLink;
  dir: "prev" | "next";
  replace?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={`/projects/${link.slug}`}
      prefetch={true}
      replace={replace}
      // The page / modal underneath must not jump to the top: the modal resets its own panel.
      scroll={false}
      rel={dir}
      className={cn("hk-level-tile group", className)}
      style={
        {
          "--tile-accent": link.accent_color,
          "--tile-on": contrastOn(link.accent_color),
        } as React.CSSProperties
      }
      data-nav={dir}
    >
      <span className="hk-level-tile-face">
        <TileFace link={link} dir={dir} />
      </span>
      <span className="hk-level-tile-face hk-level-tile-reveal" aria-hidden="true">
        <TileFace link={link} dir={dir} />
      </span>
    </Link>
  );
}

/**
 * Previous / next project footer of the Project Stage (spec §6.3 item 6). Neighbours come from
 * the API (published projects by sort_order); a missing side leaves the other tile alone.
 */
export function ProjectNav({ prev, next, titleId, replace, className }: Props) {
  if (!prev && !next) return null;

  return (
    <nav aria-labelledby={titleId} className={cn("grid gap-8 md:grid-cols-2 md:gap-10", className)}>
      {prev ? <Tile link={prev} dir="prev" replace={replace} className="md:-rotate-1" /> : null}
      {next ? (
        <Tile
          link={next}
          dir="next"
          replace={replace}
          className={cn("md:rotate-1", !prev && "md:col-start-2")}
        />
      ) : null}
    </nav>
  );
}
