import { cn, pad2 } from "@/lib/utils";
import type { Section } from "@/lib/types";

type Props = {
  /** Chapter number from spec §4.1 (hero 1 … contact 7). Shown as the level. */
  level: number;
  /** Plain-language name of the chapter for people who skip the game metaphor ("About"). */
  plain: string;
  section: Pick<Section, "title" | "subtitle">;
  id: string;
  className?: string;
  /** Extra slot right of the title (e.g. the hint "?" button in phase 4). */
  aside?: React.ReactNode;
};

/**
 * Chapter title block: pixel kicker "LV 02 · ABOUT", the editable stage title in big display
 * type, and the optional subtitle. Left-aligned on purpose (no centered hero headings).
 */
export function ChapterHeading({ level, plain, section, id, className, aside }: Props) {
  return (
    <header className={cn("mb-10 md:mb-14", className)}>
      <p className="hk-pixel mb-3 text-xs opacity-80 md:text-sm">
        <span aria-hidden="true">▸ </span>LV {pad2(level)} · {plain}
      </p>
      <div className="flex items-start gap-4">
        <h2 id={id} className="hk-display hk-condensed text-[clamp(2.75rem,8vw,6.5rem)] uppercase">
          {section.title}
        </h2>
        {aside}
      </div>
      {section.subtitle ? (
        <p className="mt-4 max-w-2xl text-lg md:text-xl">{section.subtitle}</p>
      ) : null}
    </header>
  );
}
