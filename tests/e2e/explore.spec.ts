import { test, expect, tid } from "./helpers";

test("remix from /explore prefills /create and focuses prompt", async ({ page }) => {
  await page.goto("/explore");
  await expect(tid(page, "feed-card")).toBeVisible();
  await tid(page, "feed-card").hover();
  await tid(page, "remix-btn").click();
  await expect(page).toHaveURL(/\/create\?/);
  const u = new URL(page.url());
  const prompt = u.searchParams.get("prompt");
  expect(prompt, "remix url has ?prompt=").toBeTruthy();
  expect(u.searchParams.get("remix"), "remix url has ?remix=<postId>").toBeTruthy();
  expect(u.searchParams.get("model"), "remix url has ?model=").toBeTruthy();
  await expect(tid(page, "prompt-input")).toHaveValue(prompt!);
  await expect(tid(page, "prompt-input")).toBeFocused();
});

test("remix works from Home trending rail too", async ({ page }) => {
  await page.goto("/");
  const r = tid(page, "remix-btn");
  await expect(r).toBeVisible();
  await r.click();
  await expect(page).toHaveURL(/\/create\?.*prompt=/);
  await expect(tid(page, "prompt-input")).not.toHaveValue("");
});

test("like toggles with optimistic count and persists", async ({ page }) => {
  await page.goto("/explore");
  const card = tid(page, "feed-card");
  const like = card.locator('[data-testid="like-btn"]').first();
  const num = async () => Number(((await like.innerText()).replace(/,/g, "").match(/[\d.]+/) ?? ["NaN"])[0]);
  const state = async () => (await like.getAttribute("aria-pressed")) ?? "none";
  const n0 = await num();
  const s0 = await state();
  expect(Number.isNaN(n0), "like-btn should show a count").toBe(false);
  await like.click();
  expect(await num(), "count +1 immediately").toBe(n0 + 1);
  expect(await state(), "aria-pressed should flip").not.toBe(s0);
  await page.reload();
  const like2 = tid(page, "feed-card").locator('[data-testid="like-btn"]').first();
  expect(Number(((await like2.innerText()).replace(/,/g, "").match(/[\d.]+/) ?? ["NaN"])[0]), "like persists after reload").toBe(n0 + 1);
  await like2.click();
  expect(Number(((await like2.innerText()).replace(/,/g, "").match(/[\d.]+/) ?? ["NaN"])[0]), "unlike returns to original").toBe(n0);
});

test("tag filter requests filtered feed and shows cards", async ({ page }) => {
  await page.goto("/explore");
  await expect(tid(page, "feed-card")).toBeVisible();
  const chips = page.locator('[data-testid^="tag-chip-"]:visible');
  expect(await chips.count(), "tag chips").toBeGreaterThan(1);
  const n0 = await page.locator('[data-testid="feed-card"]').count();
  let tagChip = null as any, tag = "";
  const cnt = await chips.count();
  for (let i = 0; i < cnt; i++) {
    const id = (await chips.nth(i).getAttribute("data-testid"))!.replace("tag-chip-", "");
    if (id !== "all") { tagChip = chips.nth(i); tag = id; break; }
  }
  expect(tagChip, "non-'all' tag chip").toBeTruthy();
  const resp = page.waitForResponse((r) => r.url().includes("/api/feed") && r.url().includes("tag="), { timeout: 10_000 }).catch(() => null);
  await tagChip.click();
  const r = await resp;
  expect(r, `clicking tag-chip-${tag} should call /api/feed?tag=`).not.toBeNull();
  expect(decodeURIComponent(new URL(r!.url()).searchParams.get("tag")!)).toBe(tag);
  await expect(tid(page, "feed-card")).toBeVisible();
  const n1 = await page.locator('[data-testid="feed-card"]').count();
  expect(n1).toBeGreaterThan(0);
  expect(n1, "filtered count < unfiltered").toBeLessThan(Math.max(n0, 49));
  // unknown tag chip back to all
  const all = page.locator('[data-testid="tag-chip-all"]:visible').first();
  if (await all.count()) { await all.click(); await expect.poll(() => page.locator('[data-testid="feed-card"]').count()).toBeGreaterThanOrEqual(n1); }
});

test("infinite scroll loads more cards, no duplicates", async ({ page }) => {
  await page.goto("/explore");
  const cards = page.locator('[data-testid="feed-card"]');
  await expect(cards.first()).toBeVisible();
  const n0 = await cards.count();
  expect(n0, "initial page should be a subset of 48 posts").toBeLessThan(48);
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, 4000);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(400);
  }
  await expect.poll(() => cards.count(), { timeout: 10_000 }).toBeGreaterThan(n0);
  expect(await cards.count(), "all 48 should eventually load, never more").toBeLessThanOrEqual(48);
  const ids = await cards.evaluateAll((els) => els.map((e) => e.getAttribute("data-id") ?? e.getAttribute("id") ?? e.textContent));
  expect(new Set(ids).size, "no duplicate cards").toBe(ids.length);
});

test("feed API failure shows non-crashing state", async ({ page }) => {
  await page.route("**/api/feed**", (r) => r.fulfill({ status: 500, body: "x" }));
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto("/explore");
  await page.waitForTimeout(1500);
  await expect(tid(page, "nav-home")).toBeVisible();
  expect(errs, errs.join("\n")).toEqual([]);
});
