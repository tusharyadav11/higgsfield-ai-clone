import postgres from "postgres";
import { test, expect, tid } from "./helpers";
import type { Page } from "@playwright/test";
import { computeQuote, formatCents, formatNum, type Billing, type Addons } from "../../src/lib/enterprise/pricing";

const DB_URL = process.env.DATABASE_URL ?? "postgres://localhost:5432/kinetic";
const SHOTS = process.env.ENT_SHOTS;
const seats = (page: Page, v: string) => page.getByTestId("ent-seats-input").fill(v);
const text = (page: Page, id: string) => page.getByTestId(id).innerText();

async function expectMatches(page: Page, o: { seats: number; billing?: Billing; addons?: Addons }) {
  const q = computeQuote(o);
  await expect(page.getByTestId("ent-total-monthly")).toHaveText(formatCents(q.monthlyTotalCents));
  await expect(page.getByTestId("ent-total-annual")).toHaveText(formatCents(q.annualTotalCents));
  await expect(page.getByTestId("ent-savings")).toHaveText(formatCents(q.savingsCents));
  await expect(page.getByTestId("ent-pool")).toHaveText(formatNum(q.includedPool));
  await expect(page.getByTestId("ent-discount")).toHaveText(q.custom ? "Custom" : `${q.pct}%`);
}

test.describe("enterprise page", () => {
  test("renders every section with proper landmarks and heading order, no console errors", async ({ page, errors }) => {
    await page.goto("/enterprise");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    for (const id of ["overview", "benefits", "calculator", "compare", "summary", "quote", "faq"]) await expect(page.locator(`#${id}`)).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "On this page" })).toBeVisible();
    const levels = await page.evaluate(() => [...document.querySelectorAll("main h1, main h2, main h3, main h4")].map((h) => Number(h.tagName[1])));
    for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1], `heading jump at #${i}`).toBeLessThanOrEqual(1);
    // honesty: no certification or live-billing claims
    const body = await page.locator("main").innerText();
    expect(body).not.toMatch(/(SOC ?2|ISO ?27001|HIPAA|GDPR)[^.]{0,20}(certified|compliant)/i);
    expect(body).toMatch(/billing is not live/i);
    expect(body).toMatch(/on request/i);
    await page.waitForTimeout(300);
    expect(errors).toEqual([]);
  });

  test("hero calls to action do something real", async ({ page }) => {
    await page.goto("/enterprise");
    await page.getByTestId("ent-cta-quote").click();
    await expect(page.getByTestId("quote-name")).toBeFocused();
    await expect(page).toHaveURL(/#quote$/);
    await page.goto("/enterprise");
    await page.getByTestId("demo-open").click();
    await expect(page.getByTestId("demo-dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("demo-dialog")).toBeHidden();
    await page.getByTestId("ent-cta-workspace").click();
    await expect(page).toHaveURL(/\/enterprise\/workspace\/team/);
  });

  test("calculator maths match the pure function at the tier boundaries", async ({ page }) => {
    await page.goto("/enterprise");
    for (const n of [1, 9, 10, 24, 25, 99, 100, 499, 500, 1200, 5000]) {
      await seats(page, String(n));
      await expectMatches(page, { seats: n });
    }
    await page.getByTestId("ent-billing-annual").click();
    await expect(page.getByTestId("ent-billing-annual")).toHaveAttribute("aria-pressed", "true");
    await seats(page, "100");
    await expectMatches(page, { seats: 100, billing: "annual" });
    await page.getByTestId("ent-addon-5k-plus").click();
    await page.getByTestId("ent-addon-5k-plus").click();
    await page.getByTestId("ent-addon-100k-plus").click();
    await expect(page.getByTestId("ent-addon-5k")).toHaveText("2");
    await expectMatches(page, { seats: 100, billing: "annual", addons: { "5k": 2, "100k": 1 } });
    await page.getByTestId("ent-addon-5k-minus").click();
    await expectMatches(page, { seats: 100, billing: "annual", addons: { "5k": 1, "100k": 1 } });
    await expect(page.getByTestId("ent-breakdown")).toBeVisible();
    await expect(page.getByTestId("ent-live")).toContainText("100 seats, annual billing");
  });

  test("presets, slider and active tier highlight", async ({ page }) => {
    await page.goto("/enterprise");
    await page.getByTestId("ent-preset-100").click();
    await expect(page.getByTestId("ent-seats")).toHaveText("100");
    await expect(page.getByTestId("ent-tier-100")).toHaveAttribute("aria-current", "true");
    await page.getByTestId("ent-preset-500").click();
    await expect(page.getByTestId("ent-seats")).toHaveText("500+");
    await expect(page.getByTestId("ent-tier-500")).toHaveAttribute("aria-current", "true");
    await expect(page.getByTestId("ent-custom-note")).toBeVisible();
    await page.getByTestId("ent-slider").focus();
    await page.keyboard.press("Home");
    await expect(page.getByTestId("ent-seats")).toHaveText("1");
    await expect(page.getByTestId("ent-tier-0")).toHaveAttribute("aria-current", "true");
  });

  test("team size input is defensive: empty, junk, decimals, negatives, huge, pasted", async ({ page }) => {
    await page.goto("/enterprise");
    const msg = page.getByTestId("ent-seats-msg");
    await seats(page, "40");
    await seats(page, "");
    await expect(msg).toContainText(/whole number/i);
    await expect(page.getByTestId("ent-seats")).toHaveText("40"); // keeps the last valid value
    await seats(page, "abc");
    await expect(msg).toContainText(/digits only/i);
    await expect(page.getByTestId("ent-seats-input")).toHaveAttribute("aria-invalid", "true");
    await seats(page, "-3");
    await expect(msg).toContainText(/starts at 1/i);
    await expect(page.getByTestId("ent-seats")).toHaveText("1");
    await seats(page, "12.6");
    await expect(msg).toContainText(/rounded to 13/i);
    await expect(page.getByTestId("ent-seats")).toHaveText("13");
    await seats(page, "99999");
    await expect(msg).toContainText(/5,000/);
    await expect(page.getByTestId("ent-seats")).toHaveText("5000+");
    await seats(page, " 1,250 ");
    await expect(page.getByTestId("ent-seats")).toHaveText("1250+");
    await page.getByTestId("ent-seats-input").blur();
    await expect(page.getByTestId("ent-seats-input")).toHaveValue("1250");
    await seats(page, "abc");
    await page.getByTestId("ent-seats-input").blur();
    await expect(page.getByTestId("ent-seats-input")).toHaveValue("1250");
  });

  test("credits override shows headroom and shortfall; cover-with-add-ons fixes it", async ({ page }) => {
    await page.goto("/enterprise");
    await seats(page, "10");
    await page.getByTestId("ent-credits-slider").focus();
    await page.keyboard.press("End");
    await expect(page.getByTestId("ent-headroom")).toContainText(/shortfall/i);
    await page.getByTestId("ent-cover").click();
    await expect(page.getByTestId("ent-headroom")).not.toContainText(/shortfall/i);
    await page.getByTestId("ent-credits-reset").click();
    await expect(page.getByTestId("ent-headroom")).toContainText(/no spare|headroom/i);
  });

  test("configuration is restored from and written to the URL", async ({ page }) => {
    await page.goto("/enterprise?seats=120&billing=annual&addons=5k:2,20k:1");
    await expect(page.getByTestId("ent-seats")).toHaveText("120");
    await expect(page.getByTestId("ent-billing-annual")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("ent-addon-5k")).toHaveText("2");
    await expect(page.getByTestId("ent-addon-20k")).toHaveText("1");
    await expectMatches(page, { seats: 120, billing: "annual", addons: { "5k": 2, "20k": 1 } });
    await expect(page.getByTestId("quote-teamSize")).toHaveValue("120");
    await page.getByTestId("ent-preset-25").click();
    await page.getByTestId("ent-billing-monthly").click();
    await expect.poll(() => new URL(page.url()).searchParams.get("seats")).toBe("25");
    expect(new URL(page.url()).searchParams.get("billing")).toBe("monthly");
    expect(new URL(page.url()).searchParams.get("addons")).toBe("5k:2,20k:1");
    await page.reload();
    await expect(page.getByTestId("ent-seats")).toHaveText("25");
    await expect(page.getByTestId("ent-billing-monthly")).toHaveAttribute("aria-pressed", "true");
  });

  test("garbage URL parameters fall back safely", async ({ page, errors }) => {
    await page.goto("/enterprise?seats=%3Cscript%3E&billing=weekly&addons=zzz:9,5k:-1&credits=NaN");
    await expect(page.getByTestId("ent-seats")).toHaveText("25");
    await expect(page.getByTestId("ent-billing-monthly")).toHaveAttribute("aria-pressed", "true");
    await page.goto("/enterprise?seats=99999&addons=5k:999");
    await expect(page.getByTestId("ent-seats")).toHaveText("5000+");
    await expect(page.getByTestId("ent-addon-5k")).toHaveText("50");
    expect(errors).toEqual([]);
  });

  test("copy summary and link", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
    await page.goto("/enterprise?seats=50");
    await page.getByTestId("ent-copy").click();
    await expect(page.getByTestId("ent-copy-status")).toContainText(/copied|blocked/i);
    const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
    if (clip) expect(clip).toMatch(/Seats: 50/);
    await page.getByTestId("ent-copy-link").click();
    await expect(page.getByTestId("ent-copy-status")).toContainText(/link|blocked/i);
  });

  test("quote form: accessible validation, error summary focus, inline messages", async ({ page }) => {
    await page.goto("/enterprise");
    await page.getByTestId("quote-submit").click();
    const sum = page.getByTestId("quote-error-summary");
    await expect(sum).toBeFocused();
    await expect(sum).toContainText(/fix 4 fields/i);
    for (const k of ["name", "email", "company", "useCase"] as const) await expect(page.getByTestId(`quote-err-${k === "useCase" ? "useCaseKind" : k}`)).toBeVisible();
    await expect(page.getByTestId("quote-name")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByTestId("quote-name")).toHaveAttribute("aria-describedby", /quote-f-name-err/);
    await page.getByTestId("quote-name").fill("Ada Lovelace");
    await expect(page.getByTestId("quote-err-name")).toHaveCount(0);
    await page.getByTestId("quote-email").fill("not-an-email");
    await page.getByTestId("quote-company").fill("E2E Co");
    await page.getByTestId("quote-useCase").selectOption("other");
    await page.getByTestId("quote-teamSize").fill("0");
    await page.getByTestId("quote-credits").fill("-5");
    await page.getByTestId("quote-submit").click();
    await expect(page.getByTestId("quote-err-email")).toContainText(/valid email/i);
    await expect(page.getByTestId("quote-err-teamSize")).toBeVisible();
    await expect(page.getByTestId("quote-err-credits")).toBeVisible();
    await expect(page.getByTestId("quote-err-useCaseOther")).toBeVisible();
    await page.getByTestId("quote-message").fill("x".repeat(1200));
    await expect(page.getByTestId("quote-counter")).toHaveText("1,000 / 1,000");
    // free mail is accepted with a soft hint only
    await page.getByTestId("quote-email").fill("ada@gmail.com");
    await expect(page.locator("#quote-f-email-hint")).toContainText(/work email helps/i);
  });

  test("quote form submits to the real local database and says it was stored", async ({ page }) => {
    const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e-enterprise.example`;
    await page.goto("/enterprise?seats=40&billing=annual&addons=5k:1");
    await page.getByTestId("quote-name").fill("Ada Lovelace");
    await page.getByTestId("quote-email").fill(email);
    await page.getByTestId("quote-company").fill("E2E Studio");
    await page.getByTestId("quote-useCase").selectOption("agency");
    await page.getByTestId("quote-message").fill("We run campaigns for several brands.");
    await expect(page.getByTestId("quote-config")).toContainText("40");
    await expect(page.getByTestId("quote-config")).toContainText("Annual");
    await page.getByTestId("quote-submit").click();
    const ok = page.getByTestId("quote-success");
    await expect(ok).toBeVisible();
    await expect(ok).toHaveAttribute("data-stored", "true");
    await expect(ok).toContainText(/does not send email/i);
    const ref = await text(page, "quote-reference");
    expect(ref).toMatch(/^Q-[0-9A-F]{8}$/);
    const sql = postgres(DB_URL, { max: 1, onnotice: () => {} });
    try {
      const rows = await sql`select team_size, billing_cycle, kind, use_case, message, config from quotes where email = ${email}`;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ team_size: 40, billing_cycle: "annual", kind: "quote", use_case: "Creative agency" });
      expect(rows[0].config.addons).toEqual({ "5k": 1 });
      await sql`delete from quotes where email = ${email}`;
    } finally {
      await sql.end({ timeout: 2 });
    }
  });

  test("no-database response is reported as not stored, never as submitted", async ({ page }) => {
    await page.route("**/api/quote", (r) => r.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ reference: "Q-DEMO-ABC123", stored: false, demo: true, kind: "quote" }) }));
    await page.goto("/enterprise");
    await page.getByTestId("quote-name").fill("Ada Lovelace");
    await page.getByTestId("quote-email").fill("ada@studio.co");
    await page.getByTestId("quote-company").fill("Studio");
    await page.getByTestId("quote-useCase").selectOption("brand");
    await page.getByTestId("quote-submit").click();
    const ok = page.getByTestId("quote-success");
    await expect(ok).toHaveAttribute("data-stored", "false");
    await expect(ok).toContainText(/not stored/i);
    await expect(ok).toContainText(/not saved, emailed or forwarded/i);
    await expect(ok).not.toContainText(/request saved|received/i);
  });

  test("server error and rate limit show a retry path", async ({ page }) => {
    let n = 0;
    await page.route("**/api/quote", (r) => {
      n++;
      if (n === 1) return r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Could not save your request. Please try again." }) });
      if (n === 2) return r.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "Too many", retryAfter: 120 }) });
      return r.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ reference: "Q-DEMO-RETRY1", stored: false, demo: true }) });
    });
    await page.goto("/enterprise");
    await page.getByTestId("quote-name").fill("Ada Lovelace");
    await page.getByTestId("quote-email").fill("ada@studio.co");
    await page.getByTestId("quote-company").fill("Studio");
    await page.getByTestId("quote-useCase").selectOption("studio");
    await page.getByTestId("quote-submit").click();
    await expect(page.getByTestId("quote-fail")).toContainText(/could not save/i);
    await expect(page.getByTestId("quote-submit")).toHaveText("Try again");
    await page.getByTestId("quote-submit").click();
    await expect(page.getByTestId("quote-fail")).toContainText(/too many/i);
    await page.getByTestId("quote-submit").click();
    await expect(page.getByTestId("quote-success")).toBeVisible();
    // a network failure is reported too
    await page.getByRole("button", { name: "Send another" }).click();
    await page.route("**/api/quote", (r) => r.abort());
    await page.getByTestId("quote-submit").click();
    await expect(page.getByTestId("quote-fail")).toContainText(/could not reach/i);
  });

  test("book a demo: dialog, validation, real submit, honest labelling", async ({ page }) => {
    const email = `demo-${Date.now()}@e2e-enterprise.example`;
    await page.goto("/enterprise");
    await page.getByTestId("demo-open").click();
    const d = page.getByTestId("demo-dialog");
    await expect(d).toBeVisible();
    await expect(d).toContainText(/no calendar is connected/i);
    await page.getByTestId("demo-submit").click();
    await expect(page.getByTestId("demo-error-summary")).toBeFocused();
    await expect(page.getByTestId("demo-err-window")).toBeVisible();
    await page.getByTestId("demo-name").fill("Dee Mo");
    await page.getByTestId("demo-email").fill(email);
    await page.getByTestId("demo-company").fill("E2E Demo Co");
    await page.getByTestId("demo-window").selectOption("weekday-afternoon");
    await page.getByTestId("demo-submit").click();
    const ok = page.getByTestId("demo-success");
    await expect(ok).toBeVisible();
    await expect(ok).toHaveAttribute("data-stored", "true");
    expect(await text(page, "demo-reference")).toMatch(/^D-[0-9A-F]{8}$/);
    await expect(ok).toContainText(/no calendar is connected/i);
    const sql = postgres(DB_URL, { max: 1, onnotice: () => {} });
    try {
      const rows = await sql`select kind, config from quotes where email = ${email}`;
      expect(rows[0].kind).toBe("demo");
      expect(rows[0].config.demo.window).toBe("weekday-afternoon");
      await sql`delete from quotes where email = ${email}`;
    } finally {
      await sql.end({ timeout: 2 });
    }
    await page.getByTestId("demo-close").click();
    await expect(d).toBeHidden();
    await expect(page.getByTestId("demo-open")).toBeFocused();
  });

  test("FAQ is keyboard accessible", async ({ page }) => {
    await page.goto("/enterprise");
    const b0 = page.getByTestId("ent-faq-0");
    await b0.scrollIntoViewIfNeeded();
    await expect(b0).toHaveAttribute("aria-expanded", "true");
    await b0.focus();
    await page.keyboard.press("Enter");
    await expect(b0).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("ent-faq-panel-0")).toBeHidden();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("ent-faq-1")).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.getByTestId("ent-faq-1")).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("ent-faq-panel-1")).toBeVisible();
    await page.keyboard.press("End");
    await expect(page.getByTestId("ent-faq-7")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("ent-faq-0")).toBeFocused();
    expect(await page.getByRole("button", { name: /^Is billing live/ }).count()).toBe(1);
  });

  test("anchor navigation scrolls, highlights the active section and updates the hash", async ({ page }) => {
    await page.goto("/enterprise");
    await expect(page.getByTestId("ent-nav-overview")).toHaveAttribute("aria-current", "location");
    for (const id of ["calculator", "compare", "quote", "faq"]) {
      await page.getByTestId(`ent-nav-${id}`).click();
      await expect(page.getByTestId(`ent-nav-${id}`)).toHaveAttribute("aria-current", "location", { timeout: 5000 });
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      // smooth scrolling is still animating when aria-current flips, so wait for it to settle
      await expect
        .poll(
          () =>
            page.evaluate((i) => {
              const top = document.getElementById(i)!.getBoundingClientRect().top;
              // the last sections cannot scroll to the top when the page ends first
              const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
              return top > -5 && (top < 300 || atBottom);
            }, id),
          { timeout: 5000 },
        )
        .toBe(true);
    }
    // sticky: the nav stays on screen
    const box = await page.getByRole("navigation", { name: "On this page" }).boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeLessThan(120);
  });

  test("comparison table (wide) and stacked cards (narrow) show the same features", async ({ page }) => {
    await page.goto("/enterprise");
    const wide = (page.viewportSize()?.width ?? 0) >= 768;
    if (wide) {
      await expect(page.getByTestId("ent-compare")).toBeVisible();
      await expect(page.getByTestId("ent-compare-stacked")).toBeHidden();
      await expect(page.getByTestId("ent-compare").locator("tbody tr")).toHaveCount(6);
    } else {
      await expect(page.getByTestId("ent-compare-stacked")).toBeVisible();
      await expect(page.getByTestId("ent-compare")).toBeHidden();
      await expect(page.getByTestId("ent-compare-stacked").locator("li")).toHaveCount(6);
    }
    await expect(page.locator("#compare")).toContainText(/SSO/);
    await expect(page.locator("#compare")).toContainText(/on request, needs configuration/i);
  });

  for (const width of [280, 390, 820, 1440, 2560]) {
    test(`no horizontal overflow at ${width}px (light and dark)`, async ({ page, errors }) => {
      for (const theme of ["dark", "light"]) {
        await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
        await page.setViewportSize({ width, height: width < 500 ? 800 : 1000 });
        await page.goto("/enterprise?seats=250&billing=annual&addons=5k:2,20k:1,100k:1");
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const bad = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          const out: string[] = [];
          if (document.documentElement.scrollWidth > vw + 1) out.push(`doc scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
          for (const el of document.querySelectorAll<HTMLElement>("main *")) {
            if (el.closest("[data-qa-scroll]") || el.closest("ul.scrollbar-none") || el.closest("[aria-hidden=true]") || el.closest("dialog")) continue;
            const r = el.getBoundingClientRect();
            if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) out.push(`${el.tagName}.${String(el.className).slice(0, 40)} [${Math.round(r.left)},${Math.round(r.right)}]`);
          }
          return out.slice(0, 8);
        });
        expect(bad, `${theme} @${width}`).toEqual([]);
        // the demo dialog fits too
        await page.getByTestId("demo-open").click();
        const r = await page.getByTestId("demo-dialog").boundingBox();
        expect(r!.x).toBeGreaterThanOrEqual(0);
        expect(r!.x + r!.width).toBeLessThanOrEqual(width + 1);
        await page.keyboard.press("Escape");
        if (SHOTS) {
          for (const id of ["overview", "benefits", "calculator", "compare", "summary", "quote", "faq"]) {
            await page.locator(`#${id}`).scrollIntoViewIfNeeded();
            await page.waitForTimeout(900);
          }
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(500);
          await page.screenshot({ path: `${SHOTS}/ent-${width}-${theme}.png`, fullPage: true });
        }
      }
      expect(errors).toEqual([]);
    });
  }

  test("reduced motion: content is visible without scroll reveals", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/enterprise");
    const hidden = await page.evaluate(() => document.querySelectorAll("[data-rv=hide]").length);
    expect(hidden).toBe(0);
  });

  test("tab order reaches the main controls and every control has an accessible name", async ({ page }) => {
    await page.goto("/enterprise");
    const unnamed = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>("main button, main a[href], main input:not([tabindex='-1']), main select, main textarea")) {
        if (el.closest("[aria-hidden=true]")) continue;
        const name = (el.getAttribute("aria-label") || el.innerText || (el as HTMLInputElement).labels?.[0]?.innerText || el.getAttribute("aria-labelledby") || "").trim();
        if (!name) out.push(`${el.tagName} ${el.id || el.getAttribute("data-testid")}`);
      }
      return out;
    });
    expect(unnamed).toEqual([]);
    void tid;
  });
});
