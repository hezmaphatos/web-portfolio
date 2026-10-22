import "server-only";

import { cookies } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";

import type { AdminUser } from "@/lib/types";

/**
 * Admin session helpers for the BFF (Route Handlers under app/api/admin) and the admin layout.
 *
 * The Sanctum token lives only in the httpOnly `hk_admin` cookie. It is opaque ("{id}|hk_…"):
 * stored and replayed unchanged, never parsed.
 */

/** Also hard-coded in proxy.ts (Proxy should not import app modules). */
export const ADMIN_COOKIE = "hk_admin";

/** 7 days, the same lifetime as the Sanctum token (SANCTUM_EXPIRATION=10080 minutes). */
const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export function adminCookieOptions(maxAge: number = ADMIN_COOKIE_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** Absolute Laravel URL: `apiUrl("admin/me")` → `{API_URL}/admin/me`. */
export function apiUrl(path: string): string {
  const base = process.env.API_URL;
  if (!base) throw new Error("API_URL is not set.");
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function firstHeaderValue(request: Request, name: string): string | undefined {
  return request.headers.get(name)?.split(",")[0]?.trim() || undefined;
}

/**
 * CSRF guard for state-changing BFF requests. Browsers always send `Origin` on cross-site
 * POST/PUT/PATCH/DELETE, so a present Origin must be this app's own origin. No Origin at all
 * means a non-browser client (curl, server-to-server), which carries no ambient cookie risk.
 *
 * "Own origin" = the origin the browser addressed (Host / X-Forwarded-Host + scheme), the
 * configured public origin, or Next's `request.url` origin. `request.url` alone is not enough:
 * Next builds it from the server's bind hostname (`localhost:3100`), not from the Host header.
 * A cross-site page cannot forge Host or X-Forwarded-* on the victim's request.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return true;

  const url = new URL(request.url);
  const scheme = firstHeaderValue(request, "x-forwarded-proto") ?? url.protocol.replace(/:$/, "");
  const allowed = new Set<string>([url.origin]);
  for (const host of [
    firstHeaderValue(request, "x-forwarded-host"),
    firstHeaderValue(request, "host"),
  ]) {
    if (host) allowed.add(`${scheme}://${host}`);
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site) {
    try {
      allowed.add(new URL(site).origin);
    } catch {
      // Malformed NEXT_PUBLIC_SITE_URL: rely on the request-derived origins.
    }
  }
  return allowed.has(origin);
}

/** Body of a BFF-generated error, same shape as Laravel's (`{ message }`). */
export function jsonError(message: string, status: number): Response {
  return Response.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * The signed-in admin, or `null` when there is no cookie or Laravel rejects the token (401/403).
 * Any other failure (API down, 5xx) throws: that is an outage, not a logged-out user.
 * Never cached across requests; `cache()` only dedupes calls within one render.
 */
export const getAdminUser = cache(async (): Promise<AdminUser | null> => {
  // Request-time only. Without this, Cache Components' runtime prerender stage (cookies
  // available, uncached I/O not) runs into the fetch below and reports a sync `Date.now()`.
  await connection();
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;

  const response = await fetch(apiUrl("admin/me"), {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error(`Admin session check failed (HTTP ${response.status}).`);

  const body = (await response.json()) as { data: AdminUser };
  return body.data;
});
