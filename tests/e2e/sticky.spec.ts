import { expect, test } from "@playwright/test";

const tid = (p: import("@playwright/test").Page, id: string) => p.getByTestId(id);

for (const route of ["/", "/explore", "/pricing", "/library"]) {
  test(`header (search, colour, credits) stays pinned after scrolling on ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.evaluate(() => window.scrollTo(0, 2500));
    await page.waitForTimeout(250);
    const header = page.locator("header").first();
    const box = await header.boundingBox();
    expect(box, "header must exist").not.toBeNull();
    expect(box!.y, "header should be pinned to the top after scroll").toBeLessThanOrEqual(1);
    await expect(tid(page, "accent-switcher")).toBeInViewport();
    await expect(tid(page, "credits-chip")).toBeInViewport();
    await expect(tid(page, "search-trigger").first()).toBeInViewport();
  });
}

test("colour picker and search both work after scrolling down", async ({ page }) => {
  await page.goto("/explore");
  await page.evaluate(() => window.scrollTo(0, 2500));
  await tid(page, "accent-switcher").click();
  await expect(tid(page, "accent-picker")).toBeVisible();
  await tid(page, "accent-hex-input").fill("#ff00aa");
  await tid(page, "accent-hex-input").press("Enter");
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  expect(accent.toLowerCase()).toBe("#ff00aa");
  await page.keyboard.press("Escape");
  await tid(page, "search-trigger").first().click();
  await expect(tid(page, "search-input")).toBeVisible();
});
