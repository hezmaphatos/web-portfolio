# Hackker — PLAYER ONE

Personal portfolio of Yehezkiel "Hackker" Natanael: a game-style scrollytelling site plus an admin panel.

```
backend/    Laravel 13 (API only) + MySQL 8 — data, auth (Sanctum), uploads
frontend/   Next.js 16 (App Router) — public site and /admin
docs/       DECISIONS.md, LEARNING_NOTES.md, DEPLOY.md, API.md
```

The full product spec is `PORTFOLIO_SPEC.md`; working rules for contributors (and Claude Code) are in `CLAUDE.md`.

## Requirements

- PHP 8.3+ with `gd` (WebP), `fileinfo`, `exif`, `intl`, `mbstring`, `pdo_mysql`, `zip`
- Composer 2, Node.js 20.9+ and npm
- MySQL 8 (Laragon works)

## First-time setup

```sh
# root: dev scripts
npm install
cp .env.example .env              # set PHP_BIN if `php` on PATH is older than 8.3

# backend
cd backend
cp .env.example .env              # DB_*, ADMIN_EMAIL, ADMIN_PASSWORD, REVALIDATE_SECRET
composer setup                    # install, app key, migrate, storage:link
php artisan db:seed               # CV content, game data, admin account (re-run safe: inserts only what is missing)
# password recovery: php artisan db:seed --class=AdminUserSeeder   (resets the admin to ADMIN_EMAIL / ADMIN_PASSWORD)

# frontend
cd ../frontend
npm install
cp .env.example .env.local        # REVALIDATE_SECRET must equal the backend's
```

## Run

```sh
npm run dev        # at the repo root: API :8100 + queue worker + web :3100
```

Or separately: `cd backend && composer dev` and `cd frontend && npm run dev`.

- Site: http://localhost:3100
- Admin: http://localhost:3100/admin
- API: http://127.0.0.1:8100/api/v1

## Checks

```sh
cd backend  && composer lint && composer test
cd frontend && npm run lint && npm run typecheck && npm test && npm run build
```

`npm run build` prerenders pages from the API, so the backend must be running.

## E2E (Playwright)

Smoke tests (spec §12) and the accessibility pass live in `frontend/e2e/`. They never start servers: run the API and the site first (`npm run dev` at the root, or `next build && next start` for a production check), then:

```sh
cd frontend
npx playwright install chromium   # once
npm run test:e2e                  # all tests, Chromium, one worker
npx playwright test e2e/a11y.spec.ts --no-deps   # only the axe scans (no admin login)
npx playwright show-report        # HTML report of the last run
```

| Env var              | Default                         |
| -------------------- | ------------------------------- |
| `E2E_BASE_URL`       | `http://localhost:3100`         |
| `E2E_ADMIN_EMAIL`    | `yehezkielnatanael05@gmail.com` |
| `E2E_ADMIN_PASSWORD` | `hackker-admin-2026`            |

- The `admin-login` setup project logs in through the real form once per run (the login is throttled to 5/min) and saves the session to `frontend/e2e/.auth/` (gitignored); the `admin-logout` teardown deletes leftover test projects (slug `e2e-smoke-…`) and revokes the token.
- The admin and boss tests create a published project and delete it again, so they need a writable dev database and the backend → site revalidation (`REVALIDATE_SECRET` on both sides).
- `--no-deps` skips the login, for runs that don't need the admin.
- The backend gives the revalidation webhook 3 s. On a cold `next dev` its first hit can take longer and the revalidation is dropped (Home stays stale until the next admin write), so the setup compiles `/api/revalidate` before any write.
- Timeouts are generous because a cold `next dev` compiles each route on its first hit; a production build runs the suite in a fraction of the time.
