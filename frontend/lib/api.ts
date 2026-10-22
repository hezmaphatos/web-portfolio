import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { HomePayload, ProjectDetail, ProjectSummary } from "@/lib/types";

/**
 * Public data for Server Components. Every reader is `"use cache"` with a long lifetime and a
 * tag; the backend expires the tags after each admin edit (POST /api/revalidate), so pages stay
 * static and still show changes on the next visit without a rebuild.
 *
 * Tags (docs/API.md): Home `home`; projects index `projects`; detail `projects` + `project:{slug}`.
 */

export class PublicApiError extends Error {
  constructor(
    public status: number,
    path: string,
  ) {
    super(`Public API ${path} answered ${status}`);
    this.name = "PublicApiError";
  }
}

function apiBase(): string {
  const base = process.env.API_URL;
  if (!base) throw new Error("API_URL is not set.");
  return base.replace(/\/+$/, "");
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase()}/${path}`, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  });
  if (!response.ok) throw new PublicApiError(response.status, path);
  const body = (await response.json()) as { data: T };
  return body.data;
}

export async function getHome(): Promise<HomePayload> {
  "use cache";
  cacheLife("max");
  cacheTag("home");
  return getJson<HomePayload>("public/home");
}

export async function getProjects(): Promise<ProjectSummary[]> {
  "use cache";
  cacheLife("max");
  cacheTag("projects");
  return getJson<ProjectSummary[]>("public/projects");
}

/** Published project, or null when the slug is unknown (or a draft). */
export async function getProject(slug: string): Promise<ProjectDetail | null> {
  "use cache";
  cacheLife("max");
  cacheTag("projects", `project:${slug}`);
  try {
    return await getJson<ProjectDetail>(`public/projects/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Admin preview (Draft Mode): the same endpoint with the admin token, so drafts are returned too.
 * Never cached — it is per request and may contain unpublished content.
 */
export async function getProjectPreview(
  slug: string,
  token: string,
): Promise<ProjectDetail | null> {
  try {
    return await getJson<ProjectDetail>(`public/projects/${encodeURIComponent(slug)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof PublicApiError && (error.status === 404 || error.status === 401)) {
      return null;
    }
    throw error;
  }
}
