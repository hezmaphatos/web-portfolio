import type { Metadata, ResolvingMetadata } from "next";
import { cookies, draftMode } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache, Suspense } from "react";

import { GameOver } from "@/components/game/gameover/GameOver";
import { ProjectStage } from "@/components/project/ProjectStage";
import { ADMIN_COOKIE } from "@/lib/admin/session";
import { getHome, getProject, getProjectPreview, getProjects } from "@/lib/api";
import type { ProjectDetail } from "@/lib/types";

/**
 * Project Stage as a full page (spec §6.3): direct visits, refreshes and shared links. A click on
 * a project card instead opens the same stage as a modal over the current page — the
 * intercepting route app/(site)/@modal/(.)projects/[slug].
 *
 * Static by default: every published slug is prerendered (generateStaticParams) and the data
 * comes from the cached `getProject` (tags `projects` + `project:{slug}`, expired by the backend
 * after admin edits).
 *
 * A blocking route on purpose (`instant = false`, `params` awaited outside <Suspense>): with the
 * ISR App Shell pattern the stage was streamed as a hidden segment that only JavaScript moves
 * into place, so visitors without JS (spec §6.4 noscript) and crawlers saw an empty page, and an
 * unknown slug answered 200. Now the prerendered HTML holds the whole stage inline, and a slug
 * published after the build renders on its first request (then cached), with a real 404 for
 * unknown slugs.
 *
 * Draft preview: /api/admin/preview turns Draft Mode on. Only then does the page read the
 * httpOnly admin cookie and fetch the project uncached with the admin token (drafts included).
 * During prerendering draftMode() is always off, so cookies() is never reached there.
 */

export const instant = false;

/**
 * Real 404 for unknown slugs. Under Cache Components a slug missing from generateStaticParams is
 * otherwise answered with the route's prerendered fallback shell (`x-nextjs-postponed`): the
 * layout is flushed with status 200 before the page runs, so `notFound()` can only add a noindex
 * tag. 'navigation' requires the whole route to be static output, which makes the first request
 * for an unlisted slug wait for the complete prerender instead — `notFound()` then happens before
 * any byte is sent (404), and a real new slug is stored as a static page like the others.
 * (Draft preview still works: Draft Mode bypasses the static output.) The 404 body keeps the
 * layout and a no-JS GAME OVER: see ProjectPage and docs/DECISIONS.md (phases 7B, 8B).
 */
export const ensureStatic = "navigation";

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
      // No og_image / cover: leave `images` out, so the generated ./opengraph-image.tsx fills
      // it (file-based metadata only applies when this object has no `images` key).
      ...(image
        ? {
            images: [
              {
                url: image.url,
                width: image.width ?? undefined,
                height: image.height ?? undefined,
                alt: image.alt ?? project.title,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image ? { images: [image.url] } : {}),
    },
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

/** Throws during render, inside the boundary below (see ProjectPage). */
function LevelNotFound(): never {
  notFound();
}

export default async function ProjectPage({ params }: Params) {
  const { slug } = await params;
  const [{ project, preview }, home] = await Promise.all([loadStage(slug), getHome()]);

  // Unknown slug: `notFound()` is thrown inside a <Suspense> boundary instead of here. Thrown
  // here it failed the whole HTML render and Next answered 404 with an empty error shell that only
  // JavaScript fills. Caught by the boundary, the layout (HUD…) stays in the HTML, the status is
  // still 404, and the fallback — GAME OVER in <noscript> — is what a visitor without JavaScript
  // sees; with JavaScript the client renders this segment's not-found.tsx (the same GAME OVER).
  // A found project never gets the boundary: its stage stays inline static HTML (a boundary
  // around it would turn the stage into a streamed segment only JavaScript reveals).
  if (!project) {
    return (
      <Suspense
        fallback={
          <noscript>
            <GameOver variant="level" />
          </noscript>
        }
      >
        <LevelNotFound />
      </Suspense>
    );
  }

  return (
    <>
      {preview ? <PreviewBanner project={project} /> : null}
      <ProjectStage
        project={project}
        skills={home.skills}
        variant="page"
        countView={!preview && project.status === "published"}
      />
    </>
  );
}
