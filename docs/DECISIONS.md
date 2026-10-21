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
