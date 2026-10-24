import { test, expect, tid, credits } from "./helpers";

test("claim streak once; credits increase; second claim blocked; persists", async ({ page, errors }) => {
  await page.goto("/");
  const before = await credits(page);
  const claim = tid(page, "streak-claim");
  await expect(claim).toBeVisible();
  const c0 = Number((await tid(page, "streak-count").innerText()).match(/\d+/)![0]);
  await claim.click();
  await expect.poll(() => credits(page)).toBeGreaterThan(before);
  const after = await credits(page);
  expect(Number((await tid(page, "streak-count").innerText()).match(/\d+/)![0])).toBe(c0 + 1);
  // second attempt cannot add credits
  await claim.click({ force: true, trial: false }).catch(() => {});
  await page.waitForTimeout(400);
  expect(await credits(page), "no double claim").toBe(after);
  await page.reload();
  expect(await credits(page)).toBe(after);
  const btn = tid(page, "streak-claim");
  if (await btn.count()) {
    const disabled = await btn.isDisabled().catch(() => false);
    const txt = (await btn.innerText()).toLowerCase();
    expect(disabled || /claimed|come back|tomorrow/.test(txt), `claim button must show claimed state after reload, got "${txt}"`).toBe(true);
  }
  expect(errors, errors.join("\n")).toEqual([]);
});

test("streak resets when lastClaim older than yesterday (UI reflects store)", async ({ page }) => {
  await page.goto("/");
  await tid(page, "streak-claim").click();
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      try {
        const o = JSON.parse(localStorage.getItem(k)!);
        if (o?.state && "lastClaim" in o.state) {
          o.state.streak = 5;
          o.state.lastClaim = typeof o.state.lastClaim === "number" ? Date.now() - 3 * 86400000 : new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
          localStorage.setItem(k, JSON.stringify(o));
        }
      } catch {}
    }
  });
  await page.reload();
  await tid(page, "streak-claim").click();
  await expect.poll(async () => Number((await tid(page, "streak-count").innerText()).match(/\d+/)![0])).toBe(1);
});
