import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { ADMIN_COOKIE, getAdminUser } from "@/lib/admin/session";

/** Same shape Laravel accepts for project slugs (`alpha_dash`). */
const SLUG = /^[A-Za-z0-9_-]+$/;

/**
 * GET /api/admin/preview?slug=<slug>
 * Turns on Draft Mode for a signed-in admin and opens the public project page in preview mode,
 * where drafts are visible (the public page honours it in phase 3).
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug") ?? "";
  if (!request.cookies.has(ADMIN_COOKIE)) redirect("/admin/login");

  // Draft Mode reveals unpublished content, so the token is verified, not just present.
  // (An API outage throws here and surfaces as a 500 rather than a silent redirect.)
  const user = await getAdminUser();
  // Dead token: `expired=1` keeps proxy.ts from bouncing back to /admin and clears the cookie.
  if (!user) redirect("/admin/login?expired=1");

  if (!SLUG.test(slug)) {
    return Response.json({ message: "A valid project slug is required." }, { status: 400 });
  }

  (await draftMode()).enable();
  redirect(`/projects/${slug}?preview=1`);
}
