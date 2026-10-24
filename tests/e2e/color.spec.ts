import { test, expect, tid } from "./helpers";

// TODO(color-wiring): remove FIXME once ColorPopover (src/components/color) replaces AccentSwitcher in the header
// and ACCENT_BOOT_SNIPPET runs in the layout's inline <script>. Until then these cannot pass against the real app.
const t = test;

const accentVar = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());

async function openPicker(page: import("@playwright/test").Page) {
  if (!(await tid(page, "accent-picker").isVisible().catch(() => false))) await tid(page, "accent-switcher").click();
  await expect(tid(page, "accent-picker")).toBeVisible();
}

t("dragging the SV area changes --accent immediately; hex input accepts #ff00aa", async ({ page }) => {
  await page.goto("/");
  await openPicker(page);
  const before = await accentVar(page);
  const box = (await tid(page, "accent-sv-area").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.6, { steps: 6 });
  const during = await accentVar(page); // pointer still down: preview must already be applied
  await page.mouse.up();
  expect(during).not.toBe(before);
  await expect(page.locator("html")).toHaveAttribute("data-accent", "custom");

  await tid(page, "accent-hex-input").fill("#ff00aa");
  await tid(page, "accent-hex-input").blur();
  await expect.poll(() => accentVar(page)).toBe("#ff00aa");
});

t("custom accent persists across reload with no flash; reset restores lime", async ({ page }) => {
  await page.goto("/");
  await openPicker(page);
  await tid(page, "accent-hex-input").fill("#ff00aa");
  await tid(page, "accent-hex-input").blur();
  await page.addInitScript(() => {
    (window as unknown as { __seen: (string | null)[] }).__seen = [];
    const rec = () => (window as unknown as { __seen: (string | null)[] }).__seen.push(document.documentElement.getAttribute("data-accent"));
    rec();
    new MutationObserver(rec).observe(document.documentElement, { attributes: true, attributeFilter: ["data-accent"] });
  });
  await page.reload();
  const seen = await page.evaluate(() => (window as unknown as { __seen: (string | null)[] }).__seen);
  expect(seen.filter((x) => x !== "custom"), `flashed: ${JSON.stringify(seen)}`).toEqual([]);
  expect(await accentVar(page)).toBe("#ff00aa");

  await openPicker(page);
  await tid(page, "accent-reset").click();
  await expect(page.locator("html")).toHaveAttribute("data-accent", "lime");
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue("--accent"))).toBe("");
});

t("Escape closes the picker and returns focus to the trigger", async ({ page }) => {
  await page.goto("/");
  await openPicker(page);
  await page.keyboard.press("Escape");
  await expect(tid(page, "accent-picker")).toBeHidden();
  await expect(tid(page, "accent-switcher")).toBeFocused();
});

t("phone: picker is a bottom sheet inside the viewport", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "phone project only");
  await page.goto("/");
  await openPicker(page);
  const dlg = (await page.locator('[role="dialog"]:visible').first().boundingBox())!;
  const vh = page.viewportSize()!.height;
  expect(Math.round(dlg.y + dlg.height)).toBe(vh);
  expect(dlg.x).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

t("works inside the sticky header after scrolling 2000px", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, 2000));
  await openPicker(page);
  const box = (await tid(page, "accent-picker").boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
  const sv = (await tid(page, "accent-sv-area").boundingBox())!;
  const before = await accentVar(page);
  await page.mouse.click(sv.x + sv.width * 0.5, sv.y + sv.height * 0.5);
  expect(await accentVar(page)).not.toBe(before);
});
