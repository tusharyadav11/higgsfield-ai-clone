import { test, expect, tid, ROUTES, generate } from "./helpers";

test("no horizontal scroll at 320px on every route", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const bad: string[] = [];
  for (const r of [...ROUTES, "/create?prompt=hello&model=x&remix=p1"]) {
    await page.goto(r);
    await page.waitForLoadState("networkidle");
    const m = await page.evaluate(() => ({
      de: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, b: document.body.scrollWidth,
      offenders: [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && getComputedStyle(e).position !== "fixed").slice(0, 3).map((e) => (e as HTMLElement).tagName + "." + String((e as HTMLElement).className).slice(0, 60)),
    }));
    if (m.de > m.cw || m.b > m.cw) bad.push(`${r}: scrollWidth ${m.de}/${m.b} > ${m.cw}; e.g. ${m.offenders.join(" | ")}`);
  }
  expect(bad, bad.join("\n")).toEqual([]);
});

for (const r of ["/", "/explore", "/library", "/create"]) {
  test(`images have dimensions and alt on ${r}`, async ({ page }) => {
    if (r === "/library") { await page.goto("/create"); await generate(page); }
    await page.goto(r);
    await page.waitForLoadState("networkidle");
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll("img")].flatMap((img) => {
        const probs: string[] = [];
        const hasAttr = img.getAttribute("width") && img.getAttribute("height");
        const box = img.getBoundingClientRect();
        const parentBox = img.parentElement!.getBoundingClientRect();
        const cs = getComputedStyle(img);
        const hasAspect = cs.aspectRatio !== "auto";
        const fill = cs.position === "absolute" && parentBox.height > 0 && parentBox.width > 0;
        if (!hasAttr && !hasAspect && !fill) probs.push("no width/height/aspect-ratio/fill-parent");
        if (box.width === 0 && box.height === 0 && img.loading !== "lazy") probs.push("zero-size");
        const alt = img.getAttribute("alt");
        if (alt === null) probs.push("missing alt");
        else if (alt.trim() === "" && img.getAttribute("aria-hidden") !== "true" && img.getAttribute("role") !== "presentation") probs.push("empty alt on non-decorative img");
        return probs.map((p) => `${p}: ${img.currentSrc.slice(0, 60) || img.getAttribute("src")?.slice(0, 60)}`);
      }),
    );
    expect(bad, bad.join("\n")).toEqual([]);
  });
}

test("videos use preload=none, muted, playsInline, poster", async ({ page }) => {
  await page.goto("/explore");
  await page.waitForLoadState("networkidle");
  const bad = await page.evaluate(() =>
    [...document.querySelectorAll("video")].flatMap((v) => {
      const p: string[] = [];
      if (v.getAttribute("preload") !== "none") p.push(`preload=${v.getAttribute("preload")}`);
      if (!v.muted) p.push("not muted");
      if (!v.hasAttribute("playsinline")) p.push("no playsInline");
      if (!v.getAttribute("poster")) p.push("no poster");
      return p;
    }),
  );
  expect(bad, bad.join(", ")).toEqual([]);
});

for (const r of ["/", "/explore"]) {
  test(`cumulative layout shift is low on ${r}`, async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries() as any[]) if (!e.hadRecentInput) (window as any).__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(r);
    await page.waitForLoadState("networkidle");
    for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, 1500); await page.waitForTimeout(300); }
    const cls = await page.evaluate(() => (window as any).__cls);
    expect(cls, `CLS ${cls}`).toBeLessThan(0.1);
  });
}

test("media renders without external network (seed images are local)", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (rq) => {
    const u = new URL(rq.url());
    if (!/^(localhost|127\.0\.0\.1)$/.test(u.hostname) && !/^data:|^blob:/.test(rq.url()) && /image|media/.test(rq.resourceType())) external.push(rq.url());
  });
  await page.goto("/explore");
  await page.waitForLoadState("networkidle");
  expect(external, external.join("\n")).toEqual([]);
});

test("reduced motion does not break pages", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(tid(page, "streak-claim")).toBeVisible();
});

test("document has title, lang, and a main landmark; title not default", async ({ page }) => {
  await page.goto("/");
  expect(await page.title(), "title should not be the create-next-app default").not.toMatch(/create next app/i);
  expect(await page.locator("html").getAttribute("lang")).toBeTruthy();
  await expect(page.locator("main").first()).toBeVisible();
});
