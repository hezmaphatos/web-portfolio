import { ProjectCard } from "@/components/project/ProjectCard";
import type { PeekProject } from "@/components/project/PeekProvider";
import { label } from "@/lib/utils";
import { PROJECT_CATEGORIES, type ProjectSummary } from "@/lib/types";

import { GridFilter, type FilterOption, type GridEntry } from "./GridFilter";
import { searchText } from "./search";

type Props = {
  projects: ProjectSummary[];
  /** Heading level of each card title (h4 under the chapter's h3, h2 on /projects). */
  as: "h2" | "h3" | "h4";
  tone: "ink" | "paper";
  className?: string;
};

/** Without JavaScript the filters cannot work: hide the whole bar, every card stays visible. */
const NO_JS = ".hk-filters{display:none!important}";

/**
 * Scene B grid (spec §6.2) — one component for Home and /projects ("Grid yang sama dipakai di
 * /projects"). A Server Component: it renders every card once and derives the filter options
 * from the data (only categories / tech that occur, with counts) plus a compact search index;
 * <GridFilter> (client) adds the chips, search, Flip, Peek and the Stage hand-off.
 */
export function ProjectGrid({ projects, as, tone, className }: Props) {
  const entries: GridEntry[] = projects.map((project, i) => ({
    id: project.id,
    category: project.category,
    skills: project.skills.map((skill) => skill.slug),
    text: searchText(project),
    node: <ProjectCard project={project} as={as} tone={tone} index={i} />,
  }));

  const categories: FilterOption[] = PROJECT_CATEGORIES.map((category) => ({
    value: category,
    label: label(category),
    count: projects.filter((project) => project.category === category).length,
  })).filter((option) => option.count > 0);

  // Tech used by the most projects first (ties: alphabetical).
  const techCounts = new Map<string, FilterOption>();
  for (const project of projects) {
    for (const skill of project.skills) {
      const option = techCounts.get(skill.slug) ?? {
        value: skill.slug,
        label: skill.name,
        count: 0,
      };
      option.count += 1;
      techCounts.set(skill.slug, option);
    }
  }
  const techs = [...techCounts.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );

  const peek: PeekProject[] = projects.map((project) => ({
    id: project.id,
    slug: project.slug,
    title: project.title,
    tagline: project.tagline,
    summary: project.summary,
    category: project.category,
    kind: project.kind,
    year_start: project.year_start,
    year_end: project.year_end,
    accent_color: project.accent_color,
    cover: project.cover,
    peek: project.peek,
    skills: project.skills,
    boss: project.boss,
  }));

  return (
    <>
      <noscript>
        <style>{NO_JS}</style>
      </noscript>
      <GridFilter
        entries={entries}
        categories={categories}
        techs={techs}
        peek={peek}
        tone={tone}
        className={className}
      />
    </>
  );
}
