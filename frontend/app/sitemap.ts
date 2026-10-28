import type { MetadataRoute } from "next";

import { getProjects } from "@/lib/api";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100").replace(/\/+$/, "");

/** Home, the projects index and every published project (drafts are never listed). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await getProjects();
  return [
    { url: `${SITE}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE}/projects`, changeFrequency: "monthly", priority: 0.8 },
    ...projects.map((project) => ({
      url: `${SITE}/projects/${project.slug}`,
      changeFrequency: "monthly" as const,
      priority: project.is_featured ? 0.7 : 0.6,
    })),
  ];
}
