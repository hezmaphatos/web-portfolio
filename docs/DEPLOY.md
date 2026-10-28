# Deploy

Two apps on two hostnames (spec §13). Example names used below — replace them with yours:

| App                                | Host                         | Where                                  |
| ---------------------------------- | ---------------------------- | -------------------------------------- |
| Frontend (Next.js site + `/admin`) | `https://yourdomain.dev`     | Vercel                                 |
| Backend (Laravel API + uploads)    | `https://api.yourdomain.dev` | cPanel / Hostinger (PHP 8.3+, MySQL 8) |

How they talk to each other:

- The frontend's server fetches the public API (`API_URL`) and the browser posts three public endpoints directly (`NEXT_PUBLIC_API_URL`: project view, boss defeat, contact) — so the backend's CORS must allow the frontend origin.
- After every admin edit the backend calls `POST https://yourdomain.dev/api/revalidate` with `REVALIDATE_SECRET` — so the backend must know the frontend URL and both must share the secret.
- Uploaded images are served by Laravel at `https://api.yourdomain.dev/storage/...`; the frontend's image optimiser only accepts that host (derived from `API_URL`).

Deploy the **backend first**: the frontend build prerenders every page from the API.

**Two ways to host the backend:** a PHP host with a persistent disk (cPanel/Hostinger, sections 1–6), or free: a container + cloud MySQL + object storage (section 7 — Render + TiDB Cloud + Cloudflare R2). The frontend goes to Vercel either way.

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

1. Upload the `backend/` folder to e.g. `~/api.yourdomain.dev/` (git clone over SSH, or ZIP upload). Point the subdomain's **document root to `backend/public`** (cPanel → _Domains_ → `api.yourdomain.dev` → Document Root).
2. Install dependencies:
   ```sh
   cd ~/api.yourdomain.dev
   composer install --no-dev --optimize-autoloader
   ```
3. Create `.env` from `.env.example` and set at least:
   ```ini
   APP_NAME="Portfolio API"
   APP_ENV=production
   APP_DEBUG=false
   APP_URL=https://api.yourdomain.dev
   FRONTEND_URL=https://yourdomain.dev

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
   MAIL_FROM_ADDRESS=no-reply@yourdomain.dev
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
  * * * * * cd ~/api.yourdomain.dev && php artisan queue:work --stop-when-empty --max-time=55 >/dev/null 2>&1
  ```
- **No cron:** set `QUEUE_CONNECTION=sync` (the mail is sent during the request; a slow SMTP server then slows the contact form).

Revalidation does **not** use the queue: it runs right after the admin response (`defer()`), which works on php-fpm and LiteSpeed.

### Without SSH

Run `composer install --no-dev --optimize-autoloader` locally (PHP 8.3+), ZIP `backend/` including `vendor/` (without `.env`, `storage/logs/*`, `node_modules`), upload and extract, then run the artisan commands from cPanel's _Terminal_ if available. If there is no terminal at all, the host is not a good fit for Laravel 13 — ask support for SSH.

### Check

```sh
curl https://api.yourdomain.dev/api/v1/public/home     # 200 + the CV data
curl -I https://api.yourdomain.dev/up                  # 200 (Laravel health route)
```

## 2. Frontend (Vercel)

1. Import the repository in Vercel and set **Root Directory = `frontend`** (framework preset: Next.js; build command `next build`, Node 20.9+).
2. Environment variables (Production, and Preview if you use preview deploys):
   ```ini
   NEXT_PUBLIC_SITE_URL=https://yourdomain.dev
   API_URL=https://api.yourdomain.dev/api/v1
   NEXT_PUBLIC_API_URL=https://api.yourdomain.dev/api/v1
   REVALIDATE_SECRET=<exactly the backend's value>
   ```
   `next.config.ts` derives the image host from `API_URL` (`/storage/**` only) and turns the local-IP image exception off automatically for a public host.
3. Deploy. The build fetches the API (every published project is prerendered), so the backend must be reachable from Vercel at build time.
4. Add the domain `yourdomain.dev` in Vercel (_Settings → Domains_) and follow its DNS instructions.

## 3. DNS

- `yourdomain.dev` → Vercel (A/ALIAS or CNAME as Vercel shows).
- `api.yourdomain.dev` → your cPanel/Hostinger server (A record to the server IP, or the subdomain created in cPanel).
- HTTPS on both (Vercel does it automatically; cPanel: _SSL/TLS Status_ → AutoSSL / Let's Encrypt).

## 4. After the first deploy

- [ ] Open `https://yourdomain.dev/admin`, sign in, and **change the password** (Account).
- [ ] Edit something small in the admin (e.g. the tagline) → reload the site → the change shows (revalidation works). If not: check `FRONTEND_URL` and `REVALIDATE_SECRET` on both sides and `storage/logs/laravel.log` for "Revalidation failed".
- [ ] Upload an image in the Media Library → it shows in the admin and, once attached to a project, on the site (storage link + image host OK).
- [ ] Send a test message from the contact form → it appears in Admin → Messages (CORS OK).
- [ ] Defeat a boss on a project page → the tech chips unlock (the defeat POST must not show a CORS error in the browser console).
- [ ] Check `https://yourdomain.dev/sitemap.xml`, `/robots.txt`, and an unknown URL (GAME OVER with a 404 status).
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

## 7. Free hosting: Render + TiDB Cloud + Cloudflare R2

The backend runs from `backend/Dockerfile` (FrankenPHP, PHP 8.4). A free container has an
**ephemeral disk** (files vanish on every restart/redeploy), so uploads go to object storage and the
queue runs inline. The image already sets `APP_ENV=production`, `LOG_CHANNEL=stderr`,
`QUEUE_CONNECTION=sync`, `MEDIA_DISK=s3`, `MEDIA_ORIGINALS_DISK=s3-private` and `TRUSTED_PROXIES=*`;
on every start it runs `config:cache`, `route:cache`, `migrate --force` and `db:seed --force`
(the seeders only add what is missing, so this is safe).

| Piece             | Service (free tier)     | Notes                                                                      |
| ----------------- | ----------------------- | -------------------------------------------------------------------------- |
| Frontend          | Vercel Hobby            | Section 2, plus `MEDIA_URL`.                                               |
| Backend container | Render Free web service | Sleeps after 15 min without requests; the first request then takes ~1 min. |
| Database (MySQL)  | TiDB Cloud Starter      | MySQL-compatible, TLS required, port 4000.                                 |
| Uploads           | Cloudflare R2           | 10 GB free; Cloudflare may ask for a card to activate R2.                  |

Free tiers change; check each provider's pricing page before relying on these limits. The repository
must be on GitHub (private is fine) for Render and Vercel to deploy it.

### 7.1 Cloudflare R2 (uploads)

1. Cloudflare dashboard → **R2** → create two buckets: `portfolio-media` and `portfolio-originals`.
2. `portfolio-media` → _Settings → Public access_ → enable the **r2.dev** URL (or connect a custom
   domain if your domain is on Cloudflare). Copy that public URL, e.g. `https://pub-xxxx.r2.dev`.
   Leave `portfolio-originals` **private**: image originals still carry EXIF (GPS included).
3. R2 → **Manage API tokens** → create a token with _Object Read & Write_ on those two buckets.
   Note the **Access Key ID**, **Secret Access Key** and the S3 endpoint
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

### 7.2 TiDB Cloud Starter (database)

1. Create a **Starter** cluster in the region nearest your Render region (e.g. AWS Singapore).
2. _Connect_ → generate a password; note host (`gateway01.<region>.prod.aws.tidbcloud.com`),
   port `4000` and user (`<prefix>.root`).
3. _SQL Editor_: `CREATE DATABASE portfolio;`

### 7.3 Render (backend)

1. Generate an app key locally: `php artisan key:generate --show` (in `backend/`).
2. Render → **New → Web Service** → connect the GitHub repo. Root Directory `backend`, Language
   **Docker**, Instance type **Free**, region close to the database. Health Check Path: `/up`.
3. Environment variables:
   ```ini
   APP_KEY=base64:...                       # from step 1
   APP_URL=https://<service>.onrender.com
   FRONTEND_URL=https://<project>.vercel.app  # the site's exact origin, no trailing slash
   DB_CONNECTION=mysql
   DB_HOST=gateway01.<region>.prod.aws.tidbcloud.com
   DB_PORT=4000
   DB_DATABASE=portfolio
   DB_USERNAME=<prefix>.root
   DB_PASSWORD=...
   MYSQL_ATTR_SSL_CA=/etc/ssl/certs/ca-certificates.crt
   CACHE_STORE=database
   SESSION_DRIVER=array
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   AWS_DEFAULT_REGION=auto
   AWS_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   AWS_BUCKET=portfolio-media
   AWS_PRIVATE_BUCKET=portfolio-originals
   AWS_URL=https://pub-xxxx.r2.dev
   ADMIN_EMAIL=you@example.com
   ADMIN_PASSWORD=<a strong password>
   REVALIDATE_SECRET=<long random string, same on Vercel>
   MAIL_MAILER=log
   ```
4. Deploy, then open `https://<service>.onrender.com/api/v1/public/home` — JSON means the database
   is migrated and seeded.

### 7.4 Vercel (frontend)

Section 2 with `API_URL` / `NEXT_PUBLIC_API_URL` = `https://<service>.onrender.com/api/v1`, plus:

```ini
MEDIA_URL=https://pub-xxxx.r2.dev   # same as the backend's AWS_URL; lets next/image load uploads
```

Open the backend URL first so it is awake before the Vercel build (the build waits for the API
anyway). If the Vercel URL differs from the `FRONTEND_URL` you guessed, fix it on Render
(saving env vars redeploys).

### 7.5 Living with the sleep

Visitors read pages from Vercel's cache, so a sleeping backend is invisible to them. It is felt
only by the admin login, the contact form, the boss-defeat/view counters and the first
revalidation after an edit (~1 min for the first request). A free uptime monitor (e.g. UptimeRobot
or cron-job.org) calling `https://<service>.onrender.com/up` every 10–14 minutes keeps it awake;
one always-on service fits Render's 750 free instance hours a month.
