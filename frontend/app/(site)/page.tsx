import { AboutChapter } from "@/components/chapters/AboutChapter";
import { ContactChapter } from "@/components/chapters/ContactChapter";
import { HeroChapter } from "@/components/chapters/HeroChapter";
import { JourneyChapter } from "@/components/chapters/JourneyChapter";
import { ProjectsChapter } from "@/components/chapters/ProjectsChapter";
import { SkillsChapter } from "@/components/chapters/SkillsChapter";
import { TrophiesChapter } from "@/components/chapters/TrophiesChapter";
import { BootScreen } from "@/components/game/splash/BootScreen";
import { getHome } from "@/lib/api";
import type { HomePayload } from "@/lib/types";
import { sectionsByKey } from "@/lib/utils";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100").replace(/\/+$/, "");

/** schema.org Person for search engines, built from the admin-managed profile. */
function personJsonLd({ site, experiences }: HomePayload) {
  const current = experiences.find(
    (experience) => experience.is_current && experience.type !== "education",
  );
  const school = experiences.find((experience) => experience.type === "education");
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: site.full_name,
    alternateName: site.nickname,
    url: `${SITE}/`,
    jobTitle: site.headline ?? undefined,
    description: site.short_bio ?? undefined,
    ...(site.email ? { email: `mailto:${site.email}` } : {}),
    ...(site.portrait
      ? { image: site.portrait.url }
      : site.avatar
        ? { image: site.avatar.url }
        : {}),
    ...(site.location
      ? { address: { "@type": "PostalAddress", addressLocality: site.location } }
      : {}),
    ...(current ? { worksFor: { "@type": "Organization", name: current.organization } } : {}),
    ...(school ? { alumniOf: { "@type": "CollegeOrUniversity", name: school.organization } } : {}),
    knowsAbout: [...site.soft_skills],
    sameAs: site.socials.map((social) => social.url),
  };
}

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
      {/* Chapter 0: the boot screen, a fixed overlay above the Hero (shown only by the head script). */}
      {s.boot ? (
        <BootScreen
          wordmark={home.site.nickname}
          title={s.hero?.title ?? "Player One"}
          label={s.boot.title}
          hint={s.boot.hint}
          bossIds={home.projects.filter((p) => p.boss.enabled).map((p) => p.id)}
        />
      ) : null}
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
      <script
        type="application/ld+json"
        // JSON-LD Person (spec §12). "<" is escaped so admin-written text can never close the tag.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(personJsonLd(home)).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
