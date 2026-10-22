import { ChapterHeading } from "@/components/ui/ChapterHeading";
import type { ProjectSummary, Section, Site } from "@/lib/types";

// Placeholder — replaced during phase 3.
export function ProjectsChapter(props: {
  projects: ProjectSummary[];
  section: Section;
  site: Site;
}) {
  return (
    <section id="projects" aria-labelledby="projects-title" className="hk-chapter">
      <div className="hk-wrap">
        <ChapterHeading level={5} plain="Projects" section={props.section} id="projects-title" />
      </div>
    </section>
  );
}
