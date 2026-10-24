import { test, expect, tid, generate } from "./helpers";

test("search trigger is wide on desktop and compact on phones", async ({ page }, info) => {
  const w = page.viewportSize()!.width;
  await page.goto("/");
  const b = await tid(page, "search-trigger").boundingBox();
  if (w >= 1024) expect(b!.width).toBeGreaterThanOrEqual(240);
  else if (w < 480) expect(b!.width).toBeLessThanOrEqual(48);
  expect(info.project.name).toBeTruthy();
});

test("palette is wide, input fills its row, no overflow", async ({ page }) => {
  const w = page.viewportSize()!.width;
  await page.goto("/");
  await tid(page, "search-trigger").click();
  const dlg = page.getByRole("dialog", { name: "Search Kinetic" });
  const d = (await dlg.boundingBox())!;
  const i = (await tid(page, "search-input").boundingBox())!;
  if (w >= 1024) expect(d.width).toBeGreaterThanOrEqual(560);
  expect(i.width).toBeGreaterThan(d.width * 0.5);
  expect(i.height).toBeGreaterThanOrEqual(48);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await tid(page, "search-input").fill("zzzqqq");
  await expect(dlg).toContainText("Nothing found");
});

test("palette has no overflow at 280px", async ({ page }) => {
  await page.setViewportSize({ width: 280, height: 640 });
  await page.goto("/");
  await tid(page, "search-trigger").click();
  await expect(tid(page, "search-input")).toBeVisible();
  await tid(page, "search-input").fill("create");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("assistant clear chat confirms with the real count and cancel keeps messages", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kinetic.assist.v1", JSON.stringify([
      { id: "a", role: "user", text: "hi" }, { id: "b", role: "assistant", text: "hello" }, { id: "c", role: "user", text: "where is create" },
    ]));
  });
  await page.goto("/");
  await tid(page, "assistant-toggle").click();
  await expect(page.locator('[data-testid="assistant-msg"]')).toHaveCount(3);
  await tid(page, "assistant-clear").click();
  const dlg = tid(page, "confirm-dialog");
  await expect(dlg).toContainText("3 messages");
  await expect(dlg).toContainText("only saved on this device");
  await expect(tid(page, "confirm-ok")).toHaveText("Delete 3 messages");
  await tid(page, "confirm-cancel").click();
  await expect(dlg).toHaveCount(0);
  await expect(page.locator('[data-testid="assistant-msg"]')).toHaveCount(3);
  await tid(page, "assistant-clear").click();
  await tid(page, "confirm-ok").click();
  await expect(page.locator('[data-testid="assistant-msg"]')).toHaveCount(0);
});

test("library delete shows undo toast and undo restores the item", async ({ page }) => {
  await page.goto("/create");
  await generate(page);
  await page.goto("/library");
  await tid(page, "library-item").getByRole("button", { name: /delete/i }).first().click();
  await expect(tid(page, "undo-toast")).toBeVisible();
  await expect(page.locator('[data-testid="library-item"]')).toHaveCount(0);
  await tid(page, "undo-btn").click();
  await expect(page.locator('[data-testid="library-item"]')).toHaveCount(1);
});

test("settings delete-data lists real counts; cancel keeps data", async ({ page }) => {
  await page.goto("/create");
  await generate(page);
  await page.goto("/settings");
  await tid(page, "delete-data").click();
  const dlg = tid(page, "confirm-dialog");
  await expect(dlg).toContainText("1 saved generation");
  await tid(page, "confirm-cancel").click();
  await expect(dlg).toHaveCount(0);
  await page.goto("/library");
  await expect(page.locator('[data-testid="library-item"]')).toHaveCount(1);
});

test("mcp regenerate asks first and warns agents stop working", async ({ page }) => {
  await page.goto("/connect");
  await expect(tid(page, "mcp-key")).toHaveText(/^kn_/);
  const key = await tid(page, "mcp-key").innerText();
  await tid(page, "mcp-regenerate").click();
  await expect(tid(page, "confirm-dialog")).toContainText("stop working immediately");
  await tid(page, "confirm-cancel").click();
  expect(await tid(page, "mcp-key").innerText()).toBe(key);
  await tid(page, "mcp-regenerate").click();
  await tid(page, "confirm-ok").click();
  await expect.poll(() => tid(page, "mcp-key").innerText()).not.toBe(key);
});
