import { defineConfig, devices } from "@playwright/test";

import { BASE_URL } from "./e2e/env";

/**
 * Smoke tests (spec §12) + accessibility pass (phase 8). They run against servers that are
 * already up — the Laravel API and the Next.js site (dev or production build) — and never start
 * them: `npm run dev` at the repo root, then `npm run test:e2e` in frontend/.
 *
 * One worker, no retries: the dev server compiles routes on first hit and the tests share one
 * database (the admin tests create and delete a project), so running them in order keeps every
 * run deterministic. The admin logs in once per run (the login endpoint allows 5 tries a minute).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  // Cold dev-server compiles of a route can take minutes on a busy machine.
  timeout: 300_000,
  expect: { timeout: 30_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    navigationTimeout: 120_000,
    actionTimeout: 30_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // Smoke test (d): logs in through the real UI once and saves the session for the others.
    { name: "admin-login", testMatch: /admin\.setup\.ts$/, teardown: "admin-logout" },
    { name: "admin-logout", testMatch: /admin\.teardown\.ts$/ },
    { name: "chromium", testMatch: /\.spec\.ts$/, dependencies: ["admin-login"] },
  ],
});
