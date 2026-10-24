import { test, expect, tid, credits, setCredits, generate } from "./helpers";

test("first-visit /create has a prefilled prompt", async ({ page }) => {
  await page.goto("/create");
  await expect(tid(page, "prompt-input")).not.toHaveValue("");
});

test("generate image -> result-card -> appears in /library; credits decrease", async ({ page, errors }) => {
  await page.goto("/create");
  await tid(page, "kind-image").click();
  await tid(page, "prompt-input").fill("a chrome whale over a neon city");
  const before = await credits(page);
  expect(before).toBe(50);
  await generate(page);
  const after = await credits(page);
  expect(after, "image costs 2..4").toBeLessThanOrEqual(before - 2);
  expect(after).toBeGreaterThanOrEqual(before - 4);
  await page.goto("/library");
  await expect(tid(page, "library-item")).toHaveCount(1);
  await expect(tid(page, "library-empty")).toHaveCount(0);
  // persistence + credits survive reload
  await page.reload();
  await expect(tid(page, "library-item")).toHaveCount(1);
  expect(await credits(page)).toBe(after);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("generate video costs 10..20", async ({ page }) => {
  await page.goto("/create");
  await tid(page, "kind-video").click();
  await tid(page, "prompt-input").fill("slow dolly through a forest");
  const before = await credits(page);
  await generate(page);
  const d = before - (await credits(page));
  expect(d).toBeGreaterThanOrEqual(10);
  expect(d).toBeLessThanOrEqual(20);
});

test("aspect selection is selectable and sent in request", async ({ page }) => {
  await page.goto("/create");
  await tid(page, "aspect-16:9").click();
  const [req] = await Promise.all([
    page.waitForRequest((r) => r.url().includes("/api/generate")),
    tid(page, "generate-btn").click(),
  ]);
  expect(req.postDataJSON().aspect).toBe("16:9");
  expect(["image", "video"]).toContain(req.postDataJSON().kind);
});

test("insufficient credits -> credits-upsell linking to /pricing, no charge, not a dead end", async ({ page }) => {
  await page.goto("/create");
  await setCredits(page, 1);
  expect(await credits(page)).toBe(1);
  await tid(page, "generate-btn").click();
  await expect(tid(page, "credits-upsell")).toBeVisible();
  expect(await credits(page)).toBe(1);
  await expect(tid(page, "result-card")).toHaveCount(0);
  const link = tid(page, "credits-upsell").locator("a[href='/pricing'], a[href^='/pricing']").first();
  await expect(link, "upsell must link to /pricing").toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/pricing/);
});

test("insufficient credits with zero balance never goes negative", async ({ page }) => {
  await page.goto("/create");
  await setCredits(page, 0);
  await tid(page, "generate-btn").click();
  await expect(tid(page, "credits-upsell")).toBeVisible();
  expect(await credits(page)).toBe(0);
});

test("API 500 shows gen-error, no crash, no charge, UI still usable", async ({ page }) => {
  await page.route("**/api/generate", (r) => r.fulfill({ status: 500, contentType: "application/json", body: '{"error":"boom"}' }));
  await page.goto("/create");
  const before = await credits(page);
  await tid(page, "generate-btn").click();
  await expect(tid(page, "gen-error")).toBeVisible();
  await expect(tid(page, "result-card")).toHaveCount(0);
  expect(await credits(page), "failed generation must not consume credits").toBe(before);
  await expect(tid(page, "generate-btn")).toBeEnabled();
  await expect(tid(page, "prompt-input")).toBeVisible();
});

test("network abort shows gen-error", async ({ page }) => {
  await page.route("**/api/generate", (r) => r.abort());
  await page.goto("/create");
  const before = await credits(page);
  await tid(page, "generate-btn").click();
  await expect(tid(page, "gen-error")).toBeVisible();
  expect(await credits(page)).toBe(before);
  await expect(tid(page, "generate-btn")).toBeEnabled();
});

test("API 400 shows gen-error", async ({ page }) => {
  await page.route("**/api/generate", (r) => r.fulfill({ status: 400, contentType: "application/json", body: '{"error":"bad"}' }));
  await page.goto("/create");
  await tid(page, "generate-btn").click();
  await expect(tid(page, "gen-error")).toBeVisible();
});

test("empty / whitespace prompt cannot be submitted to API", async ({ page }) => {
  let hits = 0;
  await page.route("**/api/generate", (r) => { hits++; r.continue(); });
  await page.goto("/create");
  await tid(page, "prompt-input").fill("   ");
  await tid(page, "generate-btn").click({ force: true }).catch(() => {});
  await page.waitForTimeout(500);
  expect(hits, "blank prompt must not hit /api/generate").toBe(0);
});

test("prompt over 500 chars cannot produce a 400 crash", async ({ page }) => {
  await page.goto("/create");
  await tid(page, "prompt-input").fill("x".repeat(600));
  const v = await tid(page, "prompt-input").inputValue();
  let status: number | null = null;
  page.on("response", (r) => { if (r.url().includes("/api/generate")) status = r.status(); });
  await tid(page, "generate-btn").click({ force: true }).catch(() => {});
  await page.waitForTimeout(3500);
  expect(v.length <= 500 || status === null || status === 200, `600-char prompt: value len ${v.length}, api status ${status}`).toBe(true);
  await expect(tid(page, "prompt-input")).toBeVisible();
});

test("double-click Generate does not double-charge", async ({ page }) => {
  let hits = 0;
  await page.route("**/api/generate", (r) => { hits++; r.continue(); });
  await page.goto("/create");
  const before = await credits(page);
  await tid(page, "generate-btn").dblclick({ force: true }).catch(() => {});
  await expect(tid(page, "result-card")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(3000);
  expect(hits, "exactly one /api/generate request").toBe(1);
  const spent = before - (await credits(page));
  expect(spent, "single charge only (max single-generation cost is 20)").toBeLessThanOrEqual(20);
  await page.goto("/library");
  await expect(tid(page, "library-item")).toHaveCount(1);
});

test("keyboard: Ctrl/Cmd+Enter submits", async ({ page }) => {
  await page.goto("/create");
  await tid(page, "prompt-input").focus();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(tid(page, "result-card")).toBeVisible({ timeout: 20_000 });
});

test("keyboard: Enter in prompt submits", async ({ page }) => {
  await page.goto("/create");
  await tid(page, "prompt-input").focus();
  await page.keyboard.press("Enter");
  await expect(tid(page, "result-card"), "plain Enter should submit (or at least Cmd+Enter)").toBeVisible({ timeout: 20_000 });
});

test("keyboard: Tab order reaches generate-btn", async ({ page }) => {
  await page.goto("/create");
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  let reached = false;
  for (let i = 0; i < 80 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(() => document.activeElement?.getAttribute("data-testid") === "generate-btn");
  }
  expect(reached, "generate-btn not reachable within 80 Tab presses").toBe(true);
  await page.keyboard.press("Enter");
  await expect(tid(page, "result-card")).toBeVisible({ timeout: 20_000 });
});

test("surprise-btn sets a random prompt and model", async ({ page }) => {
  await page.goto("/create");
  const seen = new Set<string>([await tid(page, "prompt-input").inputValue()]);
  for (let i = 0; i < 6; i++) {
    await tid(page, "surprise-btn").click();
    const v = await tid(page, "prompt-input").inputValue();
    expect(v.trim().length).toBeGreaterThan(0);
    seen.add(v);
  }
  expect(seen.size, "surprise should produce varied prompts").toBeGreaterThan(2);
  await expect(tid(page, "model-select")).toBeVisible();
});

test("model-select lists models for selected kind", async ({ page }) => {
  await page.goto("/create");
  await tid(page, "kind-video").click();
  const t1 = await tid(page, "model-select").innerText().catch(() => "");
  await tid(page, "kind-image").click();
  const t2 = await tid(page, "model-select").innerText().catch(() => "");
  expect(t1 === t2, "model options should change with kind").toBe(false);
});
