import { test, expect, tid, generate } from "./helpers";
import type { Page } from "@playwright/test";

async function openUsageFromNav(page: Page) {
  if (!(await page.locator('[data-testid="nav-usage"]:visible').count())) await tid(page, "nav-more").click();
  await tid(page, "nav-usage").click();
  await expect(page).toHaveURL(/\/usage$/);
}

test("guest: empty state, then usage after a creation, ranges, budget, export", async ({ page, errors }) => {
  await page.goto("/usage");
  await expect(tid(page, "usage-empty")).toBeVisible();
  await expect(tid(page, "usage-balance")).toHaveText("50");
  await expect(page.getByText(/tokens are not tracked/i)).toBeVisible();
  await expect(page.getByTestId("usage-guest-note")).toBeVisible();

  await page.goto("/create");
  await tid(page, "prompt-input").fill("usage dashboard test prompt");
  await generate(page);

  await page.goto("/");
  await openUsageFromNav(page);
  await expect(tid(page, "usage-empty")).toHaveCount(0);
  await expect(tid(page, "usage-chart")).toBeVisible();
  await expect(tid(page, "usage-tool-image")).toBeVisible();
  await expect(tid(page, "usage-tool-video")).toBeVisible();
  await expect(tid(page, "usage-tool-enhance")).toBeVisible();
  await expect(tid(page, "usage-tool-mcp")).toBeVisible();
  await expect(page.getByTestId("usage-model-row")).toHaveCount(1);
  await expect(tid(page, "usage-insight")).toBeVisible();

  for (const r of ["7d", "30d", "90d"] as const) {
    await tid(page, `usage-range-${r}`).click();
    await expect(tid(page, `usage-range-${r}`)).toHaveAttribute("aria-selected", "true");
    await expect(tid(page, "usage-chart")).toBeVisible();
  }

  // chart: keyboard tooltip + table fallback
  await page.locator('[data-testid="usage-chart"] [role="group"]').focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByTestId("usage-tooltip")).toBeVisible();
  await page.getByRole("button", { name: /view as table/i }).click();
  await expect(page.locator('[data-testid="usage-chart"] table')).toBeVisible();

  // budget
  await tid(page, "usage-budget-input").fill("20");
  await expect(page.getByTestId("usage-budget-text")).toContainText(/of 20 credits/);
  await page.reload();
  await expect(tid(page, "usage-budget-input")).toHaveValue("20");

  const dl = page.waitForEvent("download");
  await tid(page, "usage-export").click();
  expect((await dl).suggestedFilename()).toMatch(/^usage-90d-\d{4}-\d{2}-\d{2}\.csv$|^usage-30d-/);

  // no horizontal scroll
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("credits chip still links to pricing", async ({ page }) => {
  await page.goto("/usage");
  await expect(tid(page, "credits-chip")).toHaveAttribute("href", "/pricing");
});

test.describe("signed in (needs DATABASE_URL)", () => {
  test.beforeEach(async ({ request }) => {
    const r = await request.get("/api/auth/me");
    test.skip(!(await r.json()).db, "DATABASE_URL not set: app is in local demo mode");
  });

  test("ledger from the real APIs shows up on /usage", async ({ page, errors }) => {
    const email = `usage${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}@example.com`;
    await page.goto("/signup");
    await tid(page, "auth-email").fill(email);
    await tid(page, "auth-password").fill("correct horse battery");
    await Promise.all([page.waitForURL((u) => u.pathname === "/"), tid(page, "auth-submit").click()]);

    expect((await page.request.post("/api/me/claim")).ok()).toBe(true);
    for (const [kind, model] of [["image", "flux-lite"], ["image", "soul-v2"], ["video", "kling-fast"]]) {
      const r = await page.request.post("/api/generate", { data: { kind, model, prompt: `usage seed ${model}`, aspect: "1:1" } });
      expect(r.ok()).toBe(true);
    }
    const api = await (await page.request.get("/api/me/usage?range=7d")).json();
    expect(api.spent).toBe(2 + 3 + 10);
    expect(api.generations).toBe(3);

    await page.goto("/usage");
    await expect(tid(page, "usage-empty")).toHaveCount(0);
    await expect(page.getByTestId("usage-model-row")).toHaveCount(3);
    await expect(tid(page, "usage-tool-video")).toContainText("10");
    await expect(tid(page, "usage-tool-image")).toContainText("5");
    await expect(page.getByText(/sign in.*keep history/i)).toHaveCount(0);
    await expect.poll(async () => Number((await tid(page, "usage-balance").innerText()).replace(/,/g, ""))).toBe(api.balance);
    expect(errors).toEqual([]);
  });
});
