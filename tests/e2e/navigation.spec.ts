import { test, expect, tid, ROUTES } from "./helpers";

const NAV: [string, string][] = [
  ["nav-home", "/"], ["nav-explore", "/explore"], ["nav-create", "/create"],
  ["nav-library", "/library"], ["nav-pricing", "/pricing"],
];

test("all routes load 200 with no console errors/hydration warnings", async ({ page, errors }) => {
  for (const r of ROUTES) {
    const res = await page.goto(r);
    expect(res?.status(), r).toBe(200);
    await page.waitForLoadState("networkidle");
    await expect(tid(page, "credits-chip"), `${r} credits-chip`).toBeVisible();
  }
  expect(errors, errors.join("\n")).toEqual([]);
});

test("nav between all routes", async ({ page, errors }) => {
  await page.goto("/");
  for (const [id, path] of NAV) {
    let el = tid(page, id);
    if (!(await el.isVisible().catch(() => false))) {
      // phone: pricing may live behind the "More" tab
      await page.getByRole("button", { name: /more/i }).or(page.getByRole("link", { name: /more/i })).first().click();
      el = tid(page, id);
    }
    await expect(el, `${id} visible`).toBeVisible();
    await el.click();
    await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/$" : path}(\\?|$)`));
  }
  expect(errors, errors.join("\n")).toEqual([]);
});

test("unknown route does not crash (404 page renders)", async ({ page }) => {
  const res = await page.goto("/definitely-not-here");
  expect(res?.status()).toBe(404);
  await expect(page.locator("body")).not.toBeEmpty();
});

test("responsive nav layout matches breakpoint", async ({ page, viewport }) => {
  await page.goto("/");
  const w = viewport!.width;
  const box = await tid(page, "nav-create").boundingBox();
  expect(box, "nav-create visible").toBeTruthy();
  if (w < 640) {
    expect(box!.y, "phone: tab bar at the bottom").toBeGreaterThan(viewport!.height * 0.7);
    expect(box!.height, "44px touch target").toBeGreaterThanOrEqual(44);
  } else {
    expect(box!.x, "tablet/desktop: left rail").toBeLessThan(260);
  }
});
