import { ChapterHeading } from "@/components/ui/ChapterHeading";
import type { Section, Site } from "@/lib/types";

// Placeholder — replaced during phase 3.
export function ContactChapter(props: { site: Site; section: Section }) {
  return (
    <section id="contact" aria-labelledby="contact-title" className="hk-chapter">
      <div className="hk-wrap">
        <ChapterHeading level={7} plain="Contact" section={props.section} id="contact-title" />
      </div>
    </section>
  );
}
