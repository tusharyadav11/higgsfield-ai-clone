import { test, expect, tid } from "./helpers";
import type { Page } from "@playwright/test";

const SHOTS = "/private/tmp/claude-502/-Users-tusharyadav-Desktop-higgsfield-ai-/43fc4e18-1c97-4e20-a043-5698e55ab4f7/scratchpad/theme-shots";

async function setMode(page: Page, mode: "light" | "dark" | "system") {
  if (!(await tid(page, `theme-option-${mode}`).isVisible().catch(() => false))) await tid(page, "theme-toggle").click();
  await tid(page, `theme-option-${mode}`).click();
}

test("toggle light / dark / system, persists across reload with no flash", async ({ page, errors }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark"); // dark is the default, even if the OS is light
  await expect(tid(page, "theme-toggle")).toHaveAttribute("aria-label", /Theme: Dark\. Next: System/);

  await setMode(page, "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe("light");
  expect(await page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.getAttribute("content"))).toBe("#f6f6f9");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor + "|" + getComputedStyle(document.documentElement).backgroundColor);
  expect(bg).toContain("rgb(246, 246, 249)");
  await expect(tid(page, "theme-toggle")).toHaveAttribute("aria-label", /Theme: Light\. Next: Dark/);

  await setMode(page, "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.getAttribute("content"))).toBe("#08080a");

  // reload in light: data-theme is already "light" at the very first observation
  await setMode(page, "light");
  // the parser creates <html data-theme="dark"> (SSR default) and the blocking head script flips it before anything can paint,
  // so sample the attribute at every frame / paint entry instead of at element creation
  await page.addInitScript(() => {
    const w = window as unknown as { __themes: (string | null)[] };
    w.__themes = [];
    const rec = () => w.__themes.push(document.documentElement?.getAttribute("data-theme") ?? null);
    try {
      new PerformanceObserver(rec).observe({ type: "paint", buffered: true });
    } catch {}
    let n = 0;
    const loop = () => { rec(); if (++n < 30) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  await page.reload();
  await page.waitForTimeout(700);
  const seen: (string | null)[] = await page.evaluate(() => (window as unknown as { __themes: (string | null)[] }).__themes);
  expect(seen.length).toBeGreaterThan(0);
  expect(seen.filter((x) => x !== "light"), `theme flashed: ${JSON.stringify(seen)}`).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("light");
  expect(errors).toEqual([]);
});

test("system mode follows the emulated colour scheme live", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await setMode(page, "system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "system");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  // an explicit mode ignores the OS
  await setMode(page, "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("theme control also lives in the colour popover and in settings", async ({ page }) => {
  await page.goto("/");
  await tid(page, "accent-switcher").click();
  await page.locator('[data-testid="theme-popover-option-light"]:visible').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.keyboard.press("Escape");
  await page.goto("/settings");
  await expect(page.locator('[data-testid="settings-theme-option-light"]')).toHaveAttribute("aria-checked", "true");
  await page.locator('[data-testid="settings-theme-option-dark"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("header does not overflow with the theme control (280..2560)", async ({ page }) => {
  await page.goto("/");
  for (const w of [280, 320, 390, 820, 1440, 2560]) {
    await page.setViewportSize({ width: w, height: 800 });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `horizontal overflow at ${w}`).toBeLessThanOrEqual(0);
    const clipped = await page.evaluate(() => {
      const h = document.querySelector("header")!;
      return [...h.querySelectorAll("button, a")].filter((e) => (e as HTMLElement).offsetParent !== null).some((e) => e.getBoundingClientRect().right > innerWidth + 1);
    });
    expect(clipped, `header control past the viewport at ${w}`).toBe(false);
  }
});

/* ---------- computed contrast, both themes, several accents ---------- */

const ROUTES = ["/", "/explore", "/pricing", "/usage", "/create"];
const ACCENTS: [string, { named?: string; custom?: string }][] = [
  ["lime", { named: "lime" }],
  ["violet", { named: "violet" }],
  ["custom-pale", { custom: "#f5f06a" }],
];

async function audit(page: Page) {
  return page.evaluate(() => {
    const cv = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const rgba = (c: string) => {
      cv.clearRect(0, 0, 1, 1);
      cv.fillStyle = "#000";
      cv.fillStyle = c;
      cv.fillRect(0, 0, 1, 1);
      const d = cv.getImageData(0, 0, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    };
    const lin = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    const L = (c: { r: number; g: number; b: number }) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
    const cr = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) => (Math.max(L(a), L(b)) + 0.05) / (Math.min(L(a), L(b)) + 0.05);
    const bgOf = (el: Element) => {
      let n: Element | null = el;
      while (n) {
        const c = rgba(getComputedStyle(n).backgroundColor);
        if (c.a > 0.85) return c;
        n = n.parentElement;
      }
      return rgba(getComputedStyle(document.documentElement).backgroundColor);
    };
    const vis = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.opacity !== "0" && !el.closest("[aria-hidden='true'], .aurora, video, .skeleton, [class*='opacity-0'], .text-shine");
    };
    const worst = (sel: string, own = false) => {
      let min = 99, who = "";
      for (const el of [...document.querySelectorAll(sel)].filter(vis).slice(0, 40)) {
        if (!(el.textContent ?? "").trim()) continue;
        if (el.closest("section.isolate")) continue; // hero over video: covered by screenshots + veil token
        const fg = rgba(getComputedStyle(el).color);
        const bg = own ? rgba(getComputedStyle(el).backgroundColor) : bgOf(el);
        const v = cr(fg, bg);
        if (v < min) { min = v; who = `${el.tagName}.${String(el.className).slice(0, 50)} "${(el.textContent ?? "").trim().slice(0, 24)}"`; }
      }
      return { min, who };
    };
    return {
      body: worst("main h1, main h2, main h3, main p, main label, main li, main td, main th"),
      muted: worst(".text-muted"),
      accentText: worst(".text-accent-text"),
      primary: worst("a.bg-accent, button.bg-accent", true),
      theme: document.documentElement.dataset.theme,
    };
  });
}

for (const theme of ["dark", "light"] as const) {
  for (const [label, acc] of ACCENTS) {
    test(`contrast: ${theme} / ${label}`, async ({ page, errors }) => {
      await page.addInitScript(([t, a]) => {
        try {
          localStorage.setItem("theme", t);
          if (a.named) localStorage.setItem("accent", a.named);
          if (a.custom) localStorage.setItem("accent-custom", JSON.stringify({ hex: a.custom }));
        } catch {}
      }, [theme, acc] as const);
      for (const route of ROUTES) {
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const r = await audit(page);
        expect(r.body.min, `${route} body: ${r.body.who}`).toBeGreaterThanOrEqual(4.5);
        expect(r.muted.min, `${route} muted: ${r.muted.who}`).toBeGreaterThanOrEqual(4.5);
        expect(r.accentText.min, `${route} accent text: ${r.accentText.who}`).toBeGreaterThanOrEqual(4.5);
        expect(r.primary.min, `${route} primary button: ${r.primary.who}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(errors).toEqual([]);
    });
  }
}

test("light-mode screenshots", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop" && info.project.name !== "phone", "desktop + phone only");
  await page.addInitScript(() => { try { localStorage.setItem("theme", "light"); } catch {} });
  const tag = info.project.name === "phone" ? "390x844" : "1440x900";
  for (const route of ["/", "/explore", "/create", "/pricing", "/usage"]) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOTS}/${route === "/" ? "home" : route.slice(1)}-${tag}.png` });
  }
});
