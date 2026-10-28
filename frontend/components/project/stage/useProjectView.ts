"use client";

import { useEffect } from "react";

import { recordProjectOpen } from "@/components/game/badges/opened";

/**
 * Counts one view per opening of a Project Stage (spec §6.3 "setiap pembukaan project menambah
 * view_count"): POST {NEXT_PUBLIC_API_URL}/public/projects/{slug}/view, fire-and-forget (the
 * endpoint is throttled per IP; failures are ignored). The browser calls the API directly so
 * the throttle sees the visitor's IP.
 *
 * "Opening" = the stage becoming visible: a mount, or an Activity re-show (Back/Forward into a
 * kept route). Re-renders never send it. The request waits one task and the cleanup cancels it,
 * because React's dev Strict Mode mounts every effect twice: the first timer never fires, so dev
 * and production both send exactly one request.
 */
export function useProjectView(slug: string, enabled: boolean): void {
  useEffect(() => {
    if (enabled) recordProjectOpen(slug); // Curious badge counter (phase 7, idempotent per slug)
    const base = process.env.NEXT_PUBLIC_API_URL;
    if (!enabled || !base) return;
    const timer = setTimeout(() => {
      void fetch(`${base.replace(/\/+$/, "")}/public/projects/${encodeURIComponent(slug)}/view`, {
        method: "POST",
        headers: { Accept: "application/json" },
        credentials: "omit",
        keepalive: true,
      }).catch(() => undefined);
    }, 0);
    return () => clearTimeout(timer);
  }, [slug, enabled]);
}
