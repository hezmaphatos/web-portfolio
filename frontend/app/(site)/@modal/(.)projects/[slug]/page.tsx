import type { Metadata } from "next";
import { Suspense } from "react";

import { ProjectStage } from "@/components/project/ProjectStage";
import { StageModalLoading, StageModalMissing } from "@/components/project/modal/StageModalStates";
import { getHome, getProject } from "@/lib/api";

/**
 * Project Stage as a modal — an intercepting route (spec §6.3).
 *
 * `(.)projects/[slug]` inside the `@modal` slot of app/(site)/layout.tsx: when a client-side
 * navigation (a <Link> click on Home or /projects) goes to /projects/[slug], Next renders this
 * page into the slot instead, over the page the visitor is on. That page (the layout's
 * `children`) stays mounted, the URL still becomes /projects/[slug], and router.back() closes
 * the modal. `(.)` means "the `projects` segment at the same level": the slot belongs to the
 * (site) group, whose level is the root — slots and groups are not segments.
 *
 * A hard navigation (direct URL, refresh, shared link, new tab) never intercepts: the full page
 * app/(site)/projects/[slug]/page.tsx renders, and this slot shows its default.tsx (nothing).
 *
 * Same cached data as the full page: getProject (tags projects + project:{slug}) and getHome
 * (skills for the Arena). Published projects only; drafts are previewed on the full page.
 */

type Params = { params: Promise<{ slug: string }> };

/**
 * Metadata is resolved over every parallel slot, so this page's title wins while the modal is
 * open (the tab shows the project) and Home's comes back with router.back().
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);
  return { title: project ? (project.seo_title ?? project.title) : "Level not found" };
}

async function ModalStage({ params }: Params) {
  const { slug } = await params;
  const [project, home] = await Promise.all([getProject(slug), getHome()]);
  if (!project) return <StageModalMissing />;

  return <ProjectStage project={project} skills={home.skills} variant="modal" />;
}

export default function ProjectModalPage({ params }: Params) {
  return (
    // display: contents — keeps Next's scroll-into-view off the page underneath (see StageModal).
    <div className="contents">
      <Suspense fallback={<StageModalLoading />}>
        <ModalStage params={params} />
      </Suspense>
    </div>
  );
}
