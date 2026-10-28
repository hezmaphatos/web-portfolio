import {
  test as base,
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type Locator,
  type Page,
} from "@playwright/test";

import { ADMIN_STATE, BASE_URL, E2E_SLUG_PREFIX } from "./env";

export { expect };

/**
 * `test` with the splash skipped: the boot screen plays once per tab session (spec §5.1) and the
 * pre-paint script skips it when sessionStorage has `boot_seen=1`. A test can opt out with
 * `test.use({ skipSplash: false })`.
 */
export const test = base.extend<{ skipSplash: boolean }>({
  skipSplash: [true, { option: true }],
  page: async ({ page, skipSplash }, provide) => {
    if (skipSplash) {
      await page.addInitScript(() => {
        try {
          window.sessionStorage.setItem("boot_seen", "1");
        } catch {
          // storage blocked: the splash plays, nothing else changes
        }
      });
    }
    await provide(page);
  },
});

/**
 * Resolves once React has hydrated the element (React DOM keeps its props on hydrated nodes under
 * a `__reactProps$…` key). A click before that is a plain HTML click: a link does a full page
 * load instead of the intercepted modal, a form posts nothing.
 */
export async function hydrated(locator: Locator, timeout = 120_000): Promise<void> {
  // A cold dev server can take minutes to compile and stream a page.
  await locator.waitFor({ state: "attached", timeout });
  await expect
    .poll(
      () =>
        locator.evaluate((element) =>
          Object.keys(element).some((key) => key.startsWith("__reactProps$")),
        ),
      { timeout: 90_000, message: "the element was never hydrated" },
    )
    .toBe(true);
}

/** Collects console errors and uncaught exceptions of a page (check it at the end of a test). */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/** A published project's slug (not one the tests created), read from the sitemap. */
export async function publishedSlug(request: APIRequestContext): Promise<string> {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBe(true);
  const slugs = [...(await response.text()).matchAll(/\/projects\/([a-z0-9-]+)</g)]
    .map((match) => match[1])
    .filter((slug) => !slug.startsWith(E2E_SLUG_PREFIX));
  expect(slugs.length, "the sitemap lists no published project").toBeGreaterThan(0);
  return slugs[0];
}

/* ── Admin API (through the Next.js BFF, with the session saved by admin.setup.ts) ─────────── */

export type AdminSkillRow = {
  id: number;
  name: string;
  category: string;
  is_visible: boolean;
  damage: number | null;
};

export type AdminProjectRow = { id: number; slug: string; title: string };

export async function adminApi(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({
    baseURL: BASE_URL,
    storageState: ADMIN_STATE,
    extraHTTPHeaders: { Accept: "application/json" },
    // php artisan serve handles one request at a time and every write waits for its deferred
    // revalidation call to the (dev) site: a write can take far longer than 30 s locally.
    timeout: 120_000,
  });
}

async function data<T>(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<T> {
  expect(response.ok(), `${response.url()} → ${response.status()}`).toBe(true);
  return ((await response.json()) as { data: T }).data;
}

/** Visible skills with battle stats (what a boss project's tech stack is made of). */
export async function battleSkills(api: APIRequestContext): Promise<AdminSkillRow[]> {
  const skills = await data<AdminSkillRow[]>(await api.get("/api/admin/skills"));
  return skills.filter(
    (skill) => skill.is_visible && skill.category !== "soft" && skill.damage !== null,
  );
}

export async function createProject(
  api: APIRequestContext,
  body: Record<string, unknown>,
): Promise<AdminProjectRow> {
  return data<AdminProjectRow>(await api.post("/api/admin/projects", { data: body }));
}

export async function deleteProject(api: APIRequestContext, id: number): Promise<void> {
  const response = await api.delete(`/api/admin/projects/${id}`);
  expect([200, 404], `DELETE project ${id} → ${response.status()}`).toContain(response.status());
}

/** Deletes every project a test created (slug prefix), e.g. leftovers of an interrupted run. */
export async function sweepTestProjects(api: APIRequestContext): Promise<void> {
  const rows = await data<AdminProjectRow[]>(await api.get("/api/admin/projects"));
  for (const row of rows.filter((project) => project.slug.startsWith(E2E_SLUG_PREFIX))) {
    await deleteProject(api, row.id);
  }
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A unique, recognisable title; its slug starts with E2E_SLUG_PREFIX. */
export function testTitle(label: string): string {
  return `E2E Smoke ${label} ${Date.now().toString(36)}`;
}
