# API contract (`/api/v1`)

Single source for the JSON shapes shared by `backend/` (Services build these arrays) and `frontend/` (`lib/types.ts` mirrors them). Change both sides together.

- Success: `{ "data": <payload> }`, lists that paginate add `"meta": { "current_page", "last_page", "per_page", "total" }`.
- Error: `{ "message": "...", "errors": { "field": ["..."] } }` (422), `{ "message": "..." }` for 401/403/404/409/429.
- Dates: `YYYY-MM-DD`; timestamps: ISO 8601 (`2026-10-21T12:00:00.000000Z`).
- All URLs in payloads are absolute (`APP_URL` + `/storage/...`).
- JSON arrays stored as `null` in the DB are returned as `[]`.

## Shared objects

### Media
```jsonc
{
  "id": 12,
  "url": "http://127.0.0.1:8100/storage/media/2026/10/ab12cd.webp", // served file (WebP ≤1920px for images; the file itself for pdf/mp4)
  "thumb_url": "http://…/ab12cd-thumb.webp",                         // 480px WebP; null for non-images
  "mime": "image/webp",                                              // mime of `url`
  "width": 1920, "height": 1080,                                     // null for non-images
  "alt": "Dashboard screenshot",                                     // may be null → frontend falls back to a sensible alt
  "blur_data_url": "data:image/webp;base64,…",                       // tiny preview; null for non-images
  "dominant_color": "#1f2a44"                                        // null for non-images
}
```
Admin media (`/admin/media`) adds: `has_original` (the untouched upload is kept on the private `local` disk — it still carries EXIF — and is never given a URL), `original_name`, `size` (bytes), `created_at`, `updated_at`, and on index/show `used_in: [{ "type": "project|site|experience|skill|award", "id": 3, "label": "Mindlens", "field": "cover|gallery|video|boss|og|avatar|portrait|cv|logo|icon|media" }]`.

### SkillRef (inside projects)
```jsonc
{ "id": 8, "name": "Laravel", "slug": "laravel", "category": "backend", "level": 5, "icon_key": "laravel" }
```

### Boss
```jsonc
{
  "enabled": true,
  "tier": "final",                 // minion | regular | final
  "name": "The Paper Colossus",    // falls back to the project title when boss_name is empty
  "hp": 150,
  "sprite": Media | null,          // null → frontend draws a generative pixel boss from accent_color + tier
  "intro": "A mountain of purchase orders blocks the way.",
  "defeat_text": "Every order is now a sales order."
}
```

## Public endpoints (no auth)

### `GET /public/home`
One payload for the whole Home page. Only visible/published content, each list ordered by `sort_order` (then `id`).
```jsonc
{
  "data": {
    "site": {
      "full_name": "Yehezkiel Natanael", "nickname": "Hezki", "headline": "…",
      "roles": ["Backend Developer", "…"], "tagline": "…", "short_bio": "…", "long_bio": "markdown…",
      "location": "Tangerang Selatan, Indonesia", "email": "…",
      "phone": null,                                  // only when show_phone = true
      "socials": [{ "label": "GitHub", "url": "https://…", "icon": "github" }],
      "stats": [{ "label": "GPA", "value": "3.91", "prefix": "", "suffix": "/4.00", "auto": null }],
                                                      // auto = "projects" → value is the published project count (computed)
      "soft_skills": ["Public Speaking", "…"],        // visible skills with category = soft, by sort_order
      "avatar": Media | null, "portrait": Media | null,
      "cv": Media | null,                              // PDF
      "seo_title": "…", "seo_description": "…", "og_image": Media | null,
      "sound_default": false,
      "tech_visible_percent": 50
    },
    "sections": [
      { "key": "boot", "title": "Boot", "subtitle": null, "body": null, "hint": "Press START…", "sort_order": 0 }
      // only is_visible = true; keys: boot hero about journey skills projects trophies contact
    ],
    "experiences": [
      {
        "id": 1, "type": "internship", "title": "Software Developer Intern", "organization": "Unggul Mitra Solusi",
        "location": "Jakarta Barat", "subtitle": null,
        "start_date": "2026-01-01", "end_date": "2026-07-31", "is_current": false,
        "description": "markdown | null", "bullets": ["…"],
        "metrics": [{ "label": "full enrollments", "value": 50, "prefix": "", "suffix": "+" }],
        "logo": Media | null, "sort_order": 0
      }
    ],
    "skills": [
      // visible, category != soft (game skills)
      {
        "id": 8, "name": "Laravel", "slug": "laravel", "category": "backend", "level": 5, "status": "core",
        "icon_key": "laravel", "icon": Media | null, "description": null,
        "attack_name": "Eloquent Slam", "damage": 70, "cooldown_ms": 4000, "sort_order": 7
      }
    ],
    "projects": [ ProjectSummary ],   // published only
    "awards": [
      {
        "id": 1, "title": "Gold Medal — National Level, English", "event": "Indonesian Student Olympiad (OPI)",
        "issuer": "…|null", "year": 2022, "placement": "gold", "category": "Olympiad",
        "description": null, "image": Media | null, "url": null, "sort_order": 0
      }
    ]
  }
}
```

### ProjectSummary (home, `/public/projects`)
```jsonc
{
  "id": 3, "slug": "ocr-internal-document-extraction", "title": "OCR — Internal Document Extraction",
  "tagline": "…", "summary": "…", "category": "web", "kind": "internship", "progress": "shipped",
  "role": "Software Developer Intern", "team_size": null, "year_start": 2026, "year_end": null,
  "accent_color": "#FF4B2B", "is_featured": true, "sort_order": 2,
  "cover": Media | null,
  "hover_image": Media | null,        // second visual for grid hover: first gallery image that is not the cover
  "hover_video": Media | null,        // uploaded mp4 (video_media), used as a short hover loop
  "peek": [ Media ],                  // first ≤ 4 gallery images (quick preview)
  "gallery_count": 6,
  "skills": [ SkillRef ],             // reveal order (project_skill.sort_order)
  "boss": Boss,
  "live_url": "https://…|null", "repo_url": "https://…|null",   // always present: the lock is cosmetic
  "allow_iframe_preview": false,
  "has_video": true                   // video_url or video_media set
}
```

### `GET /public/projects?category=web&skill=laravel&q=ocr`
`{ "data": [ ProjectSummary ] }`, published only, ordered by `sort_order`. `skill` is a skill slug; `q` matches title/tagline/summary (case-insensitive `LIKE`).

### `GET /public/projects/{slug}`
Published only — a draft is returned only when the request carries a valid admin Bearer token (preview). 404 otherwise.
```jsonc
{
  "data": {
    ...ProjectSummary,
    "status": "published",
    "problem": "markdown|null", "solution": "markdown|null", "impact": "markdown|null",
    "description": "markdown|null",
    "highlights": ["…"], "challenges": ["…"],
    "video_url": "https://www.youtube.com/watch?v=…|null",
    "video": Media | null,            // uploaded mp4
    "gallery": [ { ...Media, "device": "desktop|tablet|mobile", "caption": "…|null" } ],
    "seo_title": "…|null", "seo_description": "…|null", "og_image": Media | null,
    "prev": { "slug": "…", "title": "…", "accent_color": "#…" } | null,   // neighbours among published projects by sort_order
    "next": { "slug": "…", "title": "…", "accent_color": "#…" } | null
  }
}
```

### `POST /public/projects/{slug}/view` (throttle 30/min/IP, own bucket)
`200 { "data": { "view_count": 13 } }`. 404 for unknown/draft.

### `POST /public/projects/{slug}/defeat` (throttle 30/min/IP, own bucket — views never use up the defeat budget)
`200 { "data": { "defeat_count": 4 } }`. 404 unknown/draft, 422 when `boss_enabled = false`.

### `POST /public/contact` (throttle 5/hour/IP)
Body `{ "name", "email", "message", "website" }` — `website` is the honeypot and must be empty.
Rules: name 2–100, email valid ≤190, message 10–5000.
`201 { "data": { "ok": true } }`. A filled honeypot also returns 201 but stores nothing. A notification mail to `ADMIN_EMAIL` is queued only when a real mailer is configured (not `log`/`array`).

## Admin endpoints (`auth:sanctum`, Bearer token)

The browser never sees the token: the Next.js BFF (`/api/admin/*`) stores it in an httpOnly cookie and adds `Authorization: Bearer …`.

### Auth
- `POST /admin/login` (throttle 5/min/IP) `{ email, password }` → `200 { "data": { "token": "1|hk_…", "user": { "id", "name", "email" } } }`; 422 on bad credentials. The token is opaque (Sanctum `{id}|hk_{random}`): store it and replay it unchanged, never validate its format.
- Every admin route answers `401 { "message": "Unauthenticated." }` for a missing/invalid/expired token, whatever the `Accept` header (no login redirect).
- `POST /admin/logout` → `200 { "data": { "ok": true } }` (revokes the current token).
- `GET /admin/me` → `{ "data": { "id", "name", "email" } }`.
- `PUT /admin/password` `{ current_password, password, password_confirmation }` (min 12) → `{ "data": { "ok": true } }`.

### Updates
`PUT` on experiences, skills, projects, awards and sections is **partial**: an omitted field keeps its value (the admin table can send `{ "is_visible": false }` alone); a required field that is sent cannot be blank. Cross-field rules (published project needs a summary, `year_end ≥ year_start`, `end_date ≥ start_date`, skill game fields required unless the resulting category is `soft`) are checked against the stored row merged with the sent fields. `/admin/site` PUT always needs `full_name` and `nickname`.

Media references must point at the right kind (422 otherwise): images for `avatar_media_id`, `portrait_media_id`, `og_media_id` (site and project), `cover_media_id`, `boss_media_id`, `gallery[].media_id`, `logo_media_id`, `icon_media_id` and award `media_id`; a PDF for `cv_media_id`; a video for `video_media_id`.

### Lists
`GET /admin/{experiences|skills|projects|awards|sections}` return the **full list** ordered by `sort_order`, `id` (no pagination — small tables; the admin table searches/sorts/paginates client-side, and drag-reorder needs every row). `media` and `messages` paginate server-side (`?page`, `per_page` ≤ 100, `q`).

### Reorder
`POST /admin/{experiences|skills|projects|awards}/reorder` `{ "items": [{ "id": 1, "sort_order": 0 }, …] }` → one `upsert` → `{ "data": { "ok": true } }`. Unknown ids → 422.

### Site — `GET|PUT /admin/site`
GET returns every column of `site_settings` (arrays normalised to `[]`), plus `avatar`, `portrait`, `cv`, `og_image` as Media|null. PUT accepts the editable columns: `full_name` (req), `nickname` (req), `headline`, `roles[]`, `tagline`, `short_bio`, `long_bio`, `location`, `email`, `phone`, `show_phone`, `socials[] {label,url,icon}`, `stats[] {label,value,prefix,suffix,auto}`, `avatar_media_id`, `portrait_media_id`, `cv_media_id`, `seo_title`, `seo_description`, `og_media_id`, `sound_default`, `tech_visible_percent` (0–100). Returns the GET shape.

### Sections — `GET /admin/sections`, `GET|PUT /admin/sections/{id}`
Fixed set of 8 keys (no create/delete, no reorder). PUT: `title` (req), `subtitle`, `body`, `hint` (≤300), `is_visible`.

### Experiences — apiResource + reorder
Fields: `type` (work|internship|freelance|organization|education), `title`, `organization`, `location`, `subtitle`, `start_date` (req), `end_date` (null = present, ≥ start), `description`, `bullets[]`, `metrics[] {label,value(number),prefix,suffix}`, `logo_media_id`, `is_visible`, `sort_order`. Row = public experience shape + `is_visible`, `logo_media_id`, `created_at`, `updated_at`.

### Skills — apiResource + reorder
Fields: `name` (req), `slug` (auto from name when empty, unique), `category` (backend|frontend|mobile|database|design|ml|game|soft), `level` 1–5, `status` core|learning, `icon_key`, `icon_media_id`, `description`, `attack_name`, `damage` 25–70, `cooldown_ms` 1000–4000 step 500 (the three game fields are required unless category = soft), `is_visible`, `sort_order`.
Row = public skill shape + `is_visible`, `icon_media_id`, `projects_count`, `dps` (damage ÷ seconds, 1 decimal, null for soft), `dps_warning` (`"strong"` > 30, `"weak"` < 15, else null), timestamps. Deleting a skill detaches it from projects.

### Projects — apiResource + reorder
Index row: `id, slug, title, status, category, kind, is_featured, accent_color, cover (Media|null), skills_count, gallery_count, boss_enabled, boss_tier, boss_hp, view_count, defeat_count, sort_order, updated_at`.
Show = everything editable + relations:
```jsonc
{
  "id", "slug", "title", "tagline", "category", "kind", "progress", "status", "role", "team_size",
  "year_start", "year_end", "accent_color", "is_featured", "sort_order",
  "summary", "problem", "solution", "impact", "description", "highlights": [], "challenges": [],
  "skill_ids": [8, 3],                          // reveal order
  "skills": [ SkillRef ],
  "boss_enabled", "boss_tier", "boss_hp", "boss_name", "boss_media_id", "boss_sprite": Media|null,
  "boss_intro", "boss_defeat_text",
  "cover_media_id", "cover": Media|null,
  "gallery": [ { "media_id": 5, "device": "desktop", "caption": null, "media": Media } ],
  "video_url", "video_media_id", "video": Media|null,
  "live_url", "repo_url", "allow_iframe_preview",
  "seo_title", "seo_description", "og_media_id", "og_image": Media|null,
  "view_count", "defeat_count", "created_at", "updated_at"
}
```
Store/Update body: the editable columns above plus `skill_ids[]` (order = reveal order, synced once) and `gallery[] { media_id, device, caption }` (order = sort_order, synced once). Rules: `title` req ≤255; `slug` auto from title when empty, `alpha_dash`, unique; enums per spec; `accent_color` `#RRGGBB`; `boss_tier` minion|regular|final; `boss_hp` 10–300 (defaults to the tier preset when omitted on create); `team_size` 1–255; years 1990–2100, `year_end` ≥ `year_start`; URLs `url` ≤500; `video_url` must be a YouTube URL; `status = published` requires `title` and `summary` (cover may be empty → placeholder).

### Awards — apiResource + reorder
Fields: `title` (req), `event` (req), `issuer`, `year` 1990–2100, `placement` gold|silver|bronze|finalist|participant, `category`, `description`, `media_id`, `url`, `is_visible`, `sort_order`. Row = public award shape + `is_visible`, `media_id`, timestamps.

### Media
- `GET /admin/media?q=&type=image|video|pdf&page=&per_page=` → paginated admin Media (newest first), `q` matches `original_name`/`alt`.
- `GET /admin/media/{id}` → admin Media with `used_in`.
- `POST /admin/media` multipart `files[]` (1–20 files) + optional `alt` → `201 { "data": [ admin Media ] }`.
  Allowed: jpg/jpeg/png/webp/gif ≤ 8 MB and ≤ 40 megapixels (`portfolio.media.max_pixels`, read from the header before decoding) (processed: WebP ≤1920px, 480px thumb, EXIF stripped, blur + dominant colour; GIF is kept as is, thumb from the first frame), pdf ≤ 10 MB, mp4/webm ≤ 30 MB. SVG is rejected. Mime **and** extension are both checked.
- `PATCH /admin/media/{id}` `{ alt }` → admin Media.
- `POST /admin/media/{id}/replace` multipart `file` → same id, new files (old files deleted) → admin Media. The new file must be the same kind (image/video/pdf) as the current one, otherwise 422 on `file`.
- `DELETE /admin/media/{id}` → `200 { "data": { "ok": true } }`, or `409 { "message": "Media is in use.", "used_in": [...] }`.

### Messages
- `GET /admin/messages?unread=1&q=&page=` → paginated, newest first: `{ id, name, email, message, read_at, created_at }`.
- `GET /admin/messages/{id}`, `PATCH /admin/messages/{id}/read` `{ "read": true|false }`, `DELETE /admin/messages/{id}`.

### Dashboard — `GET /admin/dashboard`
```jsonc
{
  "data": {
    "counts": { "projects": 4, "published_projects": 4, "skills": 22, "messages": 3, "unread_messages": 1,
                "experiences": 8, "awards": 4, "media": 0 },
    "latest_messages": [ { "id", "name", "email", "message", "read_at", "created_at" } ],   // 5 newest
    "most_viewed": [ { "id", "slug", "title", "view_count" } ],                            // top 5
    "most_defeated": [ { "id", "slug", "title", "defeat_count" } ]                         // top 5, boss_enabled only
  }
}
```

## Revalidation webhook (backend → frontend)

`POST {FRONTEND_URL}/api/revalidate`, header `x-revalidate-secret: {REVALIDATE_SECRET}`, body `{ "tags": [...] }`. Sent after the response (Laravel `defer()`), timeout 3 s; failures are logged and never fail the admin request.

| Change | Tags |
|---|---|
| site settings, skills, media (alt/replace) | `home`, `projects` |
| sections, experiences, awards | `home` |
| project create/update/delete | `home`, `projects`, `project:{slug}` (old and new slug when renamed) |
| project reorder | `home`, `projects` (prev/next of every detail page changes; detail pages are also tagged `projects`) |

Media upload and delete send nothing: a new upload is not referenced yet, and only unused media can be deleted.

Frontend cache tags: Home data `home`; projects index `projects`; project detail `projects` + `project:{slug}`.
