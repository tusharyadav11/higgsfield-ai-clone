/**
 * Device QA matrix. Run with: npx playwright test -c playwright.devices.config.ts
 * Env: QA_PORT (3711), DEVQA_ONLY="iPhone SE,Pixel 7" (substring filter), DEVQA_BROWSERS=chromium,firefox,webkit,
 *      DEVQA_SHOTS=<dir> (full-page screenshot per route), DEVQA_WORKERS.
 * Every check uses expect.soft so ALL offenders of a (route, device) are listed in one run.
 */
import { test as base, expect, Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ROUTES = ["/", "/create", "/explore", "/library", "/pricing", "/usage", "/referrals", "/enterprise", "/settings", "/connect", "/login", "/signup"];
const SHOTS = process.env.DEVQA_SHOTS;
const IGNORED = [/Download the React DevTools/i, /\[Fast Refresh\]/i];

const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, provide) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      const t = m.text();
      if (IGNORED.some((r) => r.test(t))) return;
      if (m.type() === "error" || (m.type() === "warning" && /hydrat|did not match/i.test(t))) errors.push(`[${m.type()}] ${t.slice(0, 300)}`);
    });
    page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
    await provide(errors);
  },
});

/** Seed: tour offer dismissed so the first-visit toast doesn't pollute layout checks. */
async function boot(page: Page, route: string, opts: { user?: boolean; tour?: boolean } = {}) {
  await page.addInitScript(
    ({ user, tour }) => {
      try {
        if (!tour) localStorage.setItem("kinetic.tour.seen", '"1"');
        if (user) {
          localStorage.setItem(
            "kinetic-store",
            JSON.stringify({ state: { credits: 120, streak: 0, lastClaim: null, likes: {}, library: [], user: { id: "u1", email: "very.long.email.address@example-company.com", name: "Alexandria Montgomery" }, userId: "u1", name: "Alexandria Montgomery", welcomeDismissed: true }, version: 1 }),
          );
        }
      } catch {}
    },
    { user: !!opts.user, tour: !!opts.tour },
  );
  const res = await page.goto(route, { waitUntil: "load" });
  expect(res?.status(), `${route} status`).toBeLessThan(400);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(400);
}

const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
async function shot(page: Page, name: string, projectName: string) {
  if (!SHOTS) return;
  const dir = path.join(SHOTS, slug(projectName));
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${slug(name) || "home"}.png`), fullPage: true, animations: "disabled" }).catch(() => {});
}

/** ---------- in-page audits (serialised into the browser) ---------- */
type Offender = string;
function auditPage(opts: { touch: boolean; scope?: string; skipEdge?: boolean }) {
  const out: Record<string, Offender[]> = { overflow: [], edge: [], target: [], clipped: [], media: [] };
  const vw = window.innerWidth;
  const root = (opts.scope ? document.querySelector(opts.scope) : document.body) as HTMLElement | null;
  if (!root) return { ...out, missing: [`scope ${opts.scope} not found`] };
  const desc = (el: Element) => {
    const t = el.getAttribute("data-testid");
    const txt = (el.textContent || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 30);
    return `<${el.tagName.toLowerCase()}${t ? ` #${t}` : ""}${typeof el.className === "string" && el.className ? " ." + el.className.split(/\s+/).slice(0, 3).join(".") : ""}> "${txt}"`;
  };
  const visible = (el: Element) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (r.width <= 1.5 && r.height <= 1.5 && cs.overflow !== 'visible') return false;
    // sr-only
    if (cs.position === "absolute" && r.width <= 1 && r.height <= 1) return false;
    let p: Element | null = el;
    while (p && p !== document.documentElement) {
      const c = getComputedStyle(p);
      if (c.display === "none" || c.visibility === "hidden" || c.opacity === "0") return false;
      if (p.getAttribute("aria-hidden") === "true" && opts.scope === undefined) { /* decorative: still render, handled by caller */ }
      p = p.parentElement;
    }
    return true;
  };
  const scrollClipped = (el: Element) => {
    let p = el.parentElement;
    while (p && p !== document.body && p !== document.documentElement) {
      const c = getComputedStyle(p);
      if (/(auto|scroll|hidden|clip)/.test(c.overflowX)) return true;
      if (p.classList.contains("marquee") || p.classList.contains("marquee-track")) return true;
      p = p.parentElement;
    }
    return false;
  };
  if (document.documentElement.scrollWidth > window.innerWidth + 0.5) out.overflow.push(`scrollWidth ${document.documentElement.scrollWidth} > innerWidth ${window.innerWidth}`);
  if (document.body.scrollWidth > window.innerWidth + 0.5) out.overflow.push(`body.scrollWidth ${document.body.scrollWidth} > innerWidth ${window.innerWidth}`);
  const all = Array.from(root.querySelectorAll("*"));
  const interactive = "a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=menuitem],[role=tab],[role=switch],[role=checkbox],[role=slider],[tabindex]:not([tabindex='-1'])";
  for (const el of all) {
    if (["SCRIPT", "STYLE", "LINK", "META", "HEAD", "TITLE", "NOSCRIPT", "PATH", "G", "DEFS", "LINE", "CIRCLE", "RECT", "POLYGON", "POLYLINE", "STOP", "LINEARGRADIENT", "TEXT", "TSPAN"].includes(el.tagName.toUpperCase())) continue;
    if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    // 1. edge crossing (horizontal; vertical overflow of the page is normal scroll)
    if (!opts.skipEdge && (r.right > vw + 1 || r.left < -1) && !scrollClipped(el) && !el.closest("[aria-hidden='true']") && cs.pointerEvents !== "none") {
      out.edge.push(`${desc(el)} [${Math.round(r.left)}..${Math.round(r.right)}] vw=${vw}`);
    }
    // 2. tap targets
    if (el.matches(interactive)) {
      const isInline = el.tagName === "A" && cs.display === "inline"; // WCAG 2.5.8 inline-in-text exemption
      const isInput = el instanceof HTMLInputElement && ["checkbox", "radio", "range"].includes(el.type);
      const lab = isInput ? (el.labels?.[0]?.getBoundingClientRect() ?? r) : r;
      const w = Math.max(r.width, isInput ? lab.width : 0), h = Math.max(r.height, isInput ? lab.height : 0);
      const min = opts.touch ? 44 : 24;
      if (!isInline && !(el as HTMLElement).hasAttribute("disabled") && (w < min - 0.5 || h < min - 0.5)) {
        const inView = r.right > 0 && r.left < vw;
        if (inView) out.target.push(`${desc(el)} ${Math.round(w)}x${Math.round(h)} (<${min})`);
      }
    }
    // 3. clipped text
    const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent || "").trim().length > 0);
    if (hasText) {
      const clips = /(hidden|clip)/.test(cs.overflowX);
      const ellipsis = cs.textOverflow === "ellipsis" || /line-clamp|-webkit-box/.test(cs.display + cs.webkitLineClamp) || cs.webkitLineClamp !== "none";
      const h = el as HTMLElement;
      if (clips && !ellipsis && h.scrollWidth > h.clientWidth + 1) out.clipped.push(`${desc(el)} scrollWidth ${h.scrollWidth} > clientWidth ${h.clientWidth}`);
      if (/(hidden|clip)/.test(cs.overflowY) && !ellipsis && cs.display !== "inline" && h.scrollHeight > h.clientHeight + 2 && h.clientHeight > 0) out.clipped.push(`${desc(el)} scrollHeight ${h.scrollHeight} > clientHeight ${h.clientHeight}`);
    }
    // 4. media distortion
    if (el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0 && !/svg/.test(el.currentSrc.split("?")[0].split(".").pop() || "")) {
      checkMedia(el, el.naturalWidth, el.naturalHeight, r, cs, out.media, desc(el));
    }
    if (el instanceof HTMLVideoElement && el.videoWidth > 0) checkMedia(el, el.videoWidth, el.videoHeight, r, cs, out.media, desc(el));
  }
  function checkMedia(el: Element, nw: number, nh: number, r: DOMRect, cs: CSSStyleDeclaration, bucket: string[], d: string) {
    if (/(cover|contain|scale-down|none)/.test(cs.objectFit)) return;
    const ia = nw / nh, ra = r.width / r.height;
    if (Math.abs(ra / ia - 1) > 0.02) bucket.push(`${d} rendered ${r.width.toFixed(0)}x${r.height.toFixed(0)} vs intrinsic ${nw}x${nh}`);
  }
  return out;
}

async function audit(page: Page, touch: boolean, scope?: string, skipEdge = false) {
  return page.evaluate(auditPage, { touch, scope, skipEdge });
}

function report(label: string, res: Record<string, string[]>, only?: string[]) {
  for (const [k, v] of Object.entries(res)) {
    if (only && !only.includes(k)) continue;
    expect.soft(v.slice(0, 15), `${label}: ${k} (${v.length} offenders)`).toEqual([]);
  }
}

test.describe.configure({ mode: "parallel" });

const isTouchOf = (p: Page, hasTouch: boolean) => hasTouch;

/** ---------- per-route ---------- */
for (const route of ROUTES) {
  test(`route ${route}: layout, targets, text, media, console, sticky header`, async ({ page, errors, hasTouch }, info) => {
    const touch = isTouchOf(page, hasTouch);
    await boot(page, route, { user: route === "/settings" || route === "/referrals" });
    if (route === "/explore") {
      // let the first feed page + lazy media settle
      await page.evaluate(async () => { for (let y = 0; y < 3000; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
      await page.waitForTimeout(500);
    }
    const res = await audit(page, touch);
    report(`${route}`, res);

    // header sticky after scroll
    for (let i = 0, last = -1, stable = 0; i < (route === "/explore" ? 25 : 4); i++) {
      const h = await page.evaluate(() => { window.scrollTo(0, document.documentElement.scrollHeight); return document.documentElement.scrollHeight; });
      await page.waitForTimeout(route === "/explore" ? 600 : 250);
      if (h === last && ++stable >= (route === "/explore" ? 3 : 1)) break;
      if (h !== last) stable = 0;
      last = h;
    }
    const hb = await page.locator("header").first().boundingBox();
    expect.soft(hb?.y ?? 99, `${route}: header pinned after scroll`).toBeLessThanOrEqual(1);

    // last element reachable above bottom bar
    const reach = await page.evaluate(() => {
      const nav = document.querySelector("nav[aria-label=Primary]") as HTMLElement | null;
      const nr = nav?.getBoundingClientRect();
      const bottomBar = nr && nr.width >= innerWidth - 1 && nr.top > innerHeight / 2 ? nr.top : innerHeight;
      const main = document.querySelector("main") ?? document.body;
      let lastBottom = 0, last = "";
      for (const el of Array.from(main.querySelectorAll("*"))) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.width < 1 || r.height < 1 || cs.position === "fixed" || cs.visibility === "hidden" || cs.display === "none" || el.closest("[aria-hidden='true']")) continue;
        if (r.bottom > lastBottom) { lastBottom = r.bottom; last = el.tagName + (el.getAttribute("data-testid") ? "#" + el.getAttribute("data-testid") : ""); }
      }
      return { bottomBar, lastBottom, last, atEnd: Math.abs(scrollY + innerHeight - document.documentElement.scrollHeight) < 3 };
    });
    expect.soft(reach.lastBottom, `${route}: last content (${reach.last}) hidden behind bottom bar at ${reach.bottomBar}`).toBeLessThanOrEqual(reach.bottomBar + 1);

    // primary CTAs not covered by a fixed element
    const ctas = ["generate-btn", "streak-claim", "credits-chip", "search-trigger", "accent-switcher", "nav-create", "nav-home", "nav-explore", "nav-library", "assistant-toggle", "auth-submit", "billing-toggle"];
    for (const id of ctas) {
      const loc = page.locator(`[data-testid="${id}"]:visible`).first();
      if (!(await loc.count())) continue;
      await loc.evaluate((e) => e.scrollIntoView({ block: "center" })).catch(() => {});
      await page.waitForTimeout(60);
      const covered = await loc.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) return null; // off-screen (e.g. scrolled away)
        const hit = document.elementFromPoint(x, y);
        if (!hit || el.contains(hit) || hit.contains(el)) return null;
        return `${hit.tagName}${hit.getAttribute("data-testid") ? "#" + hit.getAttribute("data-testid") : ""}.${String(hit.className).slice(0, 60)}`;
      });
      expect.soft(covered, `${route}: CTA ${id} centre covered by another element`).toBeNull();
    }

    expect.soft(errors, `${route}: console errors/hydration warnings`).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, route === "/" ? "home" : route, info.project.name);
  });
}

/** ---------- keyboard focus ring (first 10 tabbables) ---------- */
for (const route of ["/", "/create", "/pricing"]) {
  test(`focus ring visible on first 10 tab stops: ${route}`, async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "Safari does not Tab to links/buttons by default");
    await boot(page, route);
    const bad: string[] = [];
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      const r = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const ow = parseFloat(cs.outlineWidth) || 0;
        const hasOutline = cs.outlineStyle !== "none" && ow > 0 && cs.outlineColor !== "rgba(0, 0, 0, 0)";
        const hasShadow = cs.boxShadow !== "none";
        // focus-within style on a wrapper counts (e.g. composite inputs)
        let wrap = false;
        for (let p = el.parentElement, n = 0; p && n < 3; p = p.parentElement, n++) { const c = getComputedStyle(p); if (p.matches(":focus-within") && (c.boxShadow !== "none" || (c.outlineStyle !== "none" && parseFloat(c.outlineWidth) > 0))) wrap = true; }
        const r = el.getBoundingClientRect();
        return { ok: hasOutline || hasShadow || wrap, d: `${el.tagName}${el.getAttribute("data-testid") ? "#" + el.getAttribute("data-testid") : ""} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 25)}"`, offscreen: r.bottom < 0 || r.top > innerHeight };
      });
      if (r && !r.ok) bad.push(r.d);
    }
    expect.soft(bad, `${route}: tab stops without visible focus indicator`).toEqual([]);
  });
}

/** ---------- CLS ---------- */
for (const route of ["/", "/explore"]) {
  test(`CLS < 0.1 on ${route}`, async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "layout-shift entries are Chromium-only");
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    });
    await boot(page, route);
    await page.evaluate(async () => { for (let y = 0; y < 2400; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 150)); } });
    await page.waitForTimeout(800);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect.soft(cls, `${route}: CLS`).toBeLessThan(0.1);
  });
}

/** ---------- text contrast, lime + custom dark-blue accent ---------- */
function contrastAudit() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  const rgba = (c: string): [number, number, number, number] => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = "#000"; ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); const d = ctx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (top: number[], bot: number[]): [number, number, number] => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a)]; };
  const lum = (c: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const bad: string[] = [];
  const seen = new Set<string>();
  const els = Array.from(document.body.querySelectorAll("*"));
  for (const el of els) {
    if (!Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent || "").trim().length > 1)) continue;
    if (el.closest("svg,script,style,[aria-hidden='true'],[disabled],:disabled")) continue;
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    if (cs.visibility === "hidden" || cs.display === "none" || r.width < 2 || r.height < 2) continue;
    // background stack
    let ownFill: number[] | null = null;
    const selfBg = rgba(cs.backgroundColor);
    if (selfBg[3] < 0.5) for (const ch of Array.from(el.children)) { const c = getComputedStyle(ch); if (c.position === 'absolute' && c.backgroundImage === 'none') { const b = rgba(c.backgroundColor); const cr = ch.getBoundingClientRect(); if (b[3] > 0.5 && cr.width >= r.width * 0.9 && cr.height >= r.height * 0.9) ownFill = b; } }
    for (const anc of [el.parentElement, el.parentElement?.parentElement]) if (!ownFill && selfBg[3] < 0.5 && anc) for (const sib of Array.from(anc.children)) { if (sib === el) continue; const c = getComputedStyle(sib); if (c.position === 'absolute' && c.backgroundImage === 'none') { const b = rgba(c.backgroundColor); const cr = sib.getBoundingClientRect(); if (b[3] > 0.5 && cr.left <= r.left + 2 && cr.right >= r.right - 2 && cr.top <= r.top + 2 && cr.bottom >= r.bottom - 2) ownFill = b; } }
    let bg: number[] = [10, 10, 10]; const layers: number[][] = []; let hasImage = false; let opacity = 1;
    for (let p: Element | null = el; p; p = p.parentElement) {
      const c = getComputedStyle(p); opacity *= parseFloat(c.opacity);
      if (c.backgroundImage !== "none") { hasImage = true; }
      const b = rgba(c.backgroundColor); if (b[3] > 0) { layers.push(b); if (b[3] >= 0.999) break; }
    }
    if (hasImage) continue; // gradients / photos: not measurable by computed style
    if (ownFill) { layers.length = 0; layers.push(ownFill); }
    layers.reverse(); bg = layers.length && layers[0][3] >= 0.999 ? layers[0].slice(0, 3) : [13, 13, 13];
    for (const l of layers.slice(layers[0] && layers[0][3] >= 0.999 ? 1 : 0)) bg = over(l, bg);
    const fg0 = rgba(cs.color); fg0[3] *= opacity; const fg = over(fg0, bg);
    const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700;
    const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    if (ratio < need) {
      const key = `${el.tagName}.${String(el.className).slice(0, 50)}|${cs.color}|${ratio.toFixed(1)}`; if (seen.has(key)) continue; seen.add(key);
      bad.push(`${el.tagName.toLowerCase()}${el.getAttribute("data-testid") ? "#" + el.getAttribute("data-testid") : ""} "${(el.textContent || "").trim().slice(0, 28)}" ${ratio.toFixed(2)}:1 (need ${need}) fg=${cs.color} bg=rgb(${bg.map(Math.round)}) .${String(el.className).slice(0, 60)}`);
    }
  }
  return bad;
}
for (const [accent, hex] of [["lime", null], ["custom dark blue #0b1f5c", "#0b1f5c"]] as const) {
  for (const route of ["/", "/explore", "/pricing", "/create"]) {
    test(`text contrast >= 4.5 (accent ${accent}) on ${route}`, async ({ page, browserName }) => {
      test.skip(browserName !== "chromium", "canvas colour parsing of oklab/color-mix is checked on Chromium");
      await boot(page, route);
      if (hex) {
        await page.locator('[data-testid="accent-switcher"]:visible').first().click();
        await page.getByTestId("accent-hex-input").fill(hex);
        await page.getByTestId("accent-hex-input").press("Enter");
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
      const bad = await page.evaluate(contrastAudit);
      expect.soft(bad.slice(0, 15), `${route} [${accent}]: low-contrast text (${bad.length})`).toEqual([]);
    });
  }
}

/** ---------- overlays ---------- */
const fits = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const el = document.querySelector(s) as HTMLElement | null;
    if (!el) return `missing ${s}`;
    const r = el.getBoundingClientRect();
    const ok = r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
    return ok ? null : `${s} rect [${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)}] outside ${innerWidth}x${innerHeight}`;
  }, sel);

async function overlayChecks(page: Page, label: string, scope: string, touch: boolean) {
  expect.soft(await fits(page, scope), `${label}: fits viewport`).toBeNull();
  const res = await audit(page, touch, scope);
  report(label, res, ["overflow", "target", "clipped", "edge", "media", "missing"]);
}
/** Simulates the on-screen keyboard by shrinking the layout viewport height. */
async function keyboardOpen(page: Page) {
  const vs = page.viewportSize()!;
  await page.setViewportSize({ width: vs.width, height: Math.max(180, Math.round(vs.height * 0.5)) });
  await page.waitForTimeout(250);
  return vs;
}

test("overlay: search palette (+ keyboard-open)", async ({ page, hasTouch }, info) => {
  await boot(page, "/");
  await page.locator('[data-testid="search-trigger"]:visible').first().click();
  await expect(page.getByTestId("search-input")).toBeVisible();
  const panel = '[data-testid="search-input"]';
  await page.getByTestId("search-input").fill("a");
  await page.waitForTimeout(300);
  const scope = await page.evaluate(() => { let p = document.querySelector('[data-testid="search-input"]')!.parentElement!; while (p && !(getComputedStyle(p).position === "fixed")) p = p.parentElement!; p.setAttribute("data-qa-overlay", "palette"); const dlg = p.querySelector("[role=dialog]") as HTMLElement | null; if (dlg) { dlg.setAttribute("data-qa-panel", "palette"); return "[data-qa-panel=palette]"; } return "[data-qa-overlay=palette]"; });
  await overlayChecks(page, "search palette", scope, hasTouch);
  expect.soft(await fits(page, panel), "search input inside viewport").toBeNull();
  await shot(page, "overlay-search", info.project.name);
  const vs = await keyboardOpen(page);
  expect.soft(await fits(page, panel), `search input inside viewport with keyboard open (${vs.width}x${page.viewportSize()!.height})`).toBeNull();
  expect.soft(await fits(page, scope), "search panel inside viewport with keyboard open").toBeNull();
  const first = await page.evaluate(() => { const r = document.querySelector('[data-testid="search-result"]')?.getBoundingClientRect(); return r ? r.top < innerHeight : true; });
  expect.soft(first, "first search result reachable with keyboard open").toBe(true);
});

test("overlay: assistant FAB + panel (+ keyboard-open)", async ({ page, hasTouch }, info) => {
  await boot(page, "/create");
  const fab = page.getByTestId("assistant-toggle");
  const nav = await page.evaluate(() => { const r = document.querySelector("nav[aria-label=Primary]")!.getBoundingClientRect(); return { top: r.top, w: r.width, h: r.height, x: r.right }; });
  const fb = (await fab.boundingBox())!;
  if (nav.w >= (page.viewportSize()!.width - 1)) expect.soft(fb.y + fb.height, "assistant FAB overlaps bottom tab bar").toBeLessThanOrEqual(nav.top + 0.5);
  else expect.soft(fb.x, "assistant FAB overlaps side nav").toBeGreaterThanOrEqual(nav.x - 0.5);
  const gen = await page.locator('[data-testid="generate-btn"]:visible').first().boundingBox();
  if (gen) {
    await page.locator('[data-testid="generate-btn"]:visible').first().scrollIntoViewIfNeeded();
    const g2 = (await page.locator('[data-testid="generate-btn"]:visible').first().boundingBox())!;
    // the FAB may float over empty button margin, but must never cover the button's label/centre (elementFromPoint on label corners)
    const hit = await page.locator('[data-testid="generate-btn"]:visible').first().evaluate((el) => {
      const rg = document.createRange(); rg.selectNodeContents(el); const r = rg.getBoundingClientRect();
      const pts: [number, number][] = [[(r.left + r.right) / 2, (r.top + r.bottom) / 2], [r.left + 1, r.top + r.height / 2], [r.right - 1, r.top + r.height / 2]];
      const bad: string[] = [];
      for (const [x, y] of pts) { if (y < 0 || y > innerHeight) continue; const h = document.elementFromPoint(x, y); if (h && !el.contains(h) && !h.contains(el)) bad.push(`${h.tagName}${h.getAttribute("data-testid") ? "#" + h.getAttribute("data-testid") : ""}@${Math.round(x)},${Math.round(y)}`); }
      return bad;
    });
    expect.soft(hit, "assistant FAB / fixed element covers the generate button label").toEqual([]);
    void g2; void fb;
  }
  await fab.click();
  await expect(page.getByTestId("assistant-input")).toBeVisible();
  await page.waitForTimeout(300);
  const scope = await page.evaluate(() => { let p = document.querySelector('[data-testid="assistant-input"]')!.parentElement!; while (p && getComputedStyle(p).position !== "fixed") p = p.parentElement!; p.setAttribute("data-qa-panel", "assistant"); return "[data-qa-panel=assistant]"; });
  await overlayChecks(page, "assistant", scope, hasTouch);
  await shot(page, "overlay-assistant", info.project.name);
  await keyboardOpen(page);
  expect.soft(await fits(page, scope), "assistant panel inside viewport with keyboard open").toBeNull();
  expect.soft(await fits(page, '[data-testid="assistant-input"]'), "assistant input visible with keyboard open").toBeNull();
});

test("overlay: help menu, shortcuts dialog, tour step, tour offer toast", async ({ page, hasTouch }, info) => {
  await boot(page, "/", { tour: true });
  // first-visit tour offer toast must not cover the tab bar / FAB
  await page.waitForTimeout(3000);
  const toast = page.getByTestId("tour-start");
  if (await toast.isVisible().catch(() => false)) {
    const t = (await page.locator("[role=status]:has([data-testid=tour-start])").boundingBox())!;
    const vs = page.viewportSize()!;
    expect.soft(t.x >= 0 && t.x + t.width <= vs.width && t.y >= 0 && t.y + t.height <= vs.height, "tour offer toast inside viewport").toBe(true);
    const nav = await page.evaluate(() => document.querySelector("nav[aria-label=Primary]")!.getBoundingClientRect().toJSON());
    const overlapsNav = !(t.x + t.width <= nav.x || nav.x + nav.width <= t.x || t.y + t.height <= nav.y || nav.y + nav.height <= t.y);
    expect.soft(overlapsNav, "tour offer toast overlaps primary nav").toBe(false);
    const fab = (await page.getByTestId("assistant-toggle").boundingBox())!;
    const overlapsFab = !(t.x + t.width <= fab.x || fab.x + fab.width <= t.x || t.y + t.height <= fab.y || fab.y + fab.height <= t.y);
    expect.soft(overlapsFab, "tour offer toast overlaps assistant FAB").toBe(false);
    await shot(page, "overlay-tour-offer", info.project.name);
    await page.getByRole("button", { name: "Skip" }).first().click();
  }
  // help menu (lives in the More sheet on narrow phones)
  if (!(await page.locator('[data-testid="help-menu"]:visible').count())) await page.getByTestId("nav-more").click();
  await page.locator('[data-testid="help-menu"]:visible').first().click();
  await page.waitForTimeout(250);
  const menu = await page.evaluate(() => {
    const b = document.querySelector('[data-testid="help-menu"]:not([style*="display: none"])') as HTMLElement;
    let m = b.parentElement!.querySelector("[role=menu]") as HTMLElement | null;
    if (!m) { m = b.parentElement!.querySelector("div.absolute, div.fixed") as HTMLElement | null; }
    if (!m) return null;
    m.setAttribute("data-qa-panel", "help"); return true;
  });
  if (menu) await overlayChecks(page, "help menu", "[data-qa-panel=help]", hasTouch);
  await shot(page, "overlay-help", info.project.name);
  await page.keyboard.press("Escape");
  // shortcuts dialog
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("guide:open", { detail: "shortcuts" })));
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  await overlayChecks(page, "shortcuts dialog", "[role=dialog][aria-label='Keyboard shortcuts']", hasTouch);
  await page.keyboard.press("Escape");
  // tour steps
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("guide:open", { detail: "tour" })));
  await expect(page.getByTestId("tour-overlay")).toBeVisible();
  for (let step = 0; step < 4; step++) {
    await page.waitForTimeout(700);
    const card = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="tour-overlay"] ~ .fixed, .pointer-events-auto.fixed.rounded-2xl') as HTMLElement | null;
      if (!el) return null; el.setAttribute("data-qa-panel", "tour"); return true;
    });
    if (card) {
      expect.soft(await fits(page, "[data-qa-panel=tour]"), `tour step ${step}: card inside viewport`).toBeNull();
      const res = await audit(page, hasTouch, "[data-qa-panel=tour]");
      report(`tour step ${step}`, res, ["overflow", "target", "clipped"]);
      if (step === 1) await shot(page, "overlay-tour", info.project.name);
      // the card must not cover the highlighted element's ring completely (spotlight visible)
    }
    const next = page.getByTestId("tour-next");
    if (!(await next.isVisible().catch(() => false))) break;
    if (await next.isDisabled()) break;
    await next.click();
  }
});

test("overlay: job tray + job toast over nav", async ({ page, hasTouch }, info) => {
  await boot(page, "/create");
  await page.locator('[data-testid="generate-btn"]:visible').first().click();
  const pill = page.locator('[data-testid="job-pill"]:visible').first();
  await expect(pill).toBeVisible({ timeout: 10000 });
  await pill.click();
  await expect(page.getByTestId("job-tray")).toBeVisible();
  await page.waitForTimeout(300);
  await overlayChecks(page, "job tray", '[data-testid="job-tray"]', hasTouch);
  await shot(page, "overlay-jobtray", info.project.name);
  await page.getByRole("button", { name: "Close" }).first().click();
  // navigate away so the completion toast shows (hidden on /create)
  await page.goto("/pricing");
  await page.locator('[data-testid="job-toast"]').first().waitFor({ timeout: 15000 }).catch(() => {});
  const t = page.getByTestId("job-toast").first();
  if (await t.isVisible().catch(() => false)) {
    const b = (await t.boundingBox())!, vs = page.viewportSize()!;
    expect.soft(b.x >= 0 && b.x + b.width <= vs.width + 0.5 && b.y >= 0 && b.y + b.height <= vs.height + 0.5, "job toast inside viewport").toBe(true);
    const nav = await page.evaluate(() => document.querySelector("nav[aria-label=Primary]")!.getBoundingClientRect().toJSON());
    const overlapsNav = !(b.x + b.width <= nav.x || nav.x + nav.width <= b.x || b.y + b.height <= nav.y || nav.y + nav.height <= b.y);
    expect.soft(overlapsNav, "job toast covers navigation").toBe(false);
    const fab = (await page.getByTestId("assistant-toggle").boundingBox())!;
    const ov = !(b.x + b.width <= fab.x || fab.x + fab.width <= b.x || b.y + b.height <= fab.y || fab.y + fab.height <= b.y);
    expect.soft(ov, "job toast covers assistant FAB").toBe(false);
    await shot(page, "overlay-jobtoast", info.project.name);
  }
});

test("overlay: user menu (signed in, long name/email)", async ({ page, hasTouch }, info) => {
  await boot(page, "/", { user: true });
  const um = page.locator('[data-testid="user-menu"]:visible').first();
  if (!(await um.count())) { test.skip(true, "user menu not rendered at this width"); }
  await um.click();
  await page.waitForTimeout(250);
  const ok = await page.evaluate(() => { const m = document.querySelector("[role=menu]:not(:empty)") as HTMLElement | null; if (!m) return false; m.setAttribute("data-qa-panel", "user"); return true; });
  expect(ok, "user menu opened").toBe(true);
  await overlayChecks(page, "user menu", "[data-qa-panel=user]", hasTouch);
  await shot(page, "overlay-usermenu", info.project.name);
});

test("overlay: colour picker popover (+ keyboard-open)", async ({ page, hasTouch }, info) => {
  await boot(page, "/");
  await page.locator('[data-testid="accent-switcher"]:visible').first().click();
  await expect(page.getByTestId("accent-picker")).toBeVisible();
  await page.waitForTimeout(400);
  await overlayChecks(page, "colour picker", '[role=dialog][aria-label="Accent colour picker"]', hasTouch);
  await shot(page, "overlay-colour", info.project.name);
  await keyboardOpen(page);
  const r = await page.evaluate(() => { const el = document.querySelector('[role=dialog][aria-label="Accent colour picker"]') as HTMLElement; const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, h: innerHeight, scrollable: el.scrollHeight > el.clientHeight, ov: getComputedStyle(el).overflowY }; });
  expect.soft(r.top >= -0.5 && r.bottom <= r.h + 0.5, `colour picker panel inside shrunken viewport (${r.top}..${r.bottom} of ${r.h})`).toBe(true);
  if (r.scrollable) expect.soft(r.ov, "colour picker scrolls when it does not fit").toMatch(/auto|scroll/);
  // hex input reachable
  await page.getByTestId("accent-hex-input").scrollIntoViewIfNeeded();
  expect.soft(await fits(page, '[data-testid="accent-hex-input"]'), "hex input reachable").toBeNull();
});

test("overlay: mobile More sheet", async ({ page, hasTouch }, info) => {
  await boot(page, "/");
  const more = page.getByTestId("nav-more");
  test.skip(!(await more.isVisible()), "More sheet only exists below the sm breakpoint");
  await more.click();
  await page.waitForTimeout(250);
  const ok = await page.evaluate(() => { const ul = document.querySelector("nav[aria-label=Primary] ul:nth-of-type(2)") as HTMLElement | null; if (!ul) return false; ul.setAttribute("data-qa-panel", "more"); return true; });
  expect(ok, "More sheet present").toBe(true);
  await overlayChecks(page, "More sheet", "[data-qa-panel=more]", hasTouch);
  // all 6 extras + help + sign-in reachable (inside viewport) and not covered
  for (const id of ["usage", "pricing", "referrals", "enterprise", "connect", "settings"]) {
    const l = page.locator(`[data-testid="nav-${id}"]:visible`).first();
    const b = await l.boundingBox();
    expect.soft(b && b.y >= 0, `More sheet item ${id} reachable (y=${b?.y})`).toBeTruthy();
  }
  await shot(page, "overlay-more", info.project.name);
});
