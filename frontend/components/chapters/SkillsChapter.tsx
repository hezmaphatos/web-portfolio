import { ChapterHeading } from "@/components/ui/ChapterHeading";
import type { ProjectSummary, Section, Skill } from "@/lib/types";

// Placeholder — replaced during phase 3.
export function SkillsChapter(props: {
  skills: Skill[];
  projects: ProjectSummary[];
  section: Section;
}) {
  return (
    <section id="skills" aria-labelledby="skills-title" className="hk-chapter">
      <div className="hk-wrap">
        <ChapterHeading level={4} plain="Skills" section={props.section} id="skills-title" />
      </div>
    </section>
  );
}
