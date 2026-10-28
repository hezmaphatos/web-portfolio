import { test as setup } from "@playwright/test";

import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_STATE } from "./env";
import { adminApi, expect, hydrated, sweepTestProjects } from "./support";

/**
 * Smoke test (d): the admin logs in through the real login form (BFF → Laravel → httpOnly
 * cookie). The session is saved for the other tests, so the throttled login (5/min/IP) runs
 * once per test run.
 */
setup("admin login works through the real UI", async ({ page, request }) => {
  // Compile the revalidation webhook before any admin write: the backend gives it 3 s, and a cold
  // dev server needs longer for its first hit — the revalidation would be dropped (stale Home).
  expect((await request.post("/api/revalidate", { timeout: 180_000 })).status()).toBe(401);

  await page.goto("/admin/login", { waitUntil: "domcontentloaded" });
  const email = page.getByLabel("Email", { exact: true });
  await hydrated(email);
  await email.fill(ADMIN_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  // Generous: a cold dev server compiles the BFF route and the dashboard on the first login.
  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 240_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => cookie.name === "hk_admin");
  expect(session?.httpOnly, "the admin token lives in an httpOnly cookie").toBe(true);

  await page.context().storageState({ path: ADMIN_STATE });

  // Leftovers of an interrupted earlier run would show up on Home and in the sitemap.
  const api = await adminApi();
  await sweepTestProjects(api);
  await api.dispose();
});
