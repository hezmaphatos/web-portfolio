# CLAUDE.md — Hezki portfolio ("PLAYER ONE")

`PORTFOLIO_SPEC.md` is the single source of truth (Indonesian). This file summarises the rules every session must follow. Public UI text is **English**.

## Repo & local dev

```
backend/   Laravel 13 API only (PHP 8.4) + MySQL 8      → http://127.0.0.1:8100
frontend/  Next.js 16 App Router (site + /admin)        → http://localhost:3100
docs/      DECISIONS.md, LEARNING_NOTES.md, DEPLOY.md, API.md (response contract)
```

- PHP on PATH may be XAMPP 8.2 (too old). Use `C:/Users/natan/tools/php84/php.exe` (Git Bash: `export PATH="/c/Users/natan/tools/php84:$PATH"`). Root `.env` sets `PHP_BIN` for `npm run dev`.
- MySQL: Laragon 8.0, `root` without password, DBs `portfolio` (dev) and `portfolio_test`. Backend tests run on in-memory SQLite (phpunit.xml).
- `npm run dev` at the root starts API + queue + web. Ports 3000/8000 belong to another project on this machine — never use or kill them.
- `frontend/AGENTS.md`: this Next.js has breaking changes vs. training data — read `frontend/node_modules/next/dist/docs/` before using a Next API. Same for every library: verify against the installed version (`node_modules/<pkg>`, `vendor/<pkg>`), not memory.
- Decisions not covered by the spec go to `docs/DECISIONS.md` (1–3 lines each). New frontend techniques get a short entry in `docs/LEARNING_NOTES.md`.

## Phases (spec §14) — never skip ahead

Each phase ends with lint, typecheck, build and tests passing, then a commit `phase-N: ...`.

0. Bootstrap — monorepo, CLAUDE.md, README, env examples, Pint/ESLint/Prettier, root `dev`.
1. Backend core — migrations, models, services, controllers, Form Requests, Sanctum, MediaService, RevalidationService, seeders (CV + game data + hints), all §9 endpoints incl. `defeat`, feature tests.
2. Admin panel — BFF login (httpOnly cookie), layout, generic CRUD, every §7 menu (game fields, Boss tab + clear-time estimate, hints), Media Library + picker, reorder.
3. Frontend foundation (static) — tokens, fonts, layout, server fetch, every chapter as static content (= Lite mode; tech chips fully shown, gating comes in 6), `/projects`, `/projects/[slug]`, tag revalidation.
4. Animated core chapters — Lenis+GSAP provider, HUD shell, avatar path, Splash/Boot (§5.1), save cookie store (§5.2), hint system (§5.3), Hero, About, Journey.
5. Skills (tree + inventory + 4-slot loadout + training dummy), Trophies, Contact (+ STAGE CLEAR), chapter menu overlay.
6. Projects — Scene A pinned, Scene B grid + Flip filter, intercepting-route modal + shared-element transition, Project Stage with Battle Arena (§6.4), Preview Deck, lock/unlock, lightbox, next/prev, OG image, `lib/battle.ts` + Vitest, boss coach marks, Lite "Skip battle".
7. Game layer — badges + toast + drawer + Reset save, Web Audio sound, Konami → Terminal Mode, 404 "GAME OVER", Lite toggle, auto-Lite.
8. Polish — performance, a11y, SEO, mobile, reduced-motion QA, Playwright smoke tests, LEARNING_NOTES.
9. Stretch (only after 0–8). 10. Deploy docs.

## Backend conventions (spec §10) — MANDATORY

1. Strict layers `Controller → Service → Model`. Controllers only take a Form Request, call a Service, return `response()->json(['data' => $array])`. **No queries or business logic in controllers.**
2. Validation in Form Requests (`app/Http/Requests`).
3. Services return **arrays** (`->get()->toArray()`, `->first()?->toArray()`); read results with **array access** (`$project['title']`), never object access on query results (`->` only while building queries / calling Eloquent write methods).
4. **No `collect()` and no Collection methods** (`map`, `filter`, `pluck`, `groupBy`, `keyBy`, …). Use native PHP array functions.
5. **No queries inside loops.** Use `with()`, `whereIn`, `upsert`, batch `insert`, `sync()`, or one aggregate query. Reorder = one `upsert`.
6. No API Resource classes; the response shape is an explicit array built in the Service (see `docs/API.md`).
7. Config from `.env` via `config/*.php` only; never call `env()` outside `config/`.
8. Naming: `ProjectController`, `ProjectService`, `StoreProjectRequest`. One Service per resource, plus `MediaService` and `RevalidationService`.
9. Feature tests: auth, project CRUD (draft vs published), media upload, reorder, contact (throttle + honeypot), `public/home`.
10. Run Pint before committing (`vendor/bin/pint`).

API: prefix `/api/v1`, success `{ "data": ..., "meta"?: ... }`, error `{ "message", "errors": {field: [..]} }` with correct HTTP status. Every public-content write triggers `RevalidationService` (failures are logged, never fail the request).

## Frontend conventions (spec §11)

- TypeScript `strict`; no `any` unless justified in a comment.
- Server Components by default; `"use client"` only for state/animation/browser APIs. Cache Components are on (`"use cache"` + `cacheTag`/`cacheLife`).
- GSAP plugins registered **once** in `lib/gsap.ts`. All animation through `useGSAP` with `scope` (auto cleanup). `gsap.matchMedia()` for desktop/mobile/reduced-motion.
- Lenis ↔ ScrollTrigger sync in one place, `components/providers/SmoothScroll.tsx`: `lenis.on('scroll', ScrollTrigger.update)`, `gsap.ticker.add(t => lenis.raf(t * 1000))`, `gsap.ticker.lagSmoothing(0)`; `ScrollTrigger.refresh()` after fonts/critical images.
- Structure: `components/chapters/*` (one file per chapter), `components/game/*`, `components/project/*`, `components/admin/*`, `components/ui/*`, `lib/{api,gsap,store,save,battle,hints,utils}`.
- Images via `next/image` + `remotePatterns`, `placeholder="blur"` from `blur_data_url`; a single `<Media>` component renders the **generative placeholder** when an image is missing.
- Markdown only via `react-markdown` + `rehype-sanitize`.
- R3F, lightbox and admin are `dynamic import`ed — keep them out of the initial bundle.
- A11y: ordered headings, `alt` from media, visible focus, AA contrast, everything keyboard-operable, `aria-live` for badge toasts, draggable cards have a button alternative.
- Game logic (battle/cooldown/damage) only in `lib/battle.ts` (pure TS, no React/DOM, Vitest-tested). Cookie read/write only via `lib/save.ts`. One `<TechChips>` component decides open/locked chips everywhere. Never read cookies in a Server Component.
- Art direction: tokens `--paper #F3EFE6`, `--ink #111111`, `--hot #FF4B2B`, `--volt #3D5AFE`, `--lime #C6F432`; fonts Bricolage Grotesque / Silkscreen / JetBrains Mono. Hard borders (`2px solid var(--ink)`), hard shadows (`6px 6px 0 var(--ink)`), slight rotations, grain ≤ 0.06. **No** purple gradients, glassmorphism, centered gradient-text hero, or uniform soft-shadow cards. Animate only `transform`, `opacity`, `clip-path`. One prominent motion moment per viewport. The site must stay fully readable without animation (Lite mode).

## Game rules summary

**Save cookie (§5.2)** — `p1_save`, URL-encoded JSON `{"v":1,"loadout":[skillId…≤4],"defeated":[projectId…],"badges":[…],"hints":[…],"visited":<chapter bitmask>,"t":<epoch created>}`; numeric IDs; < 2 KB (drop `hints` first). `Max-Age=604800`, `Path=/`, `SameSite=Lax`, `Secure` in production, not HttpOnly; sliding expiry (re-set on every change). Zod-validated in `lib/save.ts`; unknown version/corrupt → fresh save; unknown IDs filtered on hydrate. Zustand `persist` with a custom `document.cookie` storage, `skipHydration` + `rehydrate()` in an effect — the server never reads it and always renders the locked state; locked/unlocked chips have identical size. Preferences (Lite, Sound, Terminal Mode) live in `localStorage`. Cookie blocked → in-memory state. Badges drawer shows "Your game progress is stored in a cookie for 7 days." + **Reset save** (same as NEW GAME).

**Boss battle (§6.4)** — projects with `boss_enabled` are bosses. Always open: title, tagline, summary, story, meta, screenshots, video, and the visible part of the tech stack. Locked until defeated: remaining tech chips ("???"), Open site / Repo buttons, Live preview tab. Visible tech = `min(n − 1, ceil(n × tech_visible_percent / 100))` (n = 1 → 0 visible), order = `project_skill.sort_order`. Skills: `damage` 25–70, `cooldown_ms` 1000–4000 step 500, `attack_name`. Loadout 4 slots; default = 4 highest `damage` (ties: `level`, then `sort_order`). Boss HP presets minion 50 / regular 100 / final 150 (10–300). Fixed damage, no crits, the boss never attacks, no timer, **no game over**. FIGHT! shows `boss_intro`, every slot starts *charging*; ready slots fire via click/tap or keys 1–4; Auto-fire toggle (`A`, default off). Final tier has 3 visual phases (66 %/33 %). Defeat: 150 ms hit-stop, pixel dissolve, BOSS DEFEATED + `boss_defeat_text`, unlock sequence ≤ 1.5 s; write `defeated` to the cookie and `POST /public/projects/{slug}/defeat` once. Rematch never re-locks. Lite/reduced-motion: instant HP, `aria-live` text, **Skip battle** (counts as defeated). `<noscript>`: everything unlocked, Arena hidden. The lock is a game mechanic, not security: the API payload always contains every tech and link.
