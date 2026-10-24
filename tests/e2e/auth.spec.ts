import { test, expect, tid, credits, generate } from "./helpers";
import type { Page } from "@playwright/test";

// These tests need Postgres (DATABASE_URL). Without it the app is in local demo mode and they are skipped.
test.beforeEach(async ({ request }) => {
  const r = await request.get("/api/auth/me");
  test.skip(!(await r.json()).db, "DATABASE_URL not set: app is in local demo mode");
});

const uniq = () => `e2e${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}@example.com`;
const PW = "correct horse battery";

async function signup(page: Page, email: string, query = "") {
  await page.goto(`/signup${query}`);
  await tid(page, "auth-email").fill(email);
  await tid(page, "auth-password").fill(PW);
  await Promise.all([page.waitForURL((u) => u.pathname === "/"), tid(page, "auth-submit").click()]);
}
const me = async (page: Page) => (await (await page.request.get("/api/me")).json()) as { user: { email: string; referralCode: string } | null; balance: number; library: unknown[] };

test("signup -> logout -> login restores the account from the server", async ({ page }) => {
  const email = uniq();
  await signup(page, email);
  await expect.poll(async () => (await me(page)).user?.email).toBe(email);
  await expect.poll(() => credits(page)).toBe(75); // 50 guest credits carried over + 25 signup bonus

  await page.request.post("/api/auth/logout");
  await page.reload();
  await expect.poll(() => credits(page)).toBe(50); // clean guest again
  expect((await me(page)).user).toBeNull();

  await page.goto("/login");
  await tid(page, "auth-email").fill(email);
  await tid(page, "auth-password").fill("wrong-password!");
  await tid(page, "auth-submit").click();
  await expect(tid(page, "auth-error")).toContainText(/incorrect email or password/i);
  await tid(page, "auth-password").fill(PW);
  await Promise.all([page.waitForURL((u) => u.pathname === "/"), tid(page, "auth-submit").click()]);
  await expect.poll(() => credits(page)).toBe(75);
});

test("a guest's library follows them into the new account", async ({ page }) => {
  await page.goto("/create");
  await tid(page, "prompt-input").fill("guest keepsake prompt");
  await generate(page);
  await page.goto("/library");
  await expect(tid(page, "library-item")).toBeVisible();

  const email = uniq();
  await signup(page, email);
  await expect.poll(async () => (await me(page)).library.length).toBe(1);

  // wipe the browser cache: the library comes back from Postgres
  await page.evaluate(() => localStorage.clear());
  await page.goto("/library");
  await expect(tid(page, "library-item")).toHaveCount(1);
  await expect(tid(page, "library-item")).toContainText("guest keepsake prompt");
});

test("referral link flow: both sides are credited immediately, and the code survives navigation", async ({ page, browser }) => {
  const a = uniq();
  await signup(page, a);
  const code = (await me(page)).user!.referralCode;
  await page.goto("/referrals");
  await expect(tid(page, "ref-code")).toHaveText(code);
  await expect(tid(page, "ref-link")).toHaveValue(new RegExp(`/signup\\?ref=${code}$`));

  const ctx = await browser.newContext({ baseURL: page.url().split("/referrals")[0] });
  const friend = await ctx.newPage();
  await friend.goto(`/signup?ref=${code}`);
  await expect(tid(friend, "ref-note")).toContainText(code);
  await friend.goto("/pricing"); // wander off; the code must persist
  await friend.goto("/signup");
  await tid(friend, "auth-email").fill(uniq());
  await tid(friend, "auth-password").fill(PW);
  await Promise.all([friend.waitForURL((u) => u.pathname === "/"), tid(friend, "auth-submit").click()]);
  await expect.poll(() => credits(friend)).toBe(50 + 25 + 20);
  await ctx.close();

  // referrer's credit is already in the DB: no need to have the page open
  await expect.poll(async () => (await me(page)).balance).toBe(50 + 25 + 30);
  await page.reload();
  await expect(page.locator("[data-testid=invited-empty]")).toHaveCount(0);
});

test("server-side credits survive a cleared localStorage", async ({ page }) => {
  await signup(page, uniq());
  await page.goto("/");
  const before = await credits(page);
  await tid(page, "streak-claim").click();
  await expect.poll(() => credits(page)).toBeGreaterThan(before);
  const after = await credits(page);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect.poll(() => credits(page)).toBe(after);
  await expect(tid(page, "streak-claim")).toBeDisabled();
});

test("signed-in generate is charged by the server exactly once", async ({ page }) => {
  await signup(page, uniq());
  await page.goto("/create");
  const before = await credits(page);
  await generate(page);
  await expect.poll(async () => (await me(page)).balance).toBeLessThan(before);
  const server = (await me(page)).balance;
  await expect.poll(() => credits(page)).toBe(server);
  await page.reload();
  expect(await credits(page)).toBe(server);
});
