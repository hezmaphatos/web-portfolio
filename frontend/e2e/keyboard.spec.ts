import type { Locator, Page } from "@playwright/test";

import { expect, hydrated, test } from "./support";

/** Is the focused element inside `selector`? */
function focusInside(page: Page, selector: string) {
  return page.evaluate((root) => !!document.activeElement?.closest(root), selector);
}

/** Presses Tab until `target` has focus (keyboard only), at most `max` times. */
async function tabTo(page: Page, target: Locator, max = 40) {
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error(`Tab never reached ${target}`);
}

async function openHome(page: Page) {
  await page.goto("/");
  await expect(page.locator("[data-boot-screen]")).toHaveCount(0); // hydrated, splash skipped
  await hydrated(page.getByRole("button", { name: "Menu" }));
}

test("the skip link is the first stop and moves focus to the content", async ({ page }) => {
  await openHome(page);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  const box = await skip.boundingBox();
  expect(box && box.y >= 0 && box.y < 200, "the focused skip link is on screen").toBe(true);

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
  await page.keyboard.press("Tab");
  expect(await focusInside(page, "#main"), "the next Tab lands in <main>").toBe(true);
});

test("HUD buttons show a visible focus ring", async ({ page }) => {
  await openHome(page);
  const buttons = page.locator("[data-hud] button:visible");
  const count = await buttons.count();
  expect(count).toBeGreaterThan(2);

  await tabTo(page, buttons.first());
  for (let i = 0; i < count; i += 1) {
    const ring = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement;
      const style = getComputedStyle(element);
      return {
        inHud: !!element.closest("[data-hud]"),
        label: element.getAttribute("aria-label") ?? element.textContent?.trim(),
        focusVisible: element.matches(":focus-visible"),
        outline: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2,
      };
    });
    expect(ring.inHud).toBe(true);
    expect(ring.focusVisible && ring.outline, `focus ring on HUD button "${ring.label}"`).toBe(
      true,
    );
    if (i < count - 1) await page.keyboard.press("Tab");
  }
});

test("the menu overlay contains focus and gives it back on Esc", async ({ page }) => {
  await openHome(page);
  const menuButton = page.getByRole("button", { name: "Menu" });
  await tabTo(page, menuButton);
  await page.keyboard.press("Enter");
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  await expect.poll(() => focusInside(page, "#hk-menu")).toBe(true);

  // Focus cycles between the overlay and the HUD on top of it (the Menu button closes it).
  for (let i = 0; i < 25; i += 1) {
    await page.keyboard.press("Tab");
    expect(await focusInside(page, "#hk-menu, [data-hud]"), `Tab ${i + 1} left the menu`).toBe(
      true,
    );
  }

  await page.keyboard.press("Escape");
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await expect(menuButton).toBeFocused();
});

test("the Stage modal traps focus and returns it to the card on Esc", async ({ page }) => {
  await openHome(page);
  const card = page.locator("#all-projects [data-grid-item] a[href^='/projects/']").first();
  await hydrated(card);
  await card.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 120_000 });
  await expect(dialog.getByRole("button", { name: "Close project" })).toBeFocused();
  for (let i = 0; i < 25; i += 1) {
    await page.keyboard.press("Tab");
    expect(await focusInside(page, "[role=dialog]"), `Tab ${i + 1} left the dialog`).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(card).toBeFocused();
});
