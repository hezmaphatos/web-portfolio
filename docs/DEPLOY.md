# Deploy

Two apps on two hostnames (spec §13). Example names used below — replace them with yours:

| App                                | Host                      | Where                                  |
| ---------------------------------- | ------------------------- | -------------------------------------- |
| Frontend (Next.js site + `/admin`) | `https://hackker.dev`     | Vercel                                 |
| Backend (Laravel API + uploads)    | `https://api.hackker.dev` | cPanel / Hostinger (PHP 8.3+, MySQL 8) |

How they talk to each other:

- The frontend's server fetches the public API (`API_URL`) and the browser posts three public endpoints directly (`NEXT_PUBLIC_API_URL`: project view, boss defeat, contact) — so the backend's CORS must allow the frontend origin.
- After every admin edit the backend calls `POST https://hackker.dev/api/revalidate` with `REVALIDATE_SECRET` — so the backend must know the frontend URL and both must share the secret.
- Uploaded images are served by Laravel at `https://api.hackker.dev/storage/...`; the frontend's image optimiser only accepts that host (derived from `API_URL`).

Deploy the **backend first**: the frontend build prerenders every page from the API.

## 1. Backend (cPanel / Hostinger)

### Server requirements

- PHP **8.3 or newer** (Laravel 13). In cPanel: _Select PHP Version_ / _MultiPHP Manager_ → 8.3+ for the API domain.
- PHP extensions: `gd` (with WebP), `fileinfo`, `exif`, `intl`, `mbstring`, `pdo_mysql`, `zip`, `bcmath`, `openssl`.
- PHP limits (_MultiPHP INI Editor_):
  - `memory_limit` ≥ 256M — GD decodes an image to ~4–5 bytes per pixel; uploads are capped at 40 MP (`portfolio.media.max_pixels`).
  - `upload_max_filesize` ≥ 30M (videos), `post_max_size` ≥ 64M, `max_file_uploads` ≥ 20.
  - `max_execution_time` ≥ 60 (image processing of a large upload).
- MySQL 8: create a database + user (cPanel → _MySQL Databases_), note name/user/password.
- SSH access makes this much easier (Composer, artisan). Without SSH, build `vendor/` locally and upload it (see the end of this section).

### First deploy

1. Upload the `backend/` folder to e.g. `~/api.hackker.dev/` (git clone over SSH, or ZIP upload). Point the subdomain's **document root to `backend/public`** (cPanel → _Domains_ → `api.hackker.dev` → Document Root).
2. Install dependencies:
   ```sh
   cd ~/api.hackker.dev
   composer install --no-dev --optimize-autoloader
   ```
3. Create `.env` from `.env.example` and set at least:
   ```ini
   APP_NAME="Hackker API"
   APP_ENV=production
   APP_DEBUG=false
   APP_URL=https://api.hackker.dev
   FRONTEND_URL=https://hackker.dev

   DB_CONNECTION=mysql
   DB_HOST=localhost
   DB_PORT=3306
   DB_DATABASE=...
   DB_USERNAME=...
   DB_PASSWORD=...

   SESSION_DRIVER=array
   CACHE_STORE=database
   QUEUE_CONNECTION=database      # or "sync" if you can't run a cron job (see below)
   FILESYSTEM_DISK=public

   SANCTUM_EXPIRATION=10080       # admin token lifetime, minutes (7 days)
   SANCTUM_TOKEN_PREFIX=hk_

   ADMIN_EMAIL=you@example.com
   ADMIN_PASSWORD=<a long, unique password>

   REVALIDATE_SECRET=<a long random string — the frontend uses the same value>
   # REVALIDATE_TIMEOUT=10

   LOG_LEVEL=warning

   # Optional: contact-form notifications to ADMIN_EMAIL (any SMTP account works).
   MAIL_MAILER=smtp
   MAIL_HOST=...
   MAIL_PORT=465
   MAIL_SCHEME=smtps
   MAIL_USERNAME=...
   MAIL_PASSWORD=...
   MAIL_FROM_ADDRESS=no-reply@hackker.dev
   ```
   Generate a secret with `php -r "echo bin2hex(random_bytes(32));"`.
4. Initialise:
   ```sh
   php artisan key:generate
   php artisan migrate --force
   php artisan db:seed --force        # first deploy only: CV content, game data, admin account
   php artisan storage:link
   php artisan config:cache
   php artisan route:cache
   ```
   `db:seed` is safe to re-run (it never overwrites admin edits), and `php artisan db:seed --class=AdminUserSeeder --force` resets the admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (password recovery).
5. If `storage:link` is not allowed on your host, create the link from cPanel's terminal or ask support for a symlink `public/storage → ../storage/app/public`. Uploads are written to `storage/app/public` (served) and `storage/app/private` (untouched originals, never served).
6. Permissions: `storage/` and `bootstrap/cache/` must be writable by PHP (usually 755 directories / 644 files on cPanel are fine).

### Queue (contact-form mail only)

The queue is only used for the contact notification e-mail, and only when a real mailer is configured. Choose one:

- **Cron (recommended):** cPanel → _Cron Jobs_, every minute:
  ```
  * * * * * cd ~/api.hackker.dev && php artisan queue:work --stop-when-empty --max-time=55 >/dev/null 2>&1
  ```
- **No cron:** set `QUEUE_CONNECTION=sync` (the mail is sent during the request; a slow SMTP server then slows the contact form).

Revalidation does **not** use the queue: it runs right after the admin response (`defer()`), which works on php-fpm and LiteSpeed.

### Without SSH

Run `composer install --no-dev --optimize-autoloader` locally (PHP 8.3+), ZIP `backend/` including `vendor/` (without `.env`, `storage/logs/*`, `node_modules`), upload and extract, then run the artisan commands from cPanel's _Terminal_ if available. If there is no terminal at all, the host is not a good fit for Laravel 13 — ask support for SSH.

### Check

```sh
curl https://api.hackker.dev/api/v1/public/home     # 200 + the CV data
curl -I https://api.hackker.dev/up                  # 200 (Laravel health route)
```

## 2. Frontend (Vercel)

1. Import the repository in Vercel and set **Root Directory = `frontend`** (framework preset: Next.js; build command `next build`, Node 20.9+).
2. Environment variables (Production, and Preview if you use preview deploys):
   ```ini
   NEXT_PUBLIC_SITE_URL=https://hackker.dev
   API_URL=https://api.hackker.dev/api/v1
   NEXT_PUBLIC_API_URL=https://api.hackker.dev/api/v1
   REVALIDATE_SECRET=<exactly the backend's value>
   ```
   `next.config.ts` derives the image host from `API_URL` (`/storage/**` only) and turns the local-IP image exception off automatically for a public host.
3. Deploy. The build fetches the API (every published project is prerendered), so the backend must be reachable from Vercel at build time.
4. Add the domain `hackker.dev` in Vercel (_Settings → Domains_) and follow its DNS instructions.

## 3. DNS

- `hackker.dev` → Vercel (A/ALIAS or CNAME as Vercel shows).
- `api.hackker.dev` → your cPanel/Hostinger server (A record to the server IP, or the subdomain created in cPanel).
- HTTPS on both (Vercel does it automatically; cPanel: _SSL/TLS Status_ → AutoSSL / Let's Encrypt).

## 4. After the first deploy

- [ ] Open `https://hackker.dev/admin`, sign in, and **change the password** (Account).
- [ ] Edit something small in the admin (e.g. the tagline) → reload the site → the change shows (revalidation works). If not: check `FRONTEND_URL` and `REVALIDATE_SECRET` on both sides and `storage/logs/laravel.log` for "Revalidation failed".
- [ ] Upload an image in the Media Library → it shows in the admin and, once attached to a project, on the site (storage link + image host OK).
- [ ] Send a test message from the contact form → it appears in Admin → Messages (CORS OK).
- [ ] Defeat a boss on a project page → the tech chips unlock (the defeat POST must not show a CORS error in the browser console).
- [ ] Check `https://hackker.dev/sitemap.xml`, `/robots.txt`, and an unknown URL (GAME OVER with a 404 status).
- [ ] Verify the LinkedIn URL in Profile & Site (the seed guessed it from the CV).

The Playwright suite (`npm run test:e2e`) creates and deletes test projects, so run it against a staging copy, not production.

## 5. Updating

- **Backend:** pull/upload, then
  ```sh
  composer install --no-dev --optimize-autoloader
  php artisan migrate --force
  php artisan config:cache && php artisan route:cache
  ```
- **Frontend:** push to the branch Vercel deploys (or redeploy in the dashboard). Content changes never need a redeploy — the admin revalidates the cached pages.
- A redeploy of the frontend is needed only for code changes or for a project slug added since the last build to be prerendered at build time (new slugs already render on their first visit and are cached afterwards).

## 6. Troubleshooting

| Symptom                                                   | Likely cause                                                                                                                                          |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend build fails fetching `/public/home`              | Backend not reachable from Vercel, wrong `API_URL`, or the API returns an error (`APP_DEBUG=false` hides details — check `storage/logs/laravel.log`). |
| Admin edits don't show on the site                        | `FRONTEND_URL` / `REVALIDATE_SECRET` mismatch, or the backend can't reach the frontend over HTTPS.                                                    |
| Images missing on the site                                | `storage:link` missing, wrong `APP_URL`, or `API_URL` host differs from the image host.                                                               |
| Contact form / defeat / view requests fail in the browser | CORS: `FRONTEND_URL` must be exactly the site origin (scheme + host, no trailing slash); clear the config cache after changing `.env`.                |
| Upload fails for large images/videos                      | PHP `upload_max_filesize` / `post_max_size` / `memory_limit` (see the requirements).                                                                  |
| 500 after changing `.env`                                 | Run `php artisan config:clear` (then `config:cache` again).                                                                                           |
