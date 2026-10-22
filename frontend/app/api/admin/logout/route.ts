import { NextResponse, type NextRequest } from "next/server";

import {
  ADMIN_COOKIE,
  adminCookieOptions,
  apiUrl,
  isSameOrigin,
  jsonError,
} from "@/lib/admin/session";

/**
 * POST /api/admin/logout
 * Revokes the token at Laravel (best effort: an already dead token is fine) and deletes the cookie.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError("Cross-origin request blocked.", 403);

  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (token) {
    try {
      await fetch(apiUrl("admin/logout"), {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
    } catch {
      // API unreachable: still log out locally.
    }
  }

  const response = NextResponse.json(
    { data: { ok: true } },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(ADMIN_COOKIE, "", adminCookieOptions(0));
  return response;
}
