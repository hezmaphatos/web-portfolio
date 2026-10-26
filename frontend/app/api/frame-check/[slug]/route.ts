import { cacheLife, cacheTag } from "next/cache";

import { getProject } from "@/lib/api";
import { frameVerdict } from "@/lib/framing";

/**
 * GET /api/frame-check/{slug} → { data: { frameable: boolean | null, reason } }
 *
 * Asked by the Live tab (components/project/deck/LivePreview.tsx) right before it inserts the
 * iframe: may this project's `live_url` be framed by this site? A page refused by
 * X-Frame-Options / frame-ancestors still fires the iframe's `load` event (the browser's own
 * error page loads), so the 6 s timeout alone would never catch it; the headers do.
 *
 * Only the admin-set `live_url` of a published project is ever fetched (the slug is looked up,
 * never a URL from the request), so this is not an open proxy. `frameable: null` = could not
 * tell (timeout, network): the client then just tries, with its timeout as the safety net.
 */

type Reason = "ok" | "blocked" | "disabled" | "missing" | "unreachable";
type FrameCheck = { frameable: boolean | null; reason: Reason };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TIMEOUT_MS = 4000;

function siteOrigin(request: Request): URL {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? request.url);
  } catch {
    return new URL(request.url);
  }
}

/** Cached per slug + site origin; the project tags expire it when the admin edits the project. */
async function checkFrame(slug: string, origin: string): Promise<FrameCheck> {
  "use cache";
  cacheTag("projects", `project:${slug}`);

  const project = await getProject(slug);
  let target: URL | null = null;
  try {
    target = project?.live_url ? new URL(project.live_url) : null;
  } catch {
    target = null;
  }
  if (!project || !target || !/^https?:$/.test(target.protocol)) {
    cacheLife("hours");
    return { frameable: false, reason: "missing" };
  }
  if (!project.allow_iframe_preview) {
    cacheLife("hours");
    return { frameable: false, reason: "disabled" };
  }

  try {
    const response = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "text/html,*/*;q=0.8" },
    });
    void response.body?.cancel(); // only the headers matter
    const verdict = frameVerdict(
      {
        xFrameOptions: response.headers.get("x-frame-options"),
        contentSecurityPolicy: response.headers.get("content-security-policy"),
      },
      new URL(response.url || target),
      new URL(origin),
    );
    cacheLife("hours");
    return verdict === "allowed"
      ? { frameable: true, reason: "ok" }
      : { frameable: false, reason: "blocked" };
  } catch {
    cacheLife("minutes"); // a hiccup must not stick for hours
    return { frameable: null, reason: "unreachable" };
  }
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!SLUG.test(slug)) {
    return Response.json({ message: "Unknown project." }, { status: 404 });
  }
  const result = await checkFrame(slug, siteOrigin(request).origin);
  return Response.json({ data: result }, { headers: { "Cache-Control": "private, max-age=300" } });
}
