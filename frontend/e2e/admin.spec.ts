import type { Page } from "@playwright/test";

import { ADMIN_STATE } from "./env";
import {
  adminApi,
  battleSkills,
  deleteProject,
  escapeRegExp,
  expect,
  hydrated,
  test,
  testTitle,
  type AdminProjectRow,
} from "./support";

test.use({ storageState: ADMIN_STATE });

/** Reloads Home until the "All projects" grid does (or doesn't) list `title` (revalidation). */
async function expectOnHome(page: Page, title: string, present: boolean) {
  await expect(async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const card = page.locator("#all-projects").getByRole("link", { name: title, exact: true });
    await expect(card).toHaveCount(present ? 1 : 0, { timeout: 2_000 });
  }).toPass({ timeout: 150_000, intervals: [1_000, 2_000, 3_000] });
}

test("a project created in the admin appears on Home, then is deleted", async ({ page }) => {
  // Two admin pages, two Home revalidations and a cold compile of the project editor.
  test.slow();
  const title = testTitle("Create");
  const api = await adminApi();
  const [first, second] = await battleSkills(api);
  expect(second, "the seed needs two skills with battle stats").toBeTruthy();
  let created: AdminProjectRow | null = null;
  let deleted = false;

  try {
    // ── Create through the real form ──────────────────────────────────────────
    // "load" can take minutes on a cold dev server (admin chunks); the form is ready once hydrated.
    await page.goto("/admin/projects/new", { waitUntil: "domcontentloaded" });
    const titleField = page.getByRole("textbox", { name: "Title", exact: true });
    await hydrated(titleField);
    await titleField.fill(title);
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Published" }).click();

    await page.getByRole("tab", { name: "Story" }).click();
    await page
      .getByRole("textbox", { name: "Summary", exact: true })
      .fill("Created by the Playwright smoke test; deleted at the end of the test.");

    await page.getByRole("tab", { name: "Tech" }).click();
    await page.getByRole("button", { name: "Add skills" }).click();
    for (const skill of [first, second]) {
      await page
        .getByRole("option", { name: new RegExp(`^${escapeRegExp(skill.name)}\\s*\\d`) })
        .click();
    }
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("list", { name: "Selected skills, in reveal order" }).getByRole("listitem"),
    ).toHaveCount(2);

    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && /\/api\/admin\/projects$/.test(response.url()),
      { timeout: 120_000 },
    );
    await page
      .getByRole("button", { name: /^Create project/ })
      .first()
      .click();
    const response = await saved;
    expect(response.status(), await response.text()).toBe(201);
    created = ((await response.json()) as { data: AdminProjectRow }).data;
    const id = created.id;
    // The editor redirects to the saved project (a cold dev server compiles that route first).
    await expect(page).toHaveURL(new RegExp(`/admin/projects/${id}`), { timeout: 240_000 });
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

    // ── The backend revalidated the site: the project is on Home ─────────────
    await expectOnHome(page, title, true);

    // ── Delete through the real UI ────────────────────────────────────────────
    await page.goto(`/admin/projects/${id}`, { waitUntil: "domcontentloaded" });
    const deleteButton = page.getByRole("button", { name: "Delete", exact: true });
    await hydrated(deleteButton);
    await deleteButton.click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete project" }).click();
    await expect(page).toHaveURL(/\/admin\/projects\/?$/, { timeout: 120_000 });
    deleted = true;
    await expectOnHome(page, title, false);
  } finally {
    // The UI failed half-way: remove the project through the API (the teardown sweeps too).
    if (created && !deleted) await deleteProject(api, created.id);
    await api.dispose();
  }
});
