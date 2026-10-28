import AxeBuilder from "@axe-core/playwright";
import type { Page, TestInfo } from "@playwright/test";

import { expect, hydrated, publishedSlug, test } from "./support";

/** WCAG 2.2 A/AA plus axe best practices; only serious and critical findings fail a test. */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const FAILING = new Set(["serious", "critical"]);

/**
 * Lets fades finish before axe measures contrast (it reads the current opacity). The stage hint
 * opens ~0.6 s after load and closes itself after 7 s: hovering pauses it, so the scan checks the
 * open card instead of catching it mid-fade.
 */
async function settle(page: Page) {
  const hint = page.locator('.hk-hint[data-state="open"]');
  const opened = await hint.waitFor({ state: "visible", timeout: 5_000 }).then(
    () => true,
    () => false,
  );
  if (opened) await hint.hover();
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document
              .getAnimations()
              .filter((animation) => animation instanceof CSSTransition)
              .filter((animation) => animation.playState === "running").length,
        ),
      { timeout: 15_000 },
    )
    .toBe(0);
}

async function scan(page: Page, testInfo: TestInfo) {
  await settle(page);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const lines = (impacts: (impact: string) => boolean) =>
    results.violations
      .filter((violation) => impacts(violation.impact ?? "minor"))
      .map(
        (violation) =>
          `${violation.id} (${violation.impact}): ${violation.help} → ` +
          violation.nodes
            .slice(0, 6)
            .map(
              (node) => `${node.target.join(" ")} [${node.any[0]?.message ?? node.failureSummary}]`,
            )
            .join(" | "),
      );

  // Moderate/minor findings are reported, not failed.
  const minor = lines((impact) => !FAILING.has(impact));
  if (minor.length > 0) {
    await testInfo.attach("axe-moderate-minor", {
      body: minor.join("\n"),
      contentType: "text/plain",
    });
  }
  expect(lines((impact) => FAILING.has(impact))).toEqual([]);
}

test("home has no serious accessibility violations", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.locator("[data-boot-screen]")).toHaveCount(0); // hydrated, splash skipped
  await page.waitForLoadState("networkidle");
  await scan(page, testInfo);
});

test("a project page has no serious accessibility violations", async ({
  page,
  request,
}, testInfo) => {
  await page.goto(`/projects/${await publishedSlug(request)}`);
  await hydrated(page.getByRole("button", { name: /^(Fight!|Rematch)$/ }));
  await page.waitForLoadState("networkidle");
  await scan(page, testInfo);
});

test("/projects has no serious accessibility violations", async ({ page }, testInfo) => {
  await page.goto("/projects");
  await hydrated(page.locator("[data-grid-item] a[href^='/projects/']").first());
  await page.waitForLoadState("networkidle");
  await scan(page, testInfo);
});

test("the 404 page has no serious accessibility violations", async ({ page }, testInfo) => {
  const response = await page.goto("/e2e-this-page-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await scan(page, testInfo);
});

test("the admin login has no serious accessibility violations", async ({ page }, testInfo) => {
  await page.goto("/admin/login", { waitUntil: "domcontentloaded" });
  await hydrated(page.getByLabel("Email", { exact: true }));
  await scan(page, testInfo);
});
