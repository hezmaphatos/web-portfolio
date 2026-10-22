import { ChapterHeading } from "@/components/ui/ChapterHeading";
import type { Award, Section } from "@/lib/types";

// Placeholder — replaced during phase 3.
export function TrophiesChapter(props: { awards: Award[]; section: Section }) {
  return (
    <section id="trophies" aria-labelledby="trophies-title" className="hk-chapter">
      <div className="hk-wrap">
        <ChapterHeading level={6} plain="Trophies" section={props.section} id="trophies-title" />
      </div>
    </section>
  );
}
