import { cn, formatYears, label } from "@/lib/utils";
import type { ProjectSummary } from "@/lib/types";

type Props = {
  project: Pick<
    ProjectSummary,
    "role" | "year_start" | "year_end" | "kind" | "team_size" | "progress" | "category"
  >;
  className?: string;
};

/** "Solo" for one person, "5 people" otherwise; null when unknown. */
function teamText(size: number | null): string | null {
  if (size === null) return null;
  return size === 1 ? "Solo" : `${size} people`;
}

/**
 * The spec sheet of a project (spec §6.3 hero meta): role, years, kind, team size, progress.
 * A definition list with pixel labels; rows without data are left out.
 */
export function ProjectMeta({ project, className }: Props) {
  const rows: [string, string | null][] = [
    ["Role", project.role],
    ["Years", formatYears(project.year_start, project.year_end)],
    ["Type", `${label(project.kind)} · ${label(project.category)}`],
    ["Team", teamText(project.team_size)],
    ["Status", label(project.progress)],
  ];

  return (
    <dl className={cn("grid grid-cols-[auto_1fr] gap-x-5 gap-y-3", className)}>
      {rows
        .filter((row): row is [string, string] => row[1] !== null && row[1] !== "")
        .map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="hk-pixel text-ink-2 pt-1 text-[0.6875rem] md:text-xs">{term}</dt>
            <dd className="font-semibold">
              {term === "Status" ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "border-ink inline-block size-2.5 border-2",
                      project.progress === "shipped" && "bg-lime",
                      project.progress === "in_progress" && "bg-hot",
                      project.progress === "archived" && "bg-paper-2",
                    )}
                  />
                  {value}
                </span>
              ) : (
                value
              )}
            </dd>
          </div>
        ))}
    </dl>
  );
}
