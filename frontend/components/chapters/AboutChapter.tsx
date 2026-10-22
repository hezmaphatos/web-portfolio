import { ChapterHeading } from "@/components/ui/ChapterHeading";
import type { Section, Site } from "@/lib/types";

// Placeholder — replaced during phase 3.
export function AboutChapter(props: { site: Site; section: Section; projectsCount: number }) {
  return (
    <section id="about" aria-labelledby="about-title" className="hk-chapter">
      <div className="hk-wrap">
        <ChapterHeading level={2} plain="About" section={props.section} id="about-title" />
      </div>
    </section>
  );
}
