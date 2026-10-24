import { test, expect, tid } from "./helpers";

test("accent switch applies, persists across reload, and SSR has no flash", async ({ page, browser, context, baseURL }) => {
  await page.goto("/");
  const html = page.locator("html");
  const vars = async () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  const seen: Record<string, string> = {};
  for (const a of ["lime", "violet", "ember", "ocean"]) {
    const sw = tid(page, "accent-switcher");
    // option may be inside a popover
    if (!(await tid(page, `accent-option-${a}`).isVisible().catch(() => false))) await sw.click();
    await tid(page, `accent-option-${a}`).click();
    await expect(html).toHaveAttribute("data-accent", a);
    seen[a] = await vars();
  }
  expect(new Set(Object.values(seen)).size, `--accent must differ per palette: ${JSON.stringify(seen)}`).toBe(4);

  if (!(await tid(page, "accent-option-violet").isVisible().catch(() => false))) await tid(page, "accent-switcher").click();
  await tid(page, "accent-option-violet").click();
  await page.reload();
  await expect(html).toHaveAttribute("data-accent", "violet");

  // a fresh context with the saved state still boots with the accent (inline script, no SSR cookie read: pages are static)
  const state = await context.storageState();
  const ctx2 = await browser.newContext({ storageState: state, baseURL });
  const p2 = await ctx2.newPage();
  await p2.goto("/");
  await expect(p2.locator("html")).toHaveAttribute("data-accent", "violet");
  await ctx2.close();
});

test("accent value observed before first paint is already the saved one", async ({ page }) => {
  await page.goto("/");
  if (!(await tid(page, "accent-option-ember").isVisible().catch(() => false))) await tid(page, "accent-switcher").click();
  await tid(page, "accent-option-ember").click();
  await page.addInitScript(() => {
    const w = window as unknown as { __accents: (string | null)[] };
    w.__accents = [];
    const rec = () => w.__accents.push(document.documentElement.getAttribute("data-accent"));
    rec();
    new MutationObserver(rec).observe(document.documentElement, { attributes: true, attributeFilter: ["data-accent"] });
  });
  await page.reload();
  const seen: (string | null)[] = await page.evaluate(() => (window as unknown as { __accents: (string | null)[] }).__accents);
  expect(seen.filter((x) => x !== "ember"), `accent flashed through: ${JSON.stringify(seen)}`).toEqual([]);
});
