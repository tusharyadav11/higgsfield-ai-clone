import { test, expect, tid, generate } from "./helpers";

test("empty library state", async ({ page }) => {
  await page.goto("/library");
  await expect(tid(page, "library-empty")).toBeVisible();
  await expect(page.locator('[data-testid="library-item"]')).toHaveCount(0);
  const link = tid(page, "library-empty").locator("a[href^='/create']").first();
  await expect(link, "empty state should have CTA to /create").toBeVisible();
});

test("library delete removes item and returns to empty state", async ({ page }) => {
  await page.goto("/create");
  await generate(page);
  await page.goto("/library");
  const item = tid(page, "library-item");
  await expect(item).toBeVisible();
  await item.hover();
  await item.getByRole("button", { name: /delete|remove/i }).first().click();
  await expect(page.locator('[data-testid="library-item"]')).toHaveCount(0);
  await expect(tid(page, "library-empty")).toBeVisible();
});

test("library re-run goes to /create with prompt", async ({ page }) => {
  await page.goto("/create");
  await tid(page, "prompt-input").fill("unique qa prompt 12345");
  await generate(page);
  await page.goto("/library");
  const item = tid(page, "library-item");
  await item.hover();
  await item.getByRole("button", { name: /re-?run|remix|again/i }).or(item.getByRole("link", { name: /re-?run|remix|again/i })).first().click();
  await expect(page).toHaveURL(/\/create/);
  await expect(tid(page, "prompt-input")).toHaveValue("unique qa prompt 12345");
});

test("pricing: 3 plans, billing toggle changes prices, cost table", async ({ page }) => {
  await page.goto("/pricing");
  for (const p of ["free", "pro", "studio"]) await expect(tid(page, `plan-card-${p}`)).toBeVisible();
  const read = async () => [await tid(page, "plan-card-pro").innerText(), await tid(page, "plan-card-studio").innerText()];
  const a = await read();
  await tid(page, "billing-toggle").click();
  const b = await read();
  expect(b[0], "pro card text changes on toggle").not.toBe(a[0]);
  expect(b[1], "studio card text changes on toggle").not.toBe(a[1]);
  const price = (t: string) => Number((t.match(/\$\s?(\d+(?:\.\d+)?)/) ?? [])[1]);
  expect(price(a[0])).not.toBe(price(b[0]));
  await tid(page, "billing-toggle").click();
  expect((await read())[0], "toggle back restores").toBe(a[0]);
  await expect(page.getByText(/credit/i).first()).toBeVisible();
  await expect(page.locator("table, [role=table]").first(), "credit costs table").toBeVisible();
});

test("pricing free plan is 0", async ({ page }) => {
  await page.goto("/pricing");
  expect(await tid(page, "plan-card-free").innerText()).toMatch(/\$?\s?0|free/i);
});
