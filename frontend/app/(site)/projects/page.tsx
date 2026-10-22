import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ProjectCard } from "@/components/project/ProjectCard";
import { getProjects } from "@/lib/api";
import { label } from "@/lib/utils";
import { PROJECT_CATEGORIES, type ProjectSummary } from "@/lib/types";

export const metadata: Metadata = {
  title: "All projects",
  description:
    "Every project: web, mobile and machine learning work with the story, screenshots and tech stack behind each one.",
  alternates: { canonical: "/projects" },
};

/**
 * Level index (spec §4 sitemap, §6.2). Static: one cached `getProjects()` (tag `projects`).
 * The filter works without JavaScript and without reading searchParams (which would make the
 * page dynamic): every project is rendered once, grouped by category, and the filter chips are
 * jump links to those groups. Phase 6 swaps this for the Flip-animated filter over one grid.
 */
export default async function ProjectsIndexPage() {
  const projects = await getProjects();
  const groups = PROJECT_CATEGORIES.map((category) => ({
    category,
    items: projects.filter((project) => project.category === category),
  })).filter((group) => group.items.length > 0);
  const bosses = projects.filter((project) => project.boss.enabled).length;

  return (
    <>
      <header className="hk-chapter pt-8 pb-12 md:pt-10 md:pb-16">
        <div className="hk-wrap">
          <Link
            href="/#projects"
            className="hk-pixel hk-link inline-flex items-center gap-2 text-xs"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            Back to Home
          </Link>

          <div className="mt-12 flex flex-wrap items-end justify-between gap-6 md:mt-16">
            <div>
              <p className="hk-pixel mb-3 text-xs opacity-80 md:text-sm">
                <span aria-hidden="true">▸ </span>LV 05 · Level select
              </p>
              <h1 className="hk-display hk-condensed text-[clamp(4rem,22vw,6rem)] uppercase sm:text-[clamp(4rem,12vw,9rem)]">
                All{" "}
                <span className="text-hot block [text-shadow:0.045em_0.045em_0_var(--ink)] sm:inline">
                  projects
                </span>
              </h1>
            </div>
            {projects.length > 0 ? (
              <p className="hk-sticker hk-pixel -rotate-2 text-xs md:mb-4">
                {projects.length} {projects.length === 1 ? "level" : "levels"} · {bosses}{" "}
                {bosses === 1 ? "boss" : "bosses"}
              </p>
            ) : null}
          </div>

          {groups.length > 1 ? (
            <nav aria-label="Filter by category" className="mt-10">
              <ul className="flex flex-wrap gap-3">
                {groups.map(({ category, items }) => (
                  <li key={category}>
                    <a
                      href={`#${category}`}
                      className="hk-chip hover:bg-lime h-10 gap-2 px-4 text-sm transition-transform hover:-translate-y-0.5"
                    >
                      {label(category)}
                      <span className="hk-mono bg-ink text-paper rounded-full px-1.5 py-0.5 text-[0.6875rem]">
                        {items.length}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </header>

      <div className="hk-chapter pt-0">
        <div className="hk-wrap flex flex-col gap-20 md:gap-28">
          {groups.length === 0 ? (
            <p className="hk-panel-flat hk-pixel inline-block self-start px-4 py-3 text-sm">
              No levels yet. New stages are being built.
            </p>
          ) : null}

          {groups.map(({ category, items }) => (
            <CategoryGroup key={category} category={category} items={items} />
          ))}
        </div>
      </div>
    </>
  );
}

function CategoryGroup({ category, items }: { category: string; items: ProjectSummary[] }) {
  return (
    <section id={category} aria-labelledby={`${category}-title`} className="scroll-mt-8">
      <div className="border-ink mb-10 flex items-baseline justify-between gap-4 border-b-2 pb-4">
        <h2
          id={`${category}-title`}
          className="hk-display hk-condensed text-[clamp(2.25rem,6vw,4rem)] uppercase"
        >
          {label(category)}
        </h2>
        <p className="hk-pixel text-xs">
          {items.length} {items.length === 1 ? "project" : "projects"}
        </p>
      </div>
      <ul className="grid gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((project, i) => (
          <li key={project.id}>
            <ProjectCard project={project} as="h3" index={i} />
          </li>
        ))}
      </ul>
    </section>
  );
}
