import { timingSafeEqual } from "node:crypto";

import { revalidateTag } from "next/cache";

/**
 * Called by the backend (RevalidationService) after every public-content write:
 * POST { "tags": ["home", "projects", "project:mindlens"] } with header x-revalidate-secret.
 */

const TAG = /^(home|projects|project:[a-z0-9]+(?:-[a-z0-9]+)*)$/;

function validSecret(given: string | null): boolean {
  const expected = process.env.REVALIDATE_SECRET ?? "";
  if (expected === "" || given === null) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!validSecret(request.headers.get("x-revalidate-secret"))) {
    return Response.json({ message: "Invalid secret." }, { status: 401 });
  }

  let tags: unknown;
  try {
    tags = ((await request.json()) as { tags?: unknown }).tags;
  } catch {
    return Response.json({ message: "Invalid JSON." }, { status: 400 });
  }

  if (
    !Array.isArray(tags) ||
    tags.length === 0 ||
    tags.length > 20 ||
    !tags.every((tag) => typeof tag === "string" && TAG.test(tag))
  ) {
    return Response.json({ message: "Unknown tags." }, { status: 422 });
  }

  // expire: 0 → the next visit waits for fresh data instead of being served the stale page once.
  for (const tag of tags as string[]) {
    revalidateTag(tag, { expire: 0 });
  }

  return Response.json({ data: { revalidated: tags } });
}
