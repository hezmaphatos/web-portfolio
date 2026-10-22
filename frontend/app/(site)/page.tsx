import { AboutChapter } from "@/components/chapters/AboutChapter";
import { ContactChapter } from "@/components/chapters/ContactChapter";
import { HeroChapter } from "@/components/chapters/HeroChapter";
import { JourneyChapter } from "@/components/chapters/JourneyChapter";
import { ProjectsChapter } from "@/components/chapters/ProjectsChapter";
import { SkillsChapter } from "@/components/chapters/SkillsChapter";
import { TrophiesChapter } from "@/components/chapters/TrophiesChapter";
import { getHome } from "@/lib/api";
import { sectionsByKey } from "@/lib/utils";

/**
 * Home: every chapter in the fixed order of spec §4.1. A chapter hidden in the admin
 * (sections.is_visible = false) is simply not in the payload and not rendered.
 * Static: one cached API call (`home` tag), revalidated by the backend after admin edits.
 */
export default async function HomePage() {
  const home = await getHome();
  const s = sectionsByKey(home);

  return (
    <>
      {s.hero ? <HeroChapter site={home.site} section={s.hero} /> : null}
      {s.about ? (
        <AboutChapter site={home.site} section={s.about} projectsCount={home.projects.length} />
      ) : null}
      {s.journey ? <JourneyChapter experiences={home.experiences} section={s.journey} /> : null}
      {s.skills ? (
        <SkillsChapter skills={home.skills} projects={home.projects} section={s.skills} />
      ) : null}
      {s.projects ? (
        <ProjectsChapter projects={home.projects} section={s.projects} site={home.site} />
      ) : null}
      {s.trophies ? <TrophiesChapter awards={home.awards} section={s.trophies} /> : null}
      {s.contact ? <ContactChapter site={home.site} section={s.contact} /> : null}
    </>
  );
}
