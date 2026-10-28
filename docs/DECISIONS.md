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
- "Array access, no object access" allows Eloquent _write_ methods on a fetched instance (`update`, `delete`, `createToken`, relation writes); reads always use array access.
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

## Phase 3 — Static site

- Data readers in `lib/api.ts` are `"use cache"` + `cacheLife("max")` + `cacheTag(...)`; the backend webhook expires tags with `revalidateTag(tag, { expire: 0 })`. Verified on a production build: pages stay cached until the webhook fires, then show the edit on the next visit. The webhook accepts only `home`, `projects`, `project:{slug}`.
- `next.config.ts`: `images.remotePatterns` is derived from `API_URL` (`/storage/**`); `dangerouslyAllowLocalIP` is on only when the API host is local (dev), off in production.
- The Turbopack Tailwind loader rule skips `*.module.css` (a `condition`); without it CSS Modules were re-emitted as global CSS and `styles.x` was undefined.
- Display type uses −0.005em tracking and no `text-stroke`: tighter tracking makes condensed glyphs touch and draw hairline seams; the variable font's overlapping contours show through a stroke. The Hero last name uses an offset ink text-shadow instead.
- Social links are labelled tags (no brand logos — lucide v1 dropped brand icons; drawing logos from memory is not worth it).
- Markdown from the admin starts at h4 (`headingLevel`) so authored headings never break the page outline.
- Home sections: Hero paper → About paper-2 → Journey paper → Skills paper-2 → Projects ink → Trophies lime → Contact ink.
- Journey filter works without JavaScript: radio "tabs" + `:has(#quest-filter-x:checked)` CSS; the Work tab covers work, internship and freelance.
- The footer year is a `"use cache"` + `cacheLife("days")` component (a `Date` inside a cache scope is captured into the shell), so Home revalidates daily on its own as well.
- The static Skill Tree already shows game stats and the default loadout (`defaultLoadout`, dummy clear time); the interactive inventory/drag/dummy is phase 5.
- Projects: the showcase (featured, ≤ 6) scrolls natively with scroll-snap until the pinned GSAP track (phase 6); the grid shows every published project incl. featured; `/projects` "filters" are category jump links + grouped sections (no JS, no searchParams, stays static).
- `/projects/[slug]`: `generateStaticParams` returns every published slug (a placeholder that `notFound()`s when there are none); `params` is awaited inside `<Suspense>` (ISR with Cache Components). Consequence: an unknown slug renders "Level not found" with noindex but HTTP 200 — revisit in phase 8.
- Draft preview: only when `draftMode()` is on does the page read the `hk_admin` cookie and fetch the draft uncached (banner + noindex + Exit preview Server Action). The normal path never reads cookies, so it stays static.
- Project page = `ProjectStage` component, so the phase-6 modal can reuse it. Only large display type sits directly on the accent colour (AA); small text sits on paper/ink.

## Phase 4 — Stage hints + Hero/About/Journey motion

- Chapters stay Server Components; motion lives in client islands (`components/chapters/{hero,about,journey,shared}/*`) that wrap or sit inside the server markup and only enhance it. Server HTML = the no-JS / Lite version.
- Hints: an auto-opened hint also closes when its stage scrolls below 40 % visible (reading of "manual hints don't auto-close on the first scroll"); manual ones (Help / "?") only close on 7 s, ✕ or the action. The 7 s timer pauses while the card is hovered or focused (WCAG 2.2.1). No hint opens before the cookie is read or while the splash is up.
- Hint text reaches screen readers through an always-mounted sr-only `role="status"`; the visible copy is `aria-hidden`, the ✕ stays reachable (end of the tab order, never focused automatically).
- Hero name: letters are hidden only while the splash is `playing` (covered); without a splash the name gets a non-hiding hop. The split is reverted after the intro.
- Hero roles: typewriter in one aria-hidden slot over the list (list at opacity 0, still read by SR, still holding its space → no CLS). Only when the list fits in ≤ 2 lines; phones keep the static list (a one-line slot over a 3-line list left a gap).
- Stickers: the nickname tag is content, so it stays a `<p>` (draggable by pointer, moved by "Toss stickers"); the stat stickers become buttons (arrows/Enter). Throws bounce via a proxy + reflection; Lite keeps plain dragging and an instant "toss". Device tilt only where no permission prompt is needed (no iOS prompt on load).
- About flip: a transparent toggle `<button aria-pressed>` covers the portrait (a `<button>` can't contain the figure's `<dl>`); no-JS gets the avatar back as the phase-3 inset via a `<noscript><style>`.
- Journey: collapsed by default only with JS + motion (first entry open); Lite/no-JS = all open. Entries without description/bullets (education) get no toggle. Expand/collapse = instant layout change + clip-path on the card + translateY on the entries below (no height/grid-rows animation); content after the list jumps (usually off-screen).
- Journey "active period": per-entry CSS `position: sticky` periods (work without JS) + a ScrollTrigger that marks the last entry whose top crossed 55 % of the viewport (`data-active`: lime marker + bigger node).
- Counters: only counters still below the fold reset to 0 (no flash for a reload mid-page); the box is locked to the final width; screen readers read an sr-only copy of the final value; triggered by IntersectionObserver so a jump past them can't leave them at 0.
- The hint card's "shortcut button" option is not used (both chapter hints already have a second sentence).

## Phase 4 — Game foundation, splash, HUD, avatar path

- Save cookie: an untouched new game never creates `hackker_save`; the cookie appears with the first real progress (START → First Steps). Persist writes are deduplicated, so the 7-day expiry slides only on real changes. Blocked cookies → progress lives in memory for the session.
- The loadout is a compact list (no holes): slots fill left to right; equipping into a used slot replaces or swaps.
- Preferences (Lite, Sound, Hackker Mode) are one localStorage key (`hackker_prefs`), with an in-memory fallback when storage throws.
- Lite mode = `prefs.lite` on/off, or "auto" = prefers-reduced-motion / Save-Data. A pre-paint head script sets `<html data-lite>` and `data-boot` before the first paint (no flash, no CLS); `StoreHydrator` keeps them in sync.
- Splash only plays on a hard load of Home, once per session (`boot_seen`), never in Lite/reduced motion or without JS (the overlay is shown only when the head script sets `data-boot="play"`; a 10 s CSS failsafe hides it if JS never takes over). SKIP/Esc skip without awarding First Steps; START, CONTINUE and NEW GAME award it.
- The 5 s splash cap counts from navigation start, but the animation always gets ≥ 1.2 s once JS runs. PRESS START blinks ~1 Hz for 5 s only (WCAG 2.2.2). While up, the splash is a modal (rest inert); afterwards focus moves to the Hero heading.
- `boot` is "done" at the start of the wipe, so the Hero's SplitText reveal overlaps the 8-strip wipe; Hero letters are hidden only while the splash is playing (no flash otherwise).
- HUD: BOSS = defeated ∩ current boss ids. Menu is a `<details>` of chapter anchors until the phase-5 overlay. Badges is a read-only count until the phase-7 drawer. Lite is an on/off button overriding "auto". Help (also the `?` key) re-shows the active chapter's hint and is disabled where a stage has no hint yet.
- No chapter background tween: every section paints its own solid background, so a colour behind them would never show.
- Avatar path: right gutter only, shown when the gutter is ≥ 58 px (≈ 1330 px+ windows), never in Lite. Known cosmetic overlap with the full-bleed showcase row until phase 6 pins it.
- Film grain: no `mix-blend-mode` (blending a full-screen fixed layer repainted the page every scroll frame: ≈ 21 ms → 16.7 ms per frame without it).
- Measured on a production build (headless Chromium, 1440×900): PRESS START at 3.8 s, scroll pass avg 16.6 ms / p95 16.8 ms per frame with 0 frames over 33 ms, CLS 0.0007, no console errors.

## Phase 5 — Skill Tree, Trophy Room, Contact, menu overlay

- Skill Tree nodes stay the full phase-3 cards (readable without JS); the Inventory + 4 slots + Training Dummy live in a separate "Armory" panel below the tree.
- An empty saved loadout means "default" (4 highest damage); the first change writes the shown loadout, then applies the edit, and unlocks `tinkerer`. The last equipped skill can't be unequipped (an empty list would silently bring back the default four); "Default loadout" resets.
- The compact-list rule is visible: a drop on any empty slot lands in the first empty one.
- Drag-to-equip = GSAP Draggable on invisible proxies + a cloned ghost; mouse/fine pointer only, never in Lite. Touch uses tap → native `<dialog>` bottom sheet; desktop keyboard uses an Equip popover (the button alternative to dragging).
- Training Dummy math is only `lib/battle` (`createBattle`/`fire`/`autoFireStep`/`resetBattle`); a round runs while the dummy is ≥ 50 % in view; keys 1–4/A act only then (never in inputs, dialogs, with modifiers or key repeat). Auto-fire with the default loadout KOs at exactly 3.5 s, matching `clearTime`.
- Hovering/pinning a skill marks matching `[data-project-id]` cards with `data-highlight` (lime outline); cards are not restructured.
- First-paint CSS keyed on `html[data-lite="false"]` collapses phone skill branches and Journey accordions (all but the first) before hydration — without it Journey shrank by ~570 px after React ran (CLS 0.39 on deep links → 0.002).
- Trophy dialog = measured grow-from-card animation (Motion `animate`, transform/opacity) rather than `layoutId`, so cards stay server-rendered and the tilt doesn't conflict. Card titles become opener buttons only once JS runs.
- Site toasts (`components/game/toast`): one polite live region, top-right under the HUD (never collides with the bottom-left hint card), max 3, kept live while dialogs make the page inert.
- Contact form is hidden without JS (a plain submit would put the fields in the URL); the mailto link stays. Client validation mirrors the API loosely; API 422s map back to fields; 429 / network / 5xx get friendly messages. Success → STAGE CLEAR (same grid cell height, no shift) + `messenger` badge.
- Menu overlay: GSAP clip-path circle from the Menu button (fade in Lite), lives inside the HUD layer (HUD stays on top), contained focus, Esc/focus return, chapter links are next/link `/#key`; no-JS fallback via CSS `:target`. While the menu or a dialog is open, `<html data-overlay>` hides the hint card.
- Measured on a production build: scroll pass avg 16.6 ms / p95 16.8 ms per frame (0 frames > 33 ms), CLS 0.0033, no console errors.

## Phase 6C — Project Stage modal, Preview Deck, OG image

- Stage modal = intercepting route `app/(site)/@modal/(.)projects/[slug]` with its shell in `(.)projects/layout.tsx`, so next/previous swap only the `[slug]` segment (frame, lock and focus trap stay mounted). Next/previous inside the modal use `replace`: closing returns to the page it was opened from.
- `@modal/page.tsx` (Home) and `@modal/projects/page.tsx` return null: a soft navigation keeps a slot's last state, so links out of the modal (tech chip → `/#skills`, "All projects") would otherwise leave it open. `@modal/projects/default.tsx` covers hard loads of `/projects/[slug]`.
- The modal's and the intercepted page's top elements are `display: contents`: Next scrolls a new segment into view when its first box starts above `scroll-padding-top`, which would have scrolled Home to the top behind a fixed overlay.
- Modal z-index 50 (over the HUD, under the hint card): the Arena's boss hint shows over the modal; any other auto-opened hint (Home chapters still count as "in view" underneath) is dismissed while it is open.
- Focus returns to the card _before_ the scroll lock is released: the pinned showcase recentres a focused cartridge, which otherwise moved Home by up to ~200 px on close.
- Shared element = panel clip-path reveal from the card rect + FLIP of `[data-stage-cover]`, both native WAAPI (same start frame; a Motion tween ran ahead after a long first render, and Motion re-applied a stale clip on the next animation). Rise-in without a card; plain fade in Lite / reduced motion. The card rect is reused for 2.5 s so an opening interrupted by a quick hide/re-show (dev navigations without prefetch) still flies.
- Tab title in the modal comes from `generateMetadata` on the intercepted page (metadata is resolved over every slot); setting `document.title` by hand raced with Next.
- View count: one POST per opening (mount or Activity re-show), deferred one task and cancelled in cleanup so Strict Mode sends one request; off for previews/drafts.
- Open site / Repo row is a client component (`stage/StageLinks`): `<LockedLink>` takes an icon component, which cannot cross the server → client boundary (it crashed as soon as a project had a link).
- "Defeat the boss to unlock" caption: two faces in one grid cell (no shift on unlock), aria-hidden (the locked buttons already say it).
- Deck tabs only for data that exists (Live = `live_url`, even with `allow_iframe_preview` false → fallback card). Panels toggle with `data-active`, not `hidden`: Tailwind preflight hides `[hidden]` with `!important` inside a layer, which the no-JS override could not beat. Without JS all panels show stacked.
- Screenshots: device switcher only for devices with shots; full-page captures (taller than the device screen) keep their ratio in a standard screen and scroll on hover (CSS translateY %, none in Lite / reduced / touch). Carousel = CSS-transform track + pointer events (`touch-action: pan-y`), a drag past 18 % or a flick changes slide, a drag never opens the lightbox.
- Lightbox (next/dynamic, portal, z 57): zoom is a layout switch to the natural width (≥ 2× fit) inside a scroll area, mouse drag pans, touch swipes in fit mode; keys handled in the capture phase and stopped there (the modal and Arena keys stay quiet).
- YouTube = facade with the project poster (no request to Google until the click), then youtube-nocookie with autoplay. Leaving the Video tab remounts it (nothing plays hidden); Activity hide pauses the uploaded video and resets the facade.
- Live: header check `GET /api/frame-check/{slug}` before the iframe (a frame refused by X-Frame-Options / frame-ancestors still fires `load`). It only ever fetches the admin-set `live_url` of a published project (cached, tag `project:{slug}`). Unknown (timeout) → try, with the 6 s budget. The page is laid out at 1280 / 390 px and scaled into the device frame.
- OG image: `opengraph-image.tsx` with Google Fonts TTF subsets (Bricolage condensed 800, Bricolage 600, Silkscreen) fetched per text and cached; built-in font when offline. Next serves it at `/projects/{slug}/opengraph-image-<hash>` for dynamic segments; the page metadata omits `openGraph.images` when there is no og_image / cover so the file wins.

## Phase 6 — Boss lock, Battle Arena, Projects scenes, integration

- One `<TechChips>` (client) decides open/locked chips everywhere from `useBossLock` + `tech_visible_percent` (GameConfig context set in the site layout). Lockable chips and `LockedLink` stack both faces in one grid cell (identical size locked/unlocked); a `<noscript>` rule in the site layout shows every name/link and hides the Arena.
- Server Components never pass functions to these client components (render props / icon components crashed the Stage): `TechChips` takes a plain `link` object; `LockedLink` is a server-safe wrapper that renders the icon element for its client view.
- Arena: the cookie is written at the killing blow; the visual unlock (chips flip, lock pops, Live tab) follows ≈ 0.95 s later and only for a live defeat, never on a returning visitor's hydration. The defeat POST is sent only on the first defeat (`defeat()` returned true), fire-and-forget with keepalive. Rematch never re-locks or re-POSTs. Retreat / scrolling the Arena away / hiding the tab cancels without penalty.
- Arena keys 1–4/A are captured (capture phase + preventDefault) so a Training Dummy elsewhere never double-fires; a slot or key before FIGHT! starts the fight. A killing blow that crosses a phase threshold shows the defeat, not a taunt.
- Generative pixel bosses (slime / horned beast / crowned colossus with 3 phases) are deterministic from slug + tier + accent.
- Collector badge needs the featured boss ids on the Stage — deferred to phase 7 (badges).
- Scene A pin = CSS `position: sticky` with the scroll length reserved from the first paint, ScrollTrigger only scrubs the track: ScrollTrigger's own `pin` adds its spacer after hydration and pushed deep links (`/#trophies`) ≈ 300vh off. Pinned cartridges switch to a landscape layout so a card fits laptop screens; < 1024 px, Lite and reduced motion keep the native swipe carousel.
- One grid component (`ProjectGrid`) on Home and /projects: category + tech chips (OR within a group, AND across groups and search), GSAP Flip, hidden below 3 projects; hover media is only fetched on first hover; Peek dialog for a mini gallery.
- Custom cursor: fine pointer only, never in Lite/reduced motion; labels from `data-cursor` (VIEW on cards; PLAY/OPEN automatic on video/external links; plain ring on buttons); magnetism through the CSS `translate` property. It must not use `usePathname()`: mounted in the layout outside `<Suspense>`, it suspended the prerender of dynamic routes.
- `/projects/[slug]` is a blocking route (`instant = false`, params awaited outside `<Suspense>`): the ISR App-Shell pattern streamed the whole stage as a hidden segment that only JavaScript reveals, so no-JS visitors and crawlers saw nothing. Prerendered slugs stay static; slugs published later render on their first request. Unknown slugs still answer 200 (noindex) with Next's default not-found under PPR — the GAME OVER 404 with a real status is phase 7/8 work.
- Test runs inflated the dev DB view/defeat counters; they were reset to 0 after verification.
- Production integration (headless, 1440×900): card → modal with no flicker, Auto-fire defeat in 4.5 s incl. the 0.9 s intro, locked chips 1 → 0, cookie written, Esc back to the same scroll position, CLS 0.008, direct URL renders the full page.

## Phase 7B — Hackker Mode + GAME OVER 404

- Hackker Mode = `<html data-theme="hackker">`, preference `hackerMode` in localStorage (`hackker_prefs`). The pre-paint head script sets it before the first paint, `<StoreHydrator>` mirrors later changes only after the prefs rehydrated (before that the default `false` would strip it), and `/admin` never gets it.
- The theme re-skins through tokens only, per surface kind: default surfaces map paper → terminal black / ink → phosphor green; "ink" surfaces (dark chapters, menu, hints, toasts, Arena…) keep ink dark and turn paper green; accent blocks get dark text; small ink labels stay reverse video. Project accent colours (stage hero, Scene A background, card shadows) are neutralised to the terminal palette; covers and images keep their colours.
- Mono display type is ~30 % wider than condensed Bricolage: `.hk-condensed` gets `font-size-adjust: 0.43` in Hackker Mode so fitted headings (hero name) still fit at 320 px.
- Touch alternative to the Konami code: swipe ↑ ↑ ↓ ↓ ← → ← → anywhere, then tap twice (no HUD element needed; the HUD nickname is hidden below 360 px). Inputs more than 3 s apart start over.
- The Konami key listener is a window capture listener registered in a layout effect from `<GameChrome>` (before `<main>`), so it runs before the Battle Arena's capture listener; the completing "A" is `preventDefault`ed and never toggles Auto-fire.
- Exit without the code: "Exit Hackker Mode" button in the HUD menu overlay, CSS-visible only under the theme (focus goes back to the Menu button).
- GAME OVER countdown is pure CSS (`steps()` strip of pixel digits, `animation-play-state: paused` on hover/focus-within, INSERT COIN at 0, never navigates), so it works without JS; NO is a `#hk-go-stay` link (:target line) that JS upgrades to "restart + quip". Lite keeps the discrete tick, drops the blink.
- Unknown URLs: the root `app/not-found.tsx` wraps GAME OVER in the real `app/(site)/layout.tsx` component (HUD and everything the site layout mounts, no copy). It is prerendered as `/_not-found` and served with a real 404 and full HTML. A catch-all `app/(site)/[...missing]` calling `notFound()` was rejected: also 404, but its prerender is an empty error shell that only JavaScript fills.
- Unknown project slugs: `ensureStatic = "navigation"` on `/projects/[slug]` → an unlisted slug waits for the complete static render instead of being answered with the fallback shell (`x-nextjs-postponed`, already 200), so `notFound()` gives a real 404. Draft preview still renders (Draft Mode bypasses static output). Limitation: that 404 body is Next's error shell, rendered by JavaScript (no-JS visitors see an empty page; crawlers get 404 + noindex). A Proxy slug check rewriting to `/_not-found` would fix it — not done (Proxy would need an API call per project request).

## Phase 7A — Badges, drawer, sound, rewind

- Badge definitions live in code (`lib/badges.ts`, spec §5) with pure predicates; derived badges (Explorer, Curious, Collector, Night Owl) are only evaluated after the save cookie is read and the splash is gone, and only changes between two hydrated states toast — badges restored from the cookie never toast.
- Curious counts opened Project Stages in localStorage (`hackker_opened`, slugs, capped at 3) because the cookie format is fixed by spec §5.2; it is cleared on Reset save / NEW GAME (a changed save `t` means a reset).
- Collector = every featured project with a boss (featured boss ids come from the site layout through GameConfig), not only the ≤ 6 shown in the showcase; with no featured bosses it is never awarded. Explorer = every chapter Home actually shows (hidden chapters don't block it).
- Badge toasts are batched behind one timer (one jingle per batch); defeat badges toast ≈ 1.2 s after the KO, as the unlock sequence starts.
- The drawer is server-rendered and hidden (no-JS `:target` fallback without Reset); it holds the exact privacy line and a two-step Reset save.
- Sound (Web Audio oscillators only): off by default; no AudioContext is created while sound is off; notes requested while the context wakes are dropped after 200 ms so stale sounds never burst out later.
- Play again = a VHS-rewind overlay (clip-path band, scanlines, "◂◂ REW → ▸ PLAY") while Lenis scrolls to the top; Lite/reduced motion or near the top: a plain jump.
- Known: the ChapterTracker counts chapters passed during fast scrolls (rewind, menu jumps) as visited, so Explorer can be earned that way; after a Reset on the same page Explorer needs a reload to be earnable again.

## Phase 7 — verification

- Production build (port 3101): `/this-does-not-exist` and `/a/b/c` → 404 with the full GAME OVER HTML; `/projects/does-not-exist` → 404 (GAME OVER renders once JS runs; without JS that page is blank — crawlers still get 404 + noindex); `/projects` stable (one load in 4 s — the dev reload loop came from a since-removed catch-all route); Konami toggles Hackker Mode, unlocks `konami`, and the theme survives a reload; the badges drawer lists 10 badges with the cookie notice.
