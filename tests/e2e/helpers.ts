import { test as base, expect, Page, Locator } from "@playwright/test";

export const ROUTES = ["/", "/create", "/explore", "/library", "/pricing"];

/** visible element by data-testid (sidebar + tab bar may both render one) */
export const tid = (page: Page, id: string): Locator => page.locator(`[data-testid="${id}"]:visible`).first();

export const credits = async (page: Page) => {
  const t = (await tid(page, "credits-chip").innerText()).replace(/,/g, "");
  const m = t.match(/\d+/);
  if (!m) throw new Error(`credits-chip has no number: "${t}"`);
  return Number(m[0]);
};

export const IGNORED_CONSOLE = [/Download the React DevTools/i, /\[Fast Refresh\]/i];

export const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      const t = m.text();
      if ((m.type() === "error" || m.type() === "warning") && !IGNORED_CONSOLE.some((r) => r.test(t)))
        if (m.type() === "error" || /hydrat|did not match|key.*prop|act\(/i.test(t)) errors.push(`[${m.type()}] ${t}`);
    });
    page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
    await use(errors);
  },
});
export { expect };

/** rewrite persisted zustand state's credits in localStorage, then reload */
export async function setCredits(page: Page, n: number) {
  const ok = await page.evaluate((n) => {
    for (const k of Object.keys(localStorage)) {
      try {
        const o = JSON.parse(localStorage.getItem(k)!);
        if (o?.state && "credits" in o.state) {
          o.state.credits = n;
          localStorage.setItem(k, JSON.stringify(o));
          return true;
        }
      } catch {}
    }
    return false;
  }, n);
  expect(ok, "could not find persisted store with `credits` in localStorage (zustand persist)").toBe(true);
  await page.reload();
}

export async function generate(page: Page) {
  await tid(page, "generate-btn").click();
  await expect(tid(page, "result-card")).toBeVisible({ timeout: 20_000 });
}
