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
