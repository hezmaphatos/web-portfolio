import type { Metadata, ResolvingMetadata } from "next";
import { cookies, draftMode } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense, cache } from "react";

import { ProjectStage } from "@/components/project/ProjectStage";
import { ADMIN_COOKIE } from "@/lib/admin/session";
import { getProject, getProjectPreview, getProjects } from "@/lib/api";
import type { ProjectDetail } from "@/lib/types";

/**
 * Project Stage as a full page (spec §6.3; the modal over Home comes in phase 6).
 *
 * Static by default: every published slug is prerendered (generateStaticParams), the data comes
 * from the cached `getProject` (tags `projects` + `project:{slug}`, expired by the backend after
 * admin edits), and `params` is awaited inside <Suspense> so a slug published after the build
 * gets the App Shell at once and is cached after its first visit (ISR with Cache Components).
 *
 * Draft preview: /api/admin/preview turns Draft Mode on. Only then does the page read the
 * httpOnly admin cookie and fetch the project uncached with the admin token (drafts included).
 * During prerendering draftMode() is always off, so cookies() is never reached there.
 */

/** Cache Components needs at least one param at build time; an empty catalogue 404s on it. */
const PLACEHOLDER_SLUG = "__no-projects__";

export async function generateStaticParams() {
  const projects = await getProjects();
  if (projects.length === 0) return [{ slug: PLACEHOLDER_SLUG }];
  return projects.map((project) => ({ slug: project.slug }));
}

type Params = { params: Promise<{ slug: string }> };
type Stage = { project: ProjectDetail | null; preview: boolean };

/** One lookup per request, shared by generateMetadata and the page. */
const loadStage = cache(async (slug: string): Promise<Stage> => {
  if (slug === PLACEHOLDER_SLUG) return { project: null, preview: false };

  const { isEnabled } = await draftMode();
  if (isEnabled) {
    const token = (await cookies()).get(ADMIN_COOKIE)?.value;
    const draft = token ? await getProjectPreview(slug, token) : null;
    // A stale bypass cookie without a valid admin session falls back to the public page.
    if (draft) return { project: draft, preview: true };
  }

  return { project: await getProject(slug), preview: false };
});

export async function generateMetadata(
  { params }: Params,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { slug } = await params;
  const { project, preview } = await loadStage(slug);
  if (!project) return { title: "Level not found", robots: { index: false } };

  const title = project.seo_title ?? project.title;
  const description = project.seo_description ?? project.tagline ?? project.summary ?? undefined;
  const image =
    project.og_image ?? (project.cover?.mime.startsWith("image/") ? project.cover : null);
  const parentOg = (await parent).openGraph;
  const url = `/projects/${project.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    ...(preview || project.status === "draft" ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      type: "article",
      siteName: parentOg?.siteName,
      title,
      description,
      url,
      images: image
        ? [
            {
              url: image.url,
              width: image.width ?? undefined,
              height: image.height ?? undefined,
              alt: image.alt ?? project.title,
            },
          ]
        : parentOg?.images,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description },
  };
}

async function exitPreview(projectId: number) {
  "use server";
  (await draftMode()).disable();
  redirect(`/admin/projects/${Math.trunc(Number(projectId)) || ""}`);
}

function PreviewBanner({ project }: { project: ProjectDetail }) {
  return (
    <aside
      role="status"
      className="bg-ink text-paper border-hot sticky top-0 z-50 border-b-4 px-4 py-2.5"
    >
      <div className="hk-wrap flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="flex flex-wrap items-center gap-3 text-sm">
          <span className="hk-pixel bg-hot text-ink px-2 py-1 text-xs leading-none">
            Preview — {project.status}
          </span>
          <span>
            {project.status === "draft"
              ? "Only signed-in admins can see this page."
              : "You are seeing the latest saved version, uncached."}
          </span>
        </p>
        <form action={exitPreview.bind(null, project.id)}>
          <button type="submit" className="hk-btn hk-btn-ink border-paper min-h-9 py-1.5 text-sm">
            Exit preview
          </button>
        </form>
      </div>
    </aside>
  );
}

async function StageContent({ params }: Params) {
  const { slug } = await params;
  const { project, preview } = await loadStage(slug);
  if (!project) notFound();

  return (
    <>
      {preview ? <PreviewBanner project={project} /> : null}
      <ProjectStage project={project} />
    </>
  );
}

/** App Shell for slugs that were not prerendered: shown until the stage streams in. */
function StageFallback() {
  return (
    <div className="hk-chapter min-h-[70svh] pt-8 [--chapter-bg:var(--paper-2)]" aria-busy="true">
      <div className="hk-wrap">
        <p className="hk-pixel text-sm" role="status">
          <span aria-hidden="true">▸ </span>Loading level…
        </p>
        <div aria-hidden="true" className="mt-12 flex flex-col gap-4">
          <span className="bg-ink/10 block h-16 w-3/4 md:h-24" />
          <span className="bg-ink/10 block h-16 w-1/2 md:h-24" />
          <span className="bg-ink/10 mt-6 block h-6 w-2/3" />
        </div>
      </div>
    </div>
  );
}

export default function ProjectPage({ params }: Params) {
  return (
    <Suspense fallback={<StageFallback />}>
      <StageContent params={params} />
    </Suspense>
  );
}
