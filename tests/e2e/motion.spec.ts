import { test, expect, tid, generate } from "./helpers";
import type { Page } from "@playwright/test";

const playing = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll("video")].filter((v) => !v.paused && !v.ended && v.readyState > 2).length);
const cap = (page: Page) => page.evaluate(() => (matchMedia("(hover: none)").matches ? 2 : 3));
// hero video is a separate, always-single element outside the card budget
const cardPlaying = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll('[data-testid="feed-card"] video')].filter((v) => !(v as HTMLVideoElement).paused).length);

test.describe("motion", () => {
  test("explore: bounded concurrent playback while scrolling, posters present, far videos idle", async ({ page }) => {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");
    const max = await cap(page);
    let sawPlaying = 0;
    for (let i = 0; i < 14; i++) {
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(350);
      const n = await cardPlaying(page);
      sawPlaying = Math.max(sawPlaying, n);
      expect(n, `step ${i}`).toBeLessThanOrEqual(max);
    }
    expect(sawPlaying, "in-view cards should autoplay").toBeGreaterThan(0);

    const state = await page.evaluate(() => {
      const vh = innerHeight;
      return [...document.querySelectorAll('[data-testid="feed-card"] video')].map((v) => {
        const r = v.getBoundingClientRect();
        const el = v as HTMLVideoElement;
        return {
          visible: r.bottom > 0 && r.top < vh && Math.min(r.bottom, vh) - Math.max(r.top, 0) >= r.height * 0.4,
          paused: el.paused,
          muted: el.muted,
          playsInline: el.hasAttribute("playsinline"),
          poster: !!el.getAttribute("poster"),
          far: r.bottom < -vh * 2 || r.top > vh * 3,
        };
      });
    });
    expect(state.length).toBeGreaterThan(0);
    for (const s of state) {
      expect(s.muted && s.playsInline && s.poster).toBe(true);
      if (!s.visible) expect(s.paused).toBe(true);
      // phones unload videos that are far away (element removed); desktop may keep them, but paused
      if (s.far && max === 2) throw new Error("far video still mounted on touch");
    }
    // every card keeps its still photo
    const imgs = await page.locator('[data-testid="feed-card"] img').count();
    expect(imgs).toBeGreaterThan(0);
  });

  test("videos are not fetched until near the viewport (preload=none, none playing at load below the fold)", async ({ page }) => {
    const fetched: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/media/motion/")) fetched.push(r.url());
    });
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    const vh = await page.evaluate(() => innerHeight);
    const below = await page.evaluate(
      (vh) => [...document.querySelectorAll('[data-testid="feed-card"] video')].filter((v) => v.getBoundingClientRect().top > vh * 2).length,
      vh,
    );
    expect(below).toBe(0); // elements are not even created far below the fold
    const total = await page.locator('[data-testid="feed-card"]').count();
    expect(fetched.length, `fetched ${fetched.length} loops of ${total} cards on first paint`).toBeLessThanOrEqual(6);
  });

  test("result card plays the generated image's motion loop", async ({ page }) => {
    await page.goto("/create");
    await tid(page, "prompt-input").fill("neon city rain");
    await generate(page);
    const card = tid(page, "result-card");
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator("video")).toHaveCount(1, { timeout: 5000 });
    await expect.poll(() => card.locator("video").evaluate((v: HTMLVideoElement) => !v.paused), { timeout: 8000 }).toBe(true);
  });
});

test.describe("motion with prefers-reduced-motion", () => {
  test.use({ reducedMotion: "reduce" });
  for (const route of ["/", "/explore"]) {
    test(`no video plays and no CSS drift on ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      for (let i = 0; i < 6; i++) {
        await page.mouse.wheel(0, 800);
        await page.waitForTimeout(250);
      }
      expect(await playing(page)).toBe(0);
      const anims = await page.evaluate(() =>
        document.getAnimations().filter((a) => /^(kb\d|sweep)/.test((a as CSSAnimation).animationName ?? "") || /kb\d|sweep/.test((a as CSSAnimation).animationName ?? "")).length,
      );
      expect(anims).toBe(0);
    });
  }
});
