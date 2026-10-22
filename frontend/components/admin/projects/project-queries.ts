"use client";

import { useQuery } from "@tanstack/react-query";

import { adminGet } from "@/lib/admin/api";
import { useResourceList } from "@/lib/admin/resource";
import type { AdminSite, AdminSkill } from "@/lib/types";

/** Spec §7 / §8 default for `tech_visible_percent`. */
export const DEFAULT_TECH_VISIBLE_PERCENT = 50;

/** Same key and shape as the Profile & Site page (GET /admin/site). */
export const siteQueryKey = ["admin", "site"] as const;

/** `tech_visible_percent` from the site settings (shared, cached query). */
export function useTechVisiblePercent() {
  const site = useQuery({
    queryKey: siteQueryKey,
    queryFn: () => adminGet<AdminSite>("site"),
  });
  return {
    percent: site.data?.tech_visible_percent ?? DEFAULT_TECH_VISIBLE_PERCENT,
    isPending: site.isPending,
    isError: site.isError,
  };
}

/** Every skill (game and soft, visible and hidden) for the Tech tab and the Boss Preview. */
export function useAllSkills() {
  return useResourceList<AdminSkill>("skills");
}
