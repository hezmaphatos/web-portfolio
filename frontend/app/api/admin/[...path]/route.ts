import { NextResponse, type NextRequest } from "next/server";

import {
  ADMIN_COOKIE,
  adminCookieOptions,
  apiUrl,
  isSameOrigin,
  jsonError,
} from "@/lib/admin/session";

/**
 * BFF proxy: /api/admin/<path>?<search> → {API_URL}/admin/<path>?<search>
 *
 * Adds `Authorization: Bearer <hk_admin cookie>` so the token never reaches browser JavaScript.
 * The more specific /api/admin/{login,logout,preview} routes take precedence over this catch-all.
 * Reading the cookie makes every handler request-time (never prerendered or cached).
 */

type Context = { params: Promise<{ path: string[] }> };

/** Upstream response headers worth passing on; everything else (encoding, length…) is recomputed. */
const PASSTHROUGH_HEADERS = ["content-type", "content-disposition", "retry-after"] as const;

/** Node's fetch needs `duplex: "half"` to send a streamed body; lib.dom's RequestInit lacks it. */
type StreamingRequestInit = RequestInit & { duplex?: "half" };

async function forward(request: NextRequest, { params }: Context): Promise<Response> {
  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";

  if (hasBody && !isSameOrigin(request)) return jsonError("Cross-origin request blocked.", 403);

  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) return jsonError("Unauthenticated.", 401);

  const { path } = await params;
  // Params arrive decoded; refuse dot segments so an encoded "%2E%2E" can't climb out of /admin.
  if (path.some((segment) => segment === "." || segment === "..")) {
    return jsonError("Not found.", 404);
  }
  const target = `${apiUrl(`admin/${path.map(encodeURIComponent).join("/")}`)}${request.nextUrl.search}`;

  const headers = new Headers({ Accept: "application/json", Authorization: `Bearer ${token}` });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const contentLength = request.headers.get("content-length");
  if (hasBody && contentLength) headers.set("Content-Length", contentLength);

  const init: StreamingRequestInit = {
    method,
    headers,
    cache: "no-store",
    redirect: "manual",
    signal: request.signal,
  };
  if (hasBody && request.body) {
    // Streamed, not buffered: multipart uploads (videos up to 30 MB) pass straight through.
    init.body = request.body;
    init.duplex = "half";
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return jsonError("The API is unreachable. Try again later.", 502);
  }

  const responseHeaders = new Headers({ "Cache-Control": "no-store" });
  for (const name of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  const response = new NextResponse(method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });

  if (upstream.status === 401) {
    // Expired or revoked token: drop the dead cookie so proxy.ts sends the next page load to login.
    response.cookies.set(ADMIN_COOKIE, "", adminCookieOptions(0));
  }

  return response;
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
