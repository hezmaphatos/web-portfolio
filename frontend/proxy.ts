import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic admin route guard (Next 16 Proxy, formerly Middleware). It only looks at whether
 * the session cookie exists; the real check (token validated by Laravel) runs in the admin
 * (panel) layout and in the /api/admin BFF. Kept free of app imports on purpose.
 */

/** Same name as ADMIN_COOKIE in lib/admin/session.ts. */
const ADMIN_COOKIE = "hk_admin";
const LOGIN_PATH = "/admin/login";

export function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;
  const hasSession = request.cookies.has(ADMIN_COOKIE);
  const isLogin = pathname === LOGIN_PATH || pathname === `${LOGIN_PATH}/`;

  if (!hasSession && !isLogin) {
    const url = new URL(LOGIN_PATH, request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  // `expired=1`: the layout found the cookie's token dead, so the login page must stay reachable
  // (it clears the stale cookie itself) instead of bouncing back to /admin.
  if (hasSession && isLogin && !searchParams.has("expired")) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};
