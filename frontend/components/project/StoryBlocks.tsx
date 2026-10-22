import { Markdown } from "@/components/ui/Markdown";
import { cn, label } from "@/lib/utils";
import type { ProjectDetail } from "@/lib/types";

type StoryFields = Pick<
  ProjectDetail,
  | "problem"
  | "solution"
  | "impact"
  | "description"
  | "highlights"
  | "challenges"
  | "role"
  | "team_size"
  | "kind"
>;

type Props = {
  project: StoryFields;
  /** Level of the block headings (the section heading above them is one level up). */
  as?: "h3" | "h4";
  className?: string;
};

const filled = (text: string | null): text is string => Boolean(text?.trim());

/** Whether any story block has content (the page hides the whole section otherwise). */
export function hasStory(project: StoryFields): boolean {
  return (
    [project.problem, project.solution, project.impact, project.description, project.role].some(
      filled,
    ) ||
    project.highlights.length > 0 ||
    project.challenges.length > 0
  );
}

/** Author headings inside markdown (hk-prose leaves them unstyled). */
const MD_HEADINGS =
  "[&_:is(h1,h2,h3,h4,h5,h6)]:text-[1.25em] [&_:is(h1,h2,h3,h4,h5,h6)]:leading-tight [&_:is(h1,h2,h3,h4,h5,h6)]:font-bold";

/** Each step is its own surface and tilt: a sequence, not three identical cards. */
const STEP_STYLES = [
  "bg-paper -rotate-[0.6deg] shadow-[4px_4px_0_var(--ink)]",
  "bg-paper rotate-[0.4deg] shadow-[4px_4px_0_var(--accent)]",
  "bg-lime -rotate-[0.3deg] shadow-[4px_4px_0_var(--ink)]",
];

/**
 * The project story (spec §6.3 item 4): Problem → Solution → Impact, My role (role + the
 * long-form description), Highlights, Challenges. Markdown goes through <Markdown> (sanitised);
 * empty blocks are not rendered.
 */
export function StoryBlocks({ project, as: Heading = "h3", className }: Props) {
  const steps = (
    [
      ["Problem", project.problem],
      ["Solution", project.solution],
      ["Impact", project.impact],
    ] satisfies [string, string | null][]
  ).filter((step): step is [string, string] => filled(step[1]));

  const team =
    project.team_size === null
      ? null
      : project.team_size === 1
        ? "Solo"
        : `Team of ${project.team_size}`;
  const context = [team, `${label(project.kind)} project`].filter(Boolean).join(" · ");
  const hasRole = filled(project.role) || filled(project.description);

  if (!hasStory(project)) return null;

  return (
    <div className={cn("flex flex-col gap-16 md:gap-20", className)} data-story>
      {steps.length > 0 ? (
        <ol
          className={cn(
            "grid gap-8",
            steps.length === 2 && "md:grid-cols-2",
            steps.length === 3 && "md:grid-cols-3",
          )}
        >
          {steps.map(([title, text], i) => (
            <li
              key={title}
              className={cn(
                "border-ink relative flex flex-col gap-4 rounded-[2px] border-2 p-5 md:p-6",
                STEP_STYLES[i],
              )}
            >
              <Heading className="hk-pixel flex items-center gap-3 text-sm">
                <span
                  aria-hidden="true"
                  className="bg-ink text-paper hk-mono px-1.5 py-0.5 text-xs tracking-normal"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                {title}
              </Heading>
              <Markdown className={cn("text-[1.0625rem]", MD_HEADINGS)}>{text}</Markdown>
              {i < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="hk-pixel bg-ink text-paper absolute -bottom-6 left-6 z-10 px-2 py-1 text-sm md:top-1/2 md:-right-6 md:bottom-auto md:left-auto md:-translate-y-1/2"
                >
                  <span className="md:hidden">↓</span>
                  <span className="hidden md:inline">→</span>
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      {hasRole ? (
        <div className="grid gap-6 md:grid-cols-12 md:gap-10">
          <div className="md:col-span-5 lg:col-span-4">
            <Heading className="hk-pixel mb-3 text-sm">
              <span aria-hidden="true">▸ </span>My role
            </Heading>
            {filled(project.role) ? (
              <p className="hk-display hk-condensed text-[clamp(2.25rem,5vw,3.5rem)] uppercase">
                {project.role}
              </p>
            ) : null}
            <p className="hk-pixel text-ink-2 mt-4 text-xs">{context}</p>
          </div>
          {filled(project.description) ? (
            <Markdown className={cn("text-lg md:col-span-7 lg:col-span-8", MD_HEADINGS)}>
              {project.description}
            </Markdown>
          ) : null}
        </div>
      ) : null}

      {project.highlights.length > 0 || project.challenges.length > 0 ? (
        <div className="grid gap-12 md:grid-cols-2 md:gap-10">
          {(
            [
              ["Highlights", project.highlights, "bg-lime"],
              ["Challenges", project.challenges, "bg-hot"],
            ] as const
          )
            .filter(([, items]) => items.length > 0)
            .map(([title, items, marker]) => (
              <div key={title}>
                <Heading className="hk-pixel mb-4 text-sm">
                  <span aria-hidden="true">▸ </span>
                  {title}
                </Heading>
                <ul className="border-ink border-t-2">
                  {items.map((item, i) => (
                    <li
                      key={`${i}-${item}`}
                      className="border-ink flex gap-4 border-b-2 border-dashed py-4 text-[1.0625rem]"
                    >
                      <span
                        aria-hidden="true"
                        className={cn("border-ink mt-2 size-3 shrink-0 border-2", marker)}
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
}
