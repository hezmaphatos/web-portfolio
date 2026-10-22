# Learning notes

Short explanations of the frontend techniques used in this project, written for a Laravel/React developer. Each entry: what it is, where it is used here, and the one thing that is easy to get wrong.

## Next.js 16: Cache Components

`cacheComponents: true` (in `next.config.ts`) replaces the old `fetch` cache options. A function or component marked `"use cache"` is cached and becomes part of the prerendered static shell; `cacheTag("home")` labels it so `revalidateTag("home", …)` can expire it on demand (our backend calls `POST /api/revalidate` after every admin edit). Anything that reads request data (`cookies()`, `headers()`, `searchParams`) must sit inside `<Suspense>` so the rest of the page can stay static.

## Admin auth: BFF + httpOnly cookie + proxy.ts

The browser never talks to Laravel's admin API and never sees the Sanctum token. `app/api/admin/login` (a Route Handler, i.e. server code) posts the credentials to Laravel, puts the returned token in an **httpOnly** cookie `hk_admin` (SameSite=Lax, Secure in production, 7 days) and answers only `{ data: { user } }`. Every later admin call goes to the same-origin **BFF** ("backend for frontend") catch-all `app/api/admin/[...path]`, which reads the cookie on the server and forwards to `{API_URL}/admin/<path>` with `Authorization: Bearer …`, streaming bodies so 30 MB uploads pass through. JavaScript can't read an httpOnly cookie, so an XSS bug can't steal the token, and since Laravel is only called server-side, CORS and token storage never come up. Because the browser sends the cookie automatically, non-GET BFF requests reject a foreign `Origin` header (CSRF guard). A Laravel 401 also deletes the cookie.

`proxy.ts` (Next 16's new name for `middleware.ts`) runs before `/admin/*` pages and only checks whether the cookie _exists_: no cookie → `/admin/login?next=…`, cookie on the login page → `/admin`. It's an optimistic redirect, not security. The real check is in the `(panel)` layout: `SessionGate` calls Laravel `/admin/me` with the token and `redirect()`s when it's dead. With Cache Components, anything that reads cookies must sit inside `<Suspense>`, so the sidebar/topbar stay static and only the gate streams in. The easy thing to get wrong: `await connection()` before the uncached `fetch`. Otherwise Next's runtime prerender stage (cookies available, uncached I/O not) reports a `Date.now()` error.

## Cache Components in practice: `"use cache"`, tags and on-demand revalidation

`lib/api.ts` marks each reader with `"use cache"`, `cacheLife("max")` and `cacheTag("home")`. At build time Next runs it once and bakes the result into the static HTML. When the admin saves, Laravel posts `{ tags: ["home"] }` to `app/api/revalidate/route.ts`, which calls `revalidateTag("home", { expire: 0 })`; the next visitor triggers a fresh render. Easy to get wrong: reading `cookies()`/`headers()`/`searchParams` (or `params` outside `<Suspense>` for dynamic routes) silently makes a route dynamic — check the `○ / ◐ / ƒ` markers in `next build` output.

## Filtering without JavaScript: radio inputs + `:has()`

The Journey tabs are real `<input type="radio">`s styled as tabs. A rule like `[&:has(#quest-filter-work:checked)_[data-group]:not([data-group=work])]:hidden` hides the other entries purely in CSS, so the filter works with JS off (Lite mode) and the phase-4 Flip animation can be layered on top of the same inputs.

## Draft Mode for previews of a static page

`draftMode().enable()` (in `/api/admin/preview`) sets a bypass cookie. The project page checks `(await draftMode()).isEnabled`; only then does it read the admin cookie and fetch the draft without cache. Everyone else gets the prerendered page — previewing never makes the public route dynamic.
