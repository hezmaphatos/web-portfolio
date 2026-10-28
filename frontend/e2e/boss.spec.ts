import {
  adminApi,
  battleSkills,
  createProject,
  deleteProject,
  expect,
  hydrated,
  test,
  testTitle,
  type AdminProjectRow,
} from "./support";

const LIVE_URL = "https://example.com/e2e-live";
const REPO_URL = "https://example.com/e2e-repo";

// Lite path (reduced motion): Skip battle is the deterministic way to beat a boss (spec §6.4).
test.use({ reducedMotion: "reduce" });

test("defeating a boss unlocks its tech and links, and they stay unlocked after a reload", async ({
  page,
  context,
  request,
}) => {
  // A fresh boss with a live site and a repo (no seeded project has both links).
  const api = await adminApi();
  const skills = await battleSkills(api);
  expect(skills.length, "the seed needs three skills with battle stats").toBeGreaterThanOrEqual(3);
  let project: AdminProjectRow | null = null;

  try {
    project = await createProject(api, {
      title: testTitle("Boss"),
      status: "published",
      summary: "A throwaway boss for the Playwright smoke test.",
      category: "web",
      kind: "personal",
      progress: "shipped",
      accent_color: "#3D5AFE",
      skill_ids: skills.slice(0, 3).map((skill) => skill.id),
      boss_enabled: true,
      boss_tier: "minion",
      live_url: LIVE_URL,
      repo_url: REPO_URL,
    });
    const { id, slug } = project;
    // Wait for the backend → site revalidation: the save store drops defeated ids that the site
    // layout does not know yet, so a stale Home payload would re-lock the boss after the reload.
    await expect
      .poll(async () => (await (await request.get("/")).text()).includes(`/projects/${slug}"`), {
        timeout: 150_000,
        intervals: [1_000, 2_000, 3_000],
      })
      .toBe(true);
    // The visitor is not the admin (fresh context, no session cookie).
    expect((await context.cookies()).some((cookie) => cookie.name === "hk_admin")).toBe(false);

    await page.goto(`/projects/${slug}`);
    const lockedChips = page.locator('[data-tech-chips][data-locked="true"]');
    const lockedLinks = page.locator('[data-locked-link][data-locked="true"]');
    const liveLink = page.locator(`[data-locked-link] a[href="${LIVE_URL}"]`).first();
    const repoLink = page.locator(`[data-locked-link] a[href="${REPO_URL}"]`).first();

    // Locked: "???" chips, Open site / Repo are inert stand-ins.
    await expect(lockedChips.first()).toBeVisible();
    await expect(lockedLinks).not.toHaveCount(0); // stage buttons + Arena loot
    await expect(liveLink).toBeHidden();

    const skip = page.getByRole("button", { name: "Skip battle" });
    await hydrated(skip);
    await skip.click();

    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    await expect(lockedChips).toHaveCount(0);
    await expect(lockedLinks).toHaveCount(0);
    await expect(liveLink).toBeVisible();
    await expect(repoLink).toBeVisible();
    const save = (await context.cookies()).find((cookie) => cookie.name === "hackker_save");
    expect(save, "the defeat is written to the save cookie").toBeTruthy();
    const parsed = JSON.parse(decodeURIComponent(save!.value)) as { defeated: number[] };
    expect(parsed.defeated).toContain(id);

    // The server always renders the locked state; the save cookie unlocks it after hydration.
    await page.reload();
    await hydrated(page.getByRole("button", { name: /^(Fight!|Rematch)$/ }));
    await expect(lockedChips).toHaveCount(0);
    await expect(lockedLinks).toHaveCount(0);
    await expect(liveLink).toBeVisible();
    await expect(repoLink).toBeVisible();
  } finally {
    if (project) {
      // Leave the project page first: with `php artisan serve` (one request at a time) a render
      // still in flight there could hold up the delete's revalidation call past its 3 s timeout.
      await page.goto("about:blank");
      await deleteProject(api, project.id);
      const slug = project.slug;
      await expect
        .poll(async () => (await (await request.get("/")).text()).includes(`/projects/${slug}"`), {
          timeout: 150_000,
          intervals: [1_000, 2_000, 3_000],
          message: "Home still lists the deleted boss (revalidation dropped)",
        })
        .toBe(false);
    }
    await api.dispose();
  }
});
