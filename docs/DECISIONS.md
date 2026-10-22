# Decisions

Choices the spec leaves open, or small deviations from it. One entry each: decision — reason.

## Phase 0 — Bootstrap

- Laravel 13 on the portable PHP 8.4 (`C:\Users\natan\tools\php84`), not XAMPP's PHP 8.2 or Laragon's PHP 8.1 — Laravel 13 needs PHP 8.3+. MySQL 8.0 still comes from Laragon.
- The backend runs on `php artisan serve` (127.0.0.1:8100), not Laragon's Apache — Laragon's Apache is bound to its PHP 8.1.
- Ports 8100 (API) and 3100 (web) instead of 8000/3000 — another local project already listens on 8000/3000.
- `APP_URL`/`API_URL` use `127.0.0.1`, not `localhost` — Node resolves `localhost` to IPv6 first while `artisan serve` binds IPv4.
- Root `npm run dev` (concurrently) starts API, queue worker and web; `scripts/php.mjs` picks the PHP binary from `PHP_BIN` in the root `.env`.
- PHPUnit (Laravel's default) instead of Pest — the spec allows either; one less dependency.
- Next.js keeps the `create-next-app` 16.4 defaults: Cache Components + Partial Prefetching on, Turbopack with the `@tailwindcss/turbopack` loader — recommended model going forward and part of the learning goal.
- `@hookform/resolvers` pinned to v5 — v6 has an unresolvable optional peer conflict (`effect`); v5 supports Zod 4.
- ESLint stays on v9 — `eslint-config-next` 16.4 targets it.
- Added `NEXT_PUBLIC_API_URL` to the frontend env — the three public POSTs (view, defeat, contact) go straight from the browser to Laravel so the per-IP throttles see the visitor's IP.
- Laravel's Vite/Tailwind scaffold, welcome view and Boost `AGENTS.md`/`CLAUDE.md` were removed from `backend/` — it serves JSON only.

## Phase 1 — Backend core

- Controllers take plain ids (no implicit model binding); Services `findOrFail`, and `bootstrap/app.php` renders a generic `{"message":"Not found."}` so model class names never leak.
- Unauthenticated API requests always get 401 JSON (`redirectGuestsTo(fn () => null)`) — there is no `login` route in an API-only app.
- "Array access, no object access" allows Eloquent *write* methods on a fetched instance (`update`, `delete`, `createToken`, relation writes); reads always use array access.
- Reorder = one locked SELECT + one UPSERT of full rows in a transaction: a partial upsert (`id`, `sort_order` only) fails on NOT NULL columns in MySQL strict mode and SQLite (verified).
- Project pivots (skills, gallery) are written with one `detach()` + one batch `attach()`; `sync()` with pivot data runs one query per row.
- DB-dependent validation (ids exist, gallery items are images, merged-state rules on partial updates) lives in Form Request `after()` hooks with one `whereIn` count per list.
- MySQL CHECK constraints enforce the game ranges; SQLite (tests) relies on the Form Requests.
- `media.original_path` (extra column): the untouched upload, with EXIF, kept on the private `local` disk and never given a URL. Media `size` is the served file's size. GIFs are stored as uploaded (animation kept).
- Media references are kind-checked (images for covers/avatars/logos…, PDF for the CV, video for project video); replace requires the same kind; images over 40 MP are rejected before decoding.
- Media upload/delete don't revalidate (nothing public changes); alt edits and replace do. Project reorder revalidates `home` + `projects` only.
- View and defeat have separate 30/min/IP limiters (`project-view`, `project-defeat`).
- Skill and other updates are partial (`sometimes`); game fields are required whenever the resulting category isn't `soft`.
- Login token is Sanctum's opaque `"{id}|hk_…"`; unknown emails are checked against a dummy bcrypt hash (timing); new passwords 12–72 chars.
- Contact honeypot returns the same 201 without storing; IPs are stored as HMAC-SHA256 with the app key.
- PostgreSQL is seeded as a game skill (database, Lv 3, "Vacuum Full", 50 dmg / 2.5 s): Mindlens' Lampiran A tech list needs it, though it isn't in the skill table → 16 game + 6 soft skills.
- LinkedIn URL seeded as `https://www.linkedin.com/in/yehezkiel-natanael` — derived from the CV's "linkedin/yehezkiel-natanael"; the owner should verify it in admin.
- Content seeders are insert-only (never overwrite admin edits on re-seed); `AdminUserSeeder` keeps exactly one admin and doubles as password recovery (`php artisan db:seed --class=AdminUserSeeder`).
- `SiteService` (not `SiteSettingService`) to match the `site` resource, controller and request names.

## Phase 2 — Admin panel

- shadcn/ui components live in `components/admin/ui` (spec reserves `components/ui` for the site); their tokens are scoped to `.admin-theme`, and `AdminBodyTheme` mirrors that class onto `<body>` while the admin is mounted so Radix portals (dialogs, selects) get it too. No dark mode.
- shadcn 4.22 imports `cn` from a tiny npm package called `cn`; replaced with the usual clsx + tailwind-merge helper in `lib/utils.ts` (after every `shadcn add`, swap the import and `npm uninstall cn`). `next-themes` dropped (no dark mode).
- BFF: cookie `hk_admin` holds the opaque Sanctum token — httpOnly, SameSite=Lax, Secure in production, 7 days (= `SANCTUM_EXPIRATION`), not sliding. The catch-all proxy streams bodies (multipart up to 30 MB verified), passes back only content-type/content-disposition/retry-after, sets `no-store`, refuses `.`/`..` segments, and clears the cookie on a Laravel 401.
- CSRF: non-GET BFF requests with an `Origin` header must come from this site (request origin, Host/X-Forwarded-Host, or `NEXT_PUBLIC_SITE_URL`); no `Origin` (curl, server) is allowed.
- Session check: `proxy.ts` (cookie present) + `SessionGate` inside `<Suspense>` in the panel layout (Laravel `/admin/me`). A dead token goes to `/admin/login?expired=1`, which clears the stale cookie (no redirect loop). An API outage shows "Can't reach the API" instead of logging out. Framework control flow caught in `try/catch` is re-thrown with `unstable_rethrow` (prerender postponement is not an outage).
- Admin login goes through the Next server, so Laravel's 5/min/IP throttle is effectively global for admin logins — fine for a single admin.
- Preview: `/api/admin/preview?slug=` validates the token with Laravel before enabling Draft Mode; the public page honours it in phase 3.
- `lib/battle.ts` was written in phase 2 (not 6) because the Boss Preview needs `simulate()`: clear time is exact (event-driven engine + closed form), an empty loadout clears in `Infinity` ("—"), final-boss phases split at the literal 66 %/33 %, `bestLoadout` searches every combination with a lower-bound prune. Callers pass only visible skills.
- Boss balance note: with the seeded numbers the default loadout clears the bosses in 3.0–3.5 s but the best loadout (fast, cheap skills) in 1.0–2.0 s — below the spec's 3–8 s target. The Boss Preview warns about it; raising `boss_hp` (or slowing cheap skills) in the admin is the spec's lever. Seed values were left as given in Lampiran A.
- CRUD kit: one `ResourceTable` (react-table v9 for sorting/pagination; search filters rows first) with a Reorder mode that shows every row and posts the full order once; reorder is disabled while a filter is active. One form pattern (react-hook-form + zod, `applyServerErrors` maps Laravel 422 dot-paths onto fields and focuses the first visible one).
- Cache Components keeps visited admin pages alive but hidden (React Activity): create forms clear themselves once hidden after a successful create, edit forms re-sync with `keepDirtyValues`, and DOM lookups must skip hidden copies.
- Multi-file upload sends one `POST /media` per file (≤ 3 in parallel) to get a real per-file progress bar.
- Skills cooldown is edited in seconds in the UI and stored as `cooldown_ms`. Project form tabs live in the URL hash (`#boss`), all tabs stay mounted, and a `beforeunload` prompt guards unsaved changes.
- Messages paginate server-side, so the inbox has its own list (not `ResourceTable`); view state lives in the URL; visitor text is always rendered as plain text.
- Backend Form Requests got readable `attributes()` for nested fields ("The metric label field is required." instead of "metrics.0.label").
- Admin "not found" states (bad id) render in-page with HTTP 200 — acceptable behind auth.
