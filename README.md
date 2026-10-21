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
php artisan db:seed               # CV content, game data, admin account

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
