# Learning notes

Short explanations of the frontend techniques used in this project, written for a Laravel/React developer. Each entry: what it is, where it is used here, and the one thing that is easy to get wrong.

## Next.js 16: Cache Components

`cacheComponents: true` (in `next.config.ts`) replaces the old `fetch` cache options. A function or component marked `"use cache"` is cached and becomes part of the prerendered static shell; `cacheTag("home")` labels it so `revalidateTag("home", …)` can expire it on demand (our backend calls `POST /api/revalidate` after every admin edit). Anything that reads request data (`cookies()`, `headers()`, `searchParams`) must sit inside `<Suspense>` so the rest of the page can stay static.
