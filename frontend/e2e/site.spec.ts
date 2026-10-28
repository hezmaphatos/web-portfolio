import { collectErrors, escapeRegExp, expect, hydrated, publishedSlug, test } from "./support";

/** Home chapters in spec §4.1 order (the boot chapter is the splash, skipped here). */
const CHAPTERS = ["hero", "about", "journey", "skills", "projects", "trophies", "contact"];

test("home loads with every chapter and no console errors", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const key of CHAPTERS) {
    await expect(page.locator(`section#${key}`), `chapter #${key}`).toHaveCount(1);
  }
  await expect(page.locator("#all-projects [data-grid-item]").first()).toBeVisible();
  // Hydrated (the server-rendered splash is removed by React when it is skipped).
  await expect(page.locator("[data-boot-screen]")).toHaveCount(0);
  await page.waitForLoadState("networkidle");

  expect(errors).toEqual([]);
});

test("a project card opens the Stage modal and Esc closes it", async ({ page }) => {
  await page.goto("/");
  const link = page.locator("#all-projects [data-grid-item] a[href^='/projects/']").first();
  const href = (await link.getAttribute("href")) ?? "";
  const title = ((await link.textContent()) ?? "").trim();
  await hydrated(link);

  await link.click();
  // The first open compiles the intercepted route on a dev server.
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(href)}$`), { timeout: 120_000 });
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog.getByRole("heading", { level: 1 })).toHaveText(
    new RegExp(escapeRegExp(title), "i"),
  );

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("section#projects")).toBeVisible();
});

test("a direct project URL renders the full page, not the modal", async ({ page, request }) => {
  const slug = await publishedSlug(request);
  const response = await page.goto(`/projects/${slug}`);
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-tech-chips]").first()).toBeAttached();
});
