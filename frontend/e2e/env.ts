/** Settings shared by playwright.config.ts and the tests (no test imports here). */

export const BASE_URL = (process.env.E2E_BASE_URL ?? "http://localhost:3100").replace(/\/+$/, "");

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "yehezkielnatanael05@gmail.com";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "hackker-admin-2026";

/** The admin session saved by admin.setup.ts (gitignored). */
export const ADMIN_STATE = "e2e/.auth/admin.json";

/** Slug prefix of every project the tests create, so leftovers of a crashed run can be swept. */
export const E2E_SLUG_PREFIX = "e2e-smoke";
