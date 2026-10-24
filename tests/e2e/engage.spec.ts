import { test, expect, tid, setCredits, generate } from "./helpers";
import type { Page } from "@playwright/test";

type Timing = Partial<{ quietMs: number; gapMs: number; idleMs: number; maxPerSession: number; tickMs: number; hour: number }>;
const FAST: Timing = { quietMs: 300, gapMs: 400, idleMs: 1200, tickMs: 150 };

/**
 * debug flag + shortened timers, applied before every page load.
 * The first-visit tour offer is marked seen (it has its own coordination test below) so it never holds popups back here.
 */
async function boot(page: Page, timing: Timing = FAST, opts: { tourOffer?: boolean } = {}) {
  await page.addInitScript(([t, offer]) => {
    sessionStorage.setItem("kinetic.engage.debug", "1");
    if (!offer) localStorage.setItem("kinetic.tour.seen", '"1"');
    (window as unknown as { __kineticEngageTiming: unknown }).__kineticEngageTiming = t;
  }, [timing, !!opts.tourOffer] as const);
}
/** the engage engine registers its listeners (and the debug reset hook) after hydration: events emitted earlier are lost by design */
const engineReady = (page: Page) => page.waitForFunction(() => typeof (window as unknown as { __kineticEngageReset?: unknown }).__kineticEngageReset === "function");
const card = (page: Page, id?: string) => page.locator(id ? `[data-testid="popup-card"][data-popup="${id}"]` : '[data-testid="popup-card"]');
const engageState = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("kinetic.engage.v1") ?? "{}"));
const emit = async (page: Page, id: string) => {
  await engineReady(page); // events sent before the engine hydrates are lost by design
  await page.evaluate((id) => window.dispatchEvent(new CustomEvent("kinetic:engage", { detail: { id } })), id);
};
const patchStore = (page: Page, patch: Record<string, unknown>) =>
  page.evaluate((p) => {
    const raw = localStorage.getItem("kinetic-store");
    const o = raw ? JSON.parse(raw) : { state: { streak: 0, lastClaim: null, likes: {}, library: [], credits: 50 }, version: 1 };
    Object.assign(o.state, p);
    localStorage.setItem("kinetic-store", JSON.stringify(o));
  }, patch);

test.describe("engage popups", () => {
  test.setTimeout(90_000);
  test("first creation celebrates once, not again after reload, and moves focus into the card", async ({ page, errors }) => {
    await boot(page);
    await page.goto("/create");
    await generate(page);
    const c = card(page, "first-creation");
    await expect(c).toBeVisible();
    await expect(c).toHaveAttribute("role", "dialog");
    await expect(c).toContainText("Your first creation!");
    await expect(tid(page, "popup-cta-first-creation")).toBeFocused();
    await expect(page.getByTestId("popup-share")).toBeVisible();
    // keyboard order: CTA -> remix CTA -> share -> mute -> pause
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("popup-cta-first-creation-2")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("popup-share")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("popup-mute")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(card(page)).toHaveCount(0);
    await page.reload();
    await page.waitForTimeout(1800);
    await expect(card(page, "first-creation")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("credit-low nudge shows cheapest models, real claim and invite link; mute is persisted", async ({ page, errors }) => {
    await boot(page);
    await page.goto("/");
    await setCredits(page, 5);
    const c = card(page, "credit-low");
    await expect(c).toBeVisible();
    await expect(c).toContainText("Flux Lite");
    await expect(c).toContainText("Invite a friend (+30)");
    await expect(c).not.toContainText(/hurry|expires|only \d+ left|countdown/i);
    await page.getByTestId("popup-cta-credit-low").click();
    await expect(page.getByTestId("popup-msg")).toContainText(/\+\d+ credits added/);
    await page.getByTestId("popup-mute").click();
    await expect(card(page)).toHaveCount(0);
    expect((await engageState(page)).muted["credit-low"]).toBe(true);
    await patchStore(page, { credits: 3, lastClaim: null });
    await page.reload();
    await page.waitForTimeout(1800);
    await expect(card(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("global pause stops every popup", async ({ page }) => {
    await boot(page);
    await page.goto("/");
    await setCredits(page, 4);
    await expect(card(page, "credit-low")).toBeVisible();
    await page.getByTestId("popup-pause").click();
    await expect(card(page)).toHaveCount(0);
    expect((await engageState(page)).paused).toBe(true);
    await emit(page, "share-nudge");
    await page.reload();
    await emit(page, "guest-nudge");
    await page.waitForTimeout(1800);
    await expect(card(page)).toHaveCount(0);
  });

  test("never in the quiet period (measured from navigation start)", async ({ page }) => {
    await boot(page, { ...FAST, quietMs: 2500 });
    await page.addInitScript(() => {
      new MutationObserver(() => {
        const w = window as unknown as { __popupAt?: number };
        if (w.__popupAt === undefined && document.querySelector('[data-testid="popup-card"]')) w.__popupAt = performance.now();
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto("/");
    await setCredits(page, 4);
    await expect(card(page, "credit-low")).toBeVisible({ timeout: 20_000 });
    expect(await page.evaluate(() => (window as unknown as { __popupAt: number }).__popupAt)).toBeGreaterThanOrEqual(2500);
  });

  test("never over the assistant or palette", async ({ page }) => {
    await boot(page, { ...FAST, quietMs: 6000 });
    await page.goto("/");
    await setCredits(page, 4);
    await tid(page, "assistant-toggle").click();
    await page.waitForTimeout(8000);
    await expect(card(page)).toHaveCount(0); // quiet is over but the assistant is open
    await tid(page, "assistant-toggle").click();
    await expect(card(page, "credit-low")).toBeVisible();
    // opening the palette while a card is up hides it instead of overlapping
    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("search-input")).toBeVisible();
    await expect(card(page)).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(card(page, "credit-low")).toBeVisible();
  });

  test("never on /login or /signup", async ({ page }) => {
    await boot(page);
    await page.goto("/login");
    await patchStore(page, { credits: 3 });
    await page.reload();
    await emit(page, "share-nudge");
    await page.waitForTimeout(1800);
    await expect(card(page)).toHaveCount(0);
  });

  test("session cap: at most 2 popups, with a gap", async ({ page }) => {
    await boot(page);
    await page.goto("/");
    await emit(page, "share-nudge");
    await expect(card(page)).toBeVisible();
    await emit(page, "remix-milestone");
    await emit(page, "guest-nudge");
    await page.getByTestId("popup-close").click();
    await expect(card(page, "guest-nudge")).toBeVisible(); // second one (higher priority than the milestone), after the gap
    await page.getByTestId("popup-close").click();
    await page.waitForTimeout(2000);
    await expect(card(page)).toHaveCount(0); // cap reached
  });

  test("fits a 280px viewport without horizontal scroll", async ({ page }) => {
    await boot(page);
    await page.setViewportSize({ width: 280, height: 640 });
    await page.goto("/");
    await setCredits(page, 4);
    await expect(card(page, "credit-low")).toBeVisible();
    const b = (await card(page).boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(280);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(640);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const id of ["popup-close", "popup-mute", "popup-pause"]) {
      const t = (await page.getByTestId(id).boundingBox())!;
      expect(t.height).toBeGreaterThanOrEqual(43);
    }
  });

  test("streak at risk after 18:00 offers one-click claim", async ({ page }) => {
    await boot(page, { ...FAST, hour: 20 });
    await page.goto("/");
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    await patchStore(page, { streak: 3, lastClaim: y, credits: 40 });
    await page.reload();
    await expect(card(page, "streak-risk")).toContainText("3-day streak");
    await page.getByTestId("popup-cta-streak-risk").click();
    await expect(page.getByTestId("popup-msg")).toContainText("Streak kept");
    expect((await page.evaluate(() => JSON.parse(localStorage.getItem("kinetic-store")!).state.streak))).toBe(4);
  });

  test("no streak popup before 18:00", async ({ page }) => {
    await boot(page, { ...FAST, hour: 12 });
    await page.goto("/");
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    await patchStore(page, { streak: 3, lastClaim: y, credits: 40 });
    await page.reload();
    await page.waitForTimeout(1800);
    await expect(card(page)).toHaveCount(0);
  });

  test("idle on /create offers Surprise me which clicks the real button", async ({ page }) => {
    await boot(page);
    await page.goto("/create");
    await tid(page, "prompt-input").fill("");
    await expect(card(page, "idle-create")).toBeVisible();
    await page.getByTestId("popup-cta-idle-create").click();
    await expect(tid(page, "prompt-input")).not.toHaveValue("");
    await expect(card(page)).toHaveCount(0);
  });

  test("welcome back after 3+ days lists trending posts linking to remix", async ({ page }) => {
    await boot(page);
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("seeded")) {
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem("kinetic.engage.v1", JSON.stringify({ v: 1, lastVisit: Date.now() - 5 * 86400000 }));
      }
    });
    await page.goto("/");
    const c = card(page, "welcome-back");
    await expect(c).toBeVisible();
    await expect(c.locator("a[href^='/create?remix=']")).toHaveCount(3);
  });

  test("share and guest nudges render honest copy and links", async ({ page }) => {
    await boot(page);
    await page.goto("/");
    await emit(page, "guest-nudge");
    const g = card(page, "guest-nudge");
    await expect(g).toContainText("welcome bonus");
    await expect(page.getByTestId("popup-cta-guest-nudge")).toHaveAttribute("href", "/signup");
    await page.getByTestId("popup-close").click();
    await emit(page, "share-nudge");
    await expect(card(page, "share-nudge")).toContainText("+30");
  });

  test("reset helper clears state in debug mode", async ({ page }) => {
    await boot(page);
    await page.goto("/");
    await engineReady(page);
    await emit(page, "share-nudge");
    await expect(card(page)).toBeVisible();
    await page.evaluate(() => (window as unknown as { __kineticEngageReset: () => void }).__kineticEngageReset());
    await expect(card(page)).toHaveCount(0);
    await page.waitForTimeout(500);
    const st = await engageState(page);
    expect(st.pending).toEqual({});
    expect(st.lastShown).toEqual({});
    expect(st.lastVisit).toBeNull();
  });

  test("the first-visit tour offer and an engage popup never share the screen", async ({ page }) => {
    await boot(page, FAST, { tourOffer: true });
    await page.goto("/");
    await engineReady(page);
    const offer = page.getByTestId("tour-offer");
    await expect(offer).toBeVisible({ timeout: 10_000 });
    // a popup requested while the offer is up is held back, not stacked on it
    await emit(page, "share-nudge");
    await page.waitForTimeout(1500);
    await expect(card(page)).toHaveCount(0);
    await expect(offer).toBeVisible();
    // once the offer is dismissed the popup takes the slot
    await offer.getByRole("button", { name: "Skip" }).click();
    await expect(offer).toHaveCount(0);
    await expect(card(page, "share-nudge")).toBeVisible();
  });

  test("a popup that is already showing defers the tour offer", async ({ page }) => {
    await boot(page, { ...FAST, quietMs: 0 }, { tourOffer: true });
    await page.goto("/");
    await engineReady(page);
    await emit(page, "share-nudge");
    await expect(card(page, "share-nudge")).toBeVisible();
    await page.waitForTimeout(3500); // past the 2.5s offer delay
    await expect(page.getByTestId("tour-offer")).toHaveCount(0);
    await page.getByTestId("popup-close").click();
    await expect(page.getByTestId("tour-offer")).toBeVisible({ timeout: 5000 });
    await expect(card(page)).toHaveCount(0);
  });
});
