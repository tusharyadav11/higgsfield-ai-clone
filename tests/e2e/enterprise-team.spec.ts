import { test, expect, tid } from "./helpers";
import type { Page } from "@playwright/test";

const TEAM = "/enterprise/workspace/team";
const USAGE = "/enterprise/workspace/usage";

const rows = (p: Page) => p.locator('[data-testid="member-row"]');
const row = (p: Page, id: string) => p.locator(`[data-testid="member-row"][data-member-id="${id}"]`);
const used = async (p: Page) => Number(await p.getByTestId("seat-used").innerText());
const invite = async (p: Page, emails: string) => {
  await p.getByTestId("invite-email").fill(emails);
  await p.getByTestId("invite-submit").click();
};
const noOverflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.describe("team", () => {
  test("invite -> pending -> resend -> revoke", async ({ page, errors }) => {
    await page.goto(TEAM);
    await expect(rows(page).first()).toBeVisible();
    await expect(page.getByTestId("demo-badge").first()).toBeVisible();
    await expect(page.getByText(/no email is sent/i).first()).toBeVisible();
    const before = await used(page);
    const pendingBefore = await page.getByTestId("invite-row-pending").count();

    await invite(page, "new.person@example.org");
    await expect(page.getByTestId("toast").first()).toContainText(/no email is sent/i);
    await expect(page.getByTestId("invite-row-pending")).toHaveCount(pendingBefore + 1);
    await expect.poll(() => used(page)).toBe(before + 1);
    const created = page.locator('[data-testid="member-row"][data-status="pending"]', { hasText: "new.person@example.org" });
    await expect(created).toBeVisible();

    // duplicates are rejected
    await invite(page, "new.person@example.org");
    await expect(page.getByTestId("invite-error")).toContainText(/already/i);
    await page.getByTestId("invite-email").fill("not-an-email");
    await page.getByTestId("invite-submit").click();
    await expect(page.getByTestId("invite-error")).toContainText(/valid email/i);

    await created.getByRole("button", { name: "Resend" }).click();
    await expect(page.getByTestId("toast").last()).toContainText(/re-recorded/i);

    await created.getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByTestId("confirm-dialog")).toContainText(/no email was ever sent/i);
    await page.getByTestId("confirm-ok").click();
    await expect(created).toHaveCount(0);
    await expect.poll(() => used(page)).toBe(before);
    expect(errors).toEqual([]);
  });

  test("multiple pasted emails, one request", async ({ page }) => {
    await page.goto(TEAM);
    await expect(rows(page).first()).toBeVisible();
    const n = await rows(page).count();
    await invite(page, "a1@example.org, a2@example.org\nA3@example.org");
    await expect(rows(page)).toHaveCount(n + 3);
  });

  test("role change needs confirmation; cancel keeps the role", async ({ page, errors }) => {
    await page.goto(TEAM);
    const sel = page.getByTestId("role-select-m-leo");
    await sel.selectOption("viewer");
    await expect(page.getByTestId("confirm-dialog")).toBeVisible();
    await page.getByTestId("confirm-cancel").click();
    await expect(sel).toHaveValue("editor");
    await sel.selectOption("viewer");
    await page.getByTestId("confirm-ok").click();
    await expect(sel).toHaveValue("viewer");
    // promotion to Admin also confirms; upgrade viewer -> editor does not
    await sel.selectOption("editor");
    await expect(page.getByTestId("confirm-dialog")).toHaveCount(0);
    await expect(sel).toHaveValue("editor");
    await sel.selectOption("admin");
    await expect(page.getByTestId("confirm-dialog")).toContainText(/Admin/);
    await page.getByTestId("confirm-ok").click();
    await expect(sel).toHaveValue("admin");
    // the owner's role is locked
    await expect(page.getByTestId("role-select-m-ava")).toHaveCount(0);
    await expect(page.getByTestId("member-remove-m-ava")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("remove with confirm and undo within 5s", async ({ page }) => {
    await page.goto(TEAM);
    await expect(row(page, "m-zoe")).toBeVisible();
    const before = await used(page);
    await page.getByTestId("member-remove-m-zoe").click();
    await expect(page.getByTestId("confirm-dialog")).toContainText(/demo data|sample data/i);
    await page.getByTestId("confirm-ok").click();
    await expect(row(page, "m-zoe")).toHaveCount(0);
    await expect.poll(() => used(page)).toBe(before - 1);
    await page.getByTestId("undo-btn").click();
    await expect(row(page, "m-zoe")).toBeVisible();
    await expect.poll(() => used(page)).toBe(before);
  });

  test("seat limit error and warning", async ({ page }) => {
    await page.goto(`${TEAM}?demo_seats=10`);
    await expect(page.getByTestId("seat-total")).toHaveText("10");
    await expect(page.getByTestId("team-seat-meter")).toHaveAttribute("data-level", "warn");
    await invite(page, "x1@example.org, x2@example.org");
    await expect(page.getByTestId("invite-error")).toContainText(/seat limit/i);
    await invite(page, "x1@example.org");
    await expect(page.getByTestId("team-seat-meter")).toHaveAttribute("data-level", "full");
    await expect(page.getByTestId("seat-warning")).toBeVisible();
    await invite(page, "x3@example.org");
    await expect(page.getByTestId("invite-error")).toContainText(/seat limit/i);
  });

  test("search, filters and sort", async ({ page }) => {
    await page.goto(TEAM);
    await expect(rows(page).first()).toBeVisible();
    await page.getByTestId("member-search").fill("priya");
    await expect(rows(page)).toHaveCount(1);
    await page.getByTestId("member-search").fill("zzzz");
    await expect(page.getByTestId("team-empty")).toBeVisible();
    await page.getByTestId("member-search").fill("");
    await page.getByTestId("filter-role").selectOption("viewer");
    await expect(rows(page).first()).toBeVisible();
    for (const r of await rows(page).all()) await expect(r).toContainText("Viewer");
    await page.getByTestId("filter-role").selectOption("all");
    await page.getByTestId("filter-status").selectOption("pending");
    await expect(rows(page)).toHaveCount(1);
  });

  test("acting as Viewer is read-only; Admin cannot manage admins", async ({ page }) => {
    await page.goto(TEAM);
    await expect(rows(page).first()).toBeVisible();
    await page.getByTestId("acting-as").selectOption("admin");
    await expect(page.getByTestId("role-select-m-noah")).toHaveCount(0);
    await expect(page.getByTestId("member-remove-m-noah")).toHaveCount(0);
    await expect(page.getByTestId("role-select-m-leo")).toBeVisible();
    await expect(page.getByTestId("transfer-ownership")).toHaveCount(0);
    await page.getByTestId("acting-as").selectOption("viewer");
    await expect(page.getByTestId("invite-readonly")).toBeVisible();
    await expect(page.getByTestId("invite-email")).toHaveCount(0);
    await expect(page.locator('[data-testid^="role-select-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="member-remove-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="invite-revoke-"]')).toHaveCount(0);
    await page.getByTestId("acting-as").selectOption("owner");
    await expect(page.getByTestId("role-select-m-leo")).toBeVisible();
  });

  test("transfer ownership keeps exactly one owner", async ({ page }) => {
    await page.goto(TEAM);
    await page.getByTestId("transfer-ownership").click();
    await page.getByTestId("transfer-select").selectOption("m-noah");
    await page.getByTestId("confirm-ok").click();
    await expect(row(page, "m-noah")).toContainText("Owner");
    await expect(row(page, "m-ava")).toContainText("Admin");
    await expect(page.locator('[data-testid="member-row"]', { hasText: /Owner/ })).toHaveCount(1);
  });

  test("permissions dialog opens and closes with Escape", async ({ page }) => {
    await page.goto(TEAM);
    await page.getByTestId("open-permissions").click();
    await expect(page.getByTestId("permissions-dialog")).toContainText("Transfer ownership");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("permissions-dialog")).toHaveCount(0);
  });

  test("persists in this browser", async ({ page }) => {
    await page.goto(TEAM);
    await invite(page, "persist@example.org");
    await expect(rows(page).filter({ hasText: "persist@example.org" })).toBeVisible();
    await page.reload();
    await expect(rows(page).filter({ hasText: "persist@example.org" })).toBeVisible();
  });
});

test.describe("usage", () => {
  test("ranges switch, chart is keyboard readable, table toggle", async ({ page, errors }) => {
    await page.goto(USAGE);
    await expect(tid(page, "usage-kpi-pool")).toBeVisible();
    await expect(tid(page, "usage-kpi-pool")).toHaveAttribute("data-value", String(25 * 1500));
    const chart = page.getByTestId("usage-chart-ws");
    await expect(chart).toHaveAttribute("data-range", "daily");
    await page.getByTestId("usage-range-weekly").click();
    await expect(chart).toHaveAttribute("data-range", "weekly");
    await page.getByTestId("usage-range-monthly").click();
    await expect(chart).toHaveAttribute("data-range", "monthly");
    await chart.getByRole("group").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByTestId("usage-tooltip")).toBeVisible();
    await page.getByTestId("usage-chart-toggle").click();
    await expect(chart.locator("tbody tr")).toHaveCount(6);
    await page.getByTestId("usage-range-daily").click();
    await page.getByTestId("usage-chart-toggle").click();
    await expect(chart.locator("tbody tr")).toHaveCount(14);
    expect(errors).toEqual([]);
  });

  test("breakdowns reconcile with the range total; history paginates and filters", async ({ page }) => {
    await page.goto(USAGE);
    await expect(page.getByTestId("usage-by-member")).toBeVisible();
    for (const r of ["daily", "weekly", "monthly"]) {
      await page.getByTestId(`usage-range-${r}`).click();
      const total = Number((await page.getByTestId("usage-range-total").innerText()).replace(/\D/g, "").replace(/^$/, "0"));
      const foot = async (id: string) => Number((await page.getByTestId(id).locator("tfoot td").first().innerText()).replace(/[^0-9]/g, ""));
      expect(await foot("usage-by-member")).toBe(total);
      expect(await foot("usage-by-project")).toBe(total);
    }
    await expect(page.getByTestId("usage-history-row")).toHaveCount(10);
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.getByTestId("history-page")).toContainText("Page 2");
    await page.getByTestId("history-tool").selectOption("Video");
    await expect(page.getByTestId("history-page")).toContainText("Page 1");
    for (const r of await page.getByTestId("usage-history-row").all()) await expect(r).toContainText("Video");
    // sort by member name
    await page.getByTestId("usage-by-member").getByRole("button", { name: "Member" }).click();
    const names = await page.getByTestId("usage-by-member-row").locator("td:first-child span.break-words").allInnerTexts();
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  test("export CSV is gated by role", async ({ page }) => {
    await page.goto(USAGE);
    await expect(page.getByTestId("usage-export")).toBeEnabled();
    const dl = page.waitForEvent("download");
    await page.getByTestId("usage-export").click();
    expect((await dl).suggestedFilename()).toMatch(/workspace-usage-demo/);
    await page.goto(TEAM);
    await page.getByTestId("acting-as").selectOption("viewer");
    await page.getByTestId("ws-tab-usage").click();
    await expect(page.getByTestId("usage-export")).toBeDisabled();
  });

  test("low-credit banner appears only when the pool is nearly consumed", async ({ page }) => {
    await page.goto(USAGE);
    await expect(tid(page, "usage-kpi-pool")).toBeVisible();
    await expect(page.getByTestId("usage-low-credit-banner")).toHaveCount(0);
    await page.goto(`${USAGE}?demo_used=85`);
    await expect(page.getByTestId("usage-low-credit-banner")).toHaveAttribute("data-severity", "warn");
    await page.goto(`${USAGE}?demo_used=96`);
    await expect(page.getByTestId("usage-low-credit-banner")).toHaveAttribute("data-severity", "high");
    await expect(page.getByTestId("usage-cta-billing")).toHaveAttribute("href", "/enterprise/workspace/billing");
    await expect(page.getByTestId("usage-cta-contact")).toHaveAttribute("href", "/enterprise#quote");
    await page.goto(`${USAGE}?demo_used=100`);
    await expect(page.getByTestId("usage-low-credit-banner")).toHaveAttribute("data-severity", "full");
    await expect(page.getByTestId("usage-kpi-remaining")).toHaveAttribute("data-value", "0");
  });

  test("guests see the demo with a note about live data", async ({ page }) => {
    await page.goto(USAGE);
    await expect(page.getByTestId("usage-live-account")).toContainText(/guest/i);
    await expect(page.getByTestId("usage-live-account")).toContainText("Your account (live data)");
    await expect(page.getByTestId("demo-badge").first()).toBeVisible();
  });

  test("removed members keep history, labelled Former member", async ({ page }) => {
    await page.goto(TEAM);
    await page.getByTestId("member-remove-m-leo").click();
    await page.getByTestId("confirm-ok").click();
    await expect(row(page, "m-leo")).toHaveCount(0);
    await page.getByTestId("ws-tab-usage").click();
    await page.getByTestId("usage-range-monthly").click();
    await expect(page.getByTestId("usage-by-member")).toContainText("Leo Marchetti");
    await expect(page.getByTestId("usage-by-member")).toContainText("Former member");
  });
});

test.describe("layout and theme", () => {
  for (const path of [TEAM, USAGE, `${USAGE}?demo_used=96`]) {
    for (const theme of ["dark", "light"]) {
      test(`no overflow at 280px, ${theme}: ${path}`, async ({ page, errors }) => {
        await page.setViewportSize({ width: 280, height: 700 });
        await page.goto(path);
        await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
        await expect(page.getByTestId("demo-badge").first()).toBeVisible();
        await page.waitForTimeout(400);
        expect(await noOverflow(page)).toBe(true);
        expect(errors).toEqual([]);
      });
    }
  }
});
