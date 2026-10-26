import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ProjectGrid } from "@/components/chapters/projects/ProjectGrid";
import { getProjects } from "@/lib/api";

export const metadata: Metadata = {
  title: "All projects",
  description:
    "Every project: web, mobile and machine learning work with the story, screenshots and tech stack behind each one.",
  alternates: { canonical: "/projects" },
};

/**
 * Level index (spec §4 sitemap, §6.2). Static: one cached `getProjects()` (tag `projects`).
 * The grid is the very same component as Scene B on Home (<ProjectGrid>): filter chips + search
 * with a Flip re-flow, hover swap, Peek. Filtering happens on the client over the full list, so
 * the page never reads searchParams (which would make it dynamic); without JavaScript the filter
 * bar is hidden and every project is listed.
 */
export default async function ProjectsIndexPage() {
  const projects = await getProjects();
  const bosses = projects.filter((project) => project.boss.enabled).length;

  return (
    <>
      <header className="hk-chapter pt-20 pb-10 md:pt-24 md:pb-14">
        <div className="hk-wrap">
          <Link
            href="/#projects"
            className="hk-pixel hk-link inline-flex items-center gap-2 text-xs"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            Back to Home
          </Link>

          <div className="mt-10 flex flex-wrap items-end justify-between gap-6 md:mt-12">
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
        </div>
      </header>

      <div className="hk-chapter pt-0">
        <div className="hk-wrap">
          {projects.length === 0 ? (
            <p className="hk-panel-flat hk-pixel inline-block px-4 py-3 text-sm">
              No levels yet. New stages are being built.
            </p>
          ) : (
            <ProjectGrid projects={projects} as="h2" tone="paper" />
          )}
        </div>
      </div>
    </>
  );
}
