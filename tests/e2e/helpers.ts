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
  // zustand persist (name "kinetic-store", see src/lib/store.ts) only writes after the first state change,
  // so merge into the existing entry or create one with the store's documented shape.
  await page.evaluate((n) => {
    let key = Object.keys(localStorage).find((k) => {
      try { return "credits" in (JSON.parse(localStorage.getItem(k)!)?.state ?? {}); } catch { return false; }
    });
    const o = key ? JSON.parse(localStorage.getItem(key)!) : { state: { streak: 0, lastClaim: null, likes: {}, library: [] }, version: 1 };
    key = key ?? "kinetic-store";
    o.state.credits = n;
    localStorage.setItem(key, JSON.stringify(o));
  }, n);
  await page.reload();
}

export async function generate(page: Page) {
  await tid(page, "generate-btn").click();
  await expect(tid(page, "result-card")).toBeVisible({ timeout: 20_000 });
}
