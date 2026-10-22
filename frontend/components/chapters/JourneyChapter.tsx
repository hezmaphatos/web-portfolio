import { ChapterHeading } from "@/components/ui/ChapterHeading";
import type { Experience, Section } from "@/lib/types";

// Placeholder — replaced during phase 3.
export function JourneyChapter(props: { experiences: Experience[]; section: Section }) {
  return (
    <section id="journey" aria-labelledby="journey-title" className="hk-chapter">
      <div className="hk-wrap">
        <ChapterHeading level={3} plain="Journey" section={props.section} id="journey-title" />
      </div>
    </section>
  );
}
