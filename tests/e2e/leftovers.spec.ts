import { test, expect, tid } from "./helpers";

test("explore tag chips stay on one scrollable row at every width", async ({ page }) => {
  await page.goto("/explore");
  const chips = page.locator('[data-testid^="tag-chip-"]:visible');
  await expect(chips.first()).toBeVisible();
  const tops = await chips.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size, `chip tops ${tops}`).toBe(1);
  await expect(tid(page, "tag-chip-all")).toHaveAttribute("aria-pressed", "true");
});

test("assistant FAB tucks away while scrolling down on phones and returns on scroll-up", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "the FAB only auto-hides below the sm breakpoint (phone project)");
  await page.addInitScript(() => localStorage.setItem("kinetic.tour.seen", '"1"'));
  await page.goto("/explore");
  const fab = page.getByTestId("assistant-toggle");
  await expect(fab).not.toHaveAttribute("data-tucked", /.*/);
  await page.mouse.wheel(0, 900);
  await expect(fab).toHaveAttribute("data-tucked", "true");
  await expect(fab).toHaveCSS("opacity", "0");
  await page.mouse.wheel(0, -200);
  await expect(fab).not.toHaveAttribute("data-tucked", /.*/);
  await expect(fab).toHaveCSS("opacity", "1");
});
