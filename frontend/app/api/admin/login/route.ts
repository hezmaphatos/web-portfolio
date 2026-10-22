import { NextResponse, type NextRequest } from "next/server";

import {
  ADMIN_COOKIE,
  adminCookieOptions,
  apiUrl,
  isSameOrigin,
  jsonError,
} from "@/lib/admin/session";
import type { AdminUser } from "@/lib/types";

/**
 * POST /api/admin/login { email, password }
 * Exchanges the credentials for a Sanctum token at Laravel and keeps the token in the httpOnly
 * `hk_admin` cookie. The browser only ever receives `{ data: { user } }`.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError("Cross-origin request blocked.", 403);

  let credentials: { email?: unknown; password?: unknown };
  try {
    credentials = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch(apiUrl("admin/login"), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      cache: "no-store",
    });
  } catch {
    return jsonError("The API is unreachable. Try again later.", 502);
  }

  if (!upstream.ok) {
    // 422 (bad credentials / validation) and 429 (throttle) pass through unchanged.
    const headers = new Headers({
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    });
    const retryAfter = upstream.headers.get("retry-after");
    if (retryAfter) headers.set("Retry-After", retryAfter);
    return new Response(await upstream.text(), { status: upstream.status, headers });
  }

  const body = (await upstream.json()) as { data?: { token?: unknown; user?: AdminUser } };
  const token = body.data?.token;
  if (typeof token !== "string" || token === "" || !body.data?.user) {
    return jsonError("Unexpected response from the API.", 502);
  }

  const response = NextResponse.json(
    { data: { user: body.data.user } },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(ADMIN_COOKIE, token, adminCookieOptions());
  return response;
}
