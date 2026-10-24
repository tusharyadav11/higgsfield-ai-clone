import { test, expect } from "./helpers";
import type { Page } from "@playwright/test";

const boot = async (page: Page, path = "/") => {
  await page.addInitScript(() => localStorage.setItem("kinetic.tour.seen", '"1"'));
  await page.goto(path);
};
const openHelp = async (page: Page) => {
  if (!(await page.locator('[data-testid="help-menu"]:visible').count())) await page.getByTestId("nav-more").click();
  await page.locator('[data-testid="help-menu"]:visible').first().click();
};

test.describe("tour video", () => {
  test("opens from Help menu (first item), has poster + captions, nothing fetched before open", async ({ page }) => {
    const reqs: string[] = [];
    page.on("request", (r) => reqs.push(r.url()));
    await boot(page);
    await page.waitForTimeout(800);
    expect(reqs.filter((u) => /kinetic-tour/.test(u))).toEqual([]);
    await openHelp(page);
    const items = page.locator('[role="menuitem"]');
    await expect(items.first()).toHaveAttribute("data-testid", "help-tour-video");
    await expect(page.getByTestId("tour-start")).toBeVisible(); // interactive tour kept
    await items.first().click();
    const dlg = page.getByTestId("tour-video");
    await expect(dlg).toBeVisible();
    const v = page.getByTestId("tour-video-player");
    await expect(v).toHaveAttribute("poster", /kinetic-tour\.jpg/);
    await expect(v.locator("track")).toHaveAttribute("src", /kinetic-tour\.vtt/);
    await expect(v).toHaveAttribute("preload", "metadata");
    await expect.poll(() => reqs.some((u) => /kinetic-tour\.mp4/.test(u))).toBe(true);
  });

  test("opens from hero; chapters seek; Esc closes and returns focus", async ({ page }) => {
    await boot(page);
    const hero = page.getByTestId("hero-watch-tour");
    await hero.click();
    const v = page.getByTestId("tour-video-player");
    await expect(v).toBeVisible();
    await expect.poll(() => v.evaluate((el: HTMLVideoElement) => el.readyState)).toBeGreaterThan(0);
    const ch = page.locator('[data-testid^="tour-video-chapter-"]');
    expect(await ch.count()).toBeGreaterThanOrEqual(6);
    await page.getByTestId("tour-video-chapter-3").click();
    await expect.poll(() => v.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThan(10);
    await expect(page.getByTestId("tour-video-chapter-3")).toHaveAttribute("aria-current", "true");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("tour-video")).toHaveCount(0);
    await expect(hero).toBeFocused();
  });

  test("Try it yourself starts the interactive tour; event opens it too", async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.dispatchEvent(new Event("kinetic:tour-video")));
    await expect(page.getByTestId("tour-video")).toBeVisible();
    await page.getByTestId("tour-video-try").click();
    await expect(page.getByTestId("tour-video")).toHaveCount(0);
    await expect(page.getByTestId("tour-overlay")).toBeVisible();
  });

  test("assistant offers the video", async ({ page }) => {
    await boot(page);
    await page.getByTestId("assistant-toggle").click();
    await page.getByTestId("assistant-input").fill("show me how it works");
    await page.getByTestId("assistant-send").click();
    await page.getByRole("button", { name: "Watch tour" }).click();
    await expect(page.getByTestId("tour-video")).toBeVisible();
  });

  test("first-visit offer toast leads with the video", async ({ page }) => {
    await page.goto("/");
    const watch = page.getByTestId("tour-start");
    await expect(watch).toHaveText("Watch 60s tour", { timeout: 8000 });
    await expect(page.getByRole("button", { name: "Skip" })).toBeVisible();
    await watch.click();
    await expect(page.getByTestId("tour-video")).toBeVisible();
  });

  test("no horizontal overflow at 280px", async ({ page }) => {
    await page.setViewportSize({ width: 280, height: 560 });
    await boot(page);
    await page.evaluate(() => window.dispatchEvent(new Event("kinetic:tour-video")));
    const dlg = page.getByTestId("tour-video");
    await expect(dlg).toBeVisible();
    const r = await dlg.evaluate((el) => {
      const b = el.getBoundingClientRect();
      return { l: b.left, r: b.right, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
    });
    expect(r.l).toBeGreaterThanOrEqual(0);
    expect(r.r).toBeLessThanOrEqual(280);
    expect(r.sw).toBeLessThanOrEqual(r.cw);
  });

  test("reduced motion: no autoplay", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await boot(page);
    await page.evaluate(() => window.dispatchEvent(new Event("kinetic:tour-video")));
    const v = page.getByTestId("tour-video-player");
    await expect(v).toBeVisible();
    await expect.poll(() => v.evaluate((el: HTMLVideoElement) => el.readyState)).toBeGreaterThan(0);
    await page.waitForTimeout(1200);
    expect(await v.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);
    expect(await v.evaluate((el: HTMLVideoElement) => el.autoplay)).toBe(false);
  });
});
