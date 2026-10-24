import { test, expect } from "./helpers";
import type { Page } from "@playwright/test";
import { request as pwRequest } from "@playwright/test";

const BASE = `/enterprise/workspace`;
const PW = "correct horse battery";
const uniq = () => `ent${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}@example.com`;

const noOverflow = async (page: Page) => {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(o.sw, `horizontal overflow ${o.sw} > ${o.cw}`).toBeLessThanOrEqual(o.cw + 1);
};
const setTheme = (page: Page, t: "light" | "dark") => page.evaluate((t) => { document.documentElement.dataset.theme = t; }, t);
const act = (page: Page, role: string) => page.getByTestId("acting-as").selectOption(role);
const openProject = async (page: Page, name: string) => {
  await page.locator('[data-testid="project-card"]', { hasText: name }).getByTestId("open-project").click();
  await expect(page.getByTestId("project-drawer")).toBeVisible();
};

test.describe("projects", () => {
  test("grid, chips with counts, search, list toggle", async ({ page, errors }) => {
    await page.goto(`${BASE}/projects`);
    await expect(page.getByTestId("project-card")).toHaveCount(6);
    await expect(page.getByTestId("demo-badge").first()).toBeVisible();
    await expect(page.getByTestId("count-all")).toHaveText("6");
    await expect(page.getByTestId("count-in_review")).toHaveText("1");
    await page.getByTestId("chip-in_review").click();
    await expect(page.getByTestId("project-card")).toHaveCount(1);
    await expect(page.getByTestId("project-card")).toContainText("Spring campaign");
    await page.getByTestId("chip-all").click();
    await page.getByTestId("proj-search").fill("zzz-none");
    await expect(page.getByTestId("proj-empty")).toBeVisible();
    await page.getByTestId("proj-search").fill("launch");
    await expect(page.getByTestId("project-card")).toHaveCount(1);
    await page.getByTestId("proj-search").fill("");
    await page.getByTestId("view-list").click();
    await expect(page.getByTestId("project-row")).toHaveCount(6);
    await page.getByTestId("proj-owner").selectOption({ label: "Leo Marchetti" });
    await expect(page.getByTestId("project-row")).toHaveCount(2);
    await noOverflow(page);
    expect(errors).toEqual([]);
  });

  test("create project validates and opens the new project", async ({ page }) => {
    await page.goto(`${BASE}/projects`);
    await page.getByTestId("create-project-btn").click();
    await page.getByTestId("cp-name").fill("x");
    await page.getByTestId("create-project-submit").click();
    await expect(page.getByRole("alert").first()).toContainText(/at least 2/);
    await page.getByTestId("cp-name").fill("spring campaign");
    await page.getByTestId("create-project-submit").click();
    await expect(page.getByRole("alert").first()).toContainText(/already exists/);
    await page.getByTestId("cp-name").fill("Autumn lookbook");
    await page.getByTestId("picker-asset").first().click();
    await page.getByTestId("create-project-submit").click();
    await expect(page.getByTestId("project-drawer")).toContainText("Autumn lookbook");
    await expect(page).toHaveURL(/open=p-new-/);
    await page.getByTestId("modal-close").click();
    await expect(page.getByTestId("project-card")).toHaveCount(7);
    await page.reload(); // persisted
    await expect(page.getByTestId("project-card")).toHaveCount(7);
  });

  test("approval workflow is role-aware: editor cannot approve, admin must give reasons", async ({ page }) => {
    await page.goto(`${BASE}/projects`);
    await act(page, "editor");
    await openProject(page, "Spring campaign");
    await expect(page.getByTestId("cannot-approve")).toBeVisible();
    await expect(page.getByTestId("approve-btn")).toHaveCount(0);
    await page.getByTestId("modal-close").click();

    await act(page, "admin");
    await openProject(page, "Spring campaign");
    await page.getByTestId("request-changes-btn").click();
    await page.getByTestId("decision-confirm").click();
    await expect(page.getByTestId("drawer-error")).toContainText(/reason is required/i);
    await page.getByTestId("decision-reason").fill("Warmer grade on frame 05");
    await page.getByTestId("decision-confirm").click();
    await expect(page.getByTestId("project-drawer").getByTestId("project-status")).toHaveAttribute("data-status", "draft");
    await expect(page.getByTestId("review-note")).toContainText("Warmer grade");
    // resubmit -> approve
    await page.getByTestId("submit-review").click();
    await expect(page.getByTestId("project-drawer").getByTestId("project-status")).toHaveAttribute("data-status", "in_review");
    await page.getByTestId("approve-btn").click();
    await expect(page.getByTestId("project-drawer").getByTestId("project-status")).toHaveAttribute("data-status", "approved");
    await page.getByTestId("pd-tab-activity").click();
    await expect(page.getByTestId("activity-list")).toContainText("Approved the project");
    // reject path from a fresh submission of another project
    await page.getByTestId("modal-close").click();
    await openProject(page, "Social cutdowns");
    await page.getByTestId("submit-review").click();
    await page.getByTestId("reject-btn").click();
    await page.getByTestId("decision-reason").fill("Off brand");
    await page.getByTestId("decision-confirm").click();
    await expect(page.getByTestId("project-drawer").getByTestId("project-status")).toHaveAttribute("data-status", "archived");
    await page.getByTestId("unarchive-btn").click();
    await expect(page.getByTestId("project-drawer").getByTestId("project-status")).toHaveAttribute("data-status", "draft");
  });

  test("viewer is read-only for creating but can open and comment", async ({ page }) => {
    await page.goto(`${BASE}/projects`);
    await act(page, "viewer");
    await expect(page.getByTestId("create-project-btn")).toBeDisabled();
    await expect(page.getByTestId("viewer-note")).toBeVisible();
    await openProject(page, "Social cutdowns");
    await expect(page.getByTestId("submit-review")).toBeDisabled();
    await page.getByTestId("pd-tab-comments").click();
    await page.getByTestId("comment-input").fill("Looks good to me");
    await page.getByTestId("comment-post").click();
    await expect(page.getByTestId("comment-list")).toContainText("Looks good to me");
  });

  test("version history: restore creates a new version and compare shows the diff", async ({ page }) => {
    await page.goto(`${BASE}/projects?open=p-spring`);
    await expect(page.getByTestId("project-drawer")).toBeVisible();
    await page.getByTestId("pd-tab-versions").click();
    await expect(page.getByTestId("version-row")).toHaveCount(3);
    await page.getByRole("button", { name: "Restore version 1" }).click();
    await expect(page.getByTestId("version-row")).toHaveCount(4);
    await expect(page.getByTestId("version-row").first()).toContainText("Restored from v1");
    await expect(page.getByTestId("version-row").first()).toContainText("Current");
    await page.getByTestId("cmp-a").selectOption("1");
    await page.getByTestId("cmp-b").selectOption("3");
    await page.getByTestId("compare-btn").click();
    await expect(page.getByTestId("compare-view")).toBeVisible();
    await expect(page.getByTestId("compare-summary")).toContainText(/added.*removed/);
    expect(await page.getByTestId("diff-flag").count()).toBeGreaterThan(0);
    // history is intact
    await expect(page.getByTestId("version-row").nth(3)).toContainText("Initial moodboard");
  });

  test("comments: add with @mention, edit own, delete own with confirm; others' are read-only", async ({ page }) => {
    await page.goto(`${BASE}/projects?open=p-spring`);
    await page.getByTestId("pd-tab-comments").click();
    await expect(page.getByTestId("comment")).toHaveCount(2);
    await expect(page.getByTestId("comment-edit")).toHaveCount(0); // seeded comments are not mine
    await page.getByTestId("comment-input").fill("Thanks @Noah, uploading now");
    await page.getByTestId("comment-post").click();
    await expect(page.getByTestId("comment")).toHaveCount(3);
    await expect(page.getByTestId("mention").filter({ hasText: "@Noah" }).last()).toBeVisible();
    await page.getByTestId("comment-edit").click();
    await page.getByTestId("comment-edit-input").fill("Edited note");
    await page.getByTestId("comment-save").click();
    await expect(page.getByTestId("comment").last()).toContainText("Edited note");
    await expect(page.getByTestId("comment").last()).toContainText("(edited)");
    await page.getByTestId("comment-delete").click();
    await page.getByTestId("confirm-cancel").click();
    await expect(page.getByTestId("comment")).toHaveCount(3);
    await page.getByTestId("comment-delete").click();
    await page.getByTestId("confirm-ok").click();
    await expect(page.getByTestId("comment")).toHaveCount(2);
  });

  test("keyboard: Escape closes the drawer and focus returns", async ({ page }) => {
    await page.goto(`${BASE}/projects`);
    await page.locator('[data-testid="project-card"]', { hasText: "Social cutdowns" }).getByTestId("open-project").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("project-drawer")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("project-drawer")).toHaveCount(0);
  });
});

test.describe("security", () => {
  test("sections, nav anchors, org profile validation and honesty labels", async ({ page, errors }) => {
    await page.goto(`${BASE}/security`);
    for (const id of ["org", "workspace", "rbac", "sso", "audit", "sessions", "domains", "status"]) await expect(page.getByTestId(`section-${id}`)).toBeVisible();
    await page.getByTestId("security-nav").getByRole("link", { name: "SSO" }).click();
    await expect(page).toHaveURL(/#sso$/);
    await expect(page.getByTestId("section-sso").getByTestId("status-pill").first()).toHaveText(/Needs integration/);
    // org
    await page.getByTestId("org-name").fill("A");
    await page.getByTestId("org-save").click();
    await expect(page.getByRole("alert").first()).toContainText(/at least 2/);
    await page.getByTestId("org-name").fill("Globex Studio");
    await expect(page.getByTestId("org-slug")).toHaveValue("globex-studio");
    await expect(page.getByTestId("org-logo")).toHaveText("G");
    await page.getByTestId("org-save").click();
    await expect(page.getByTestId("org-saved")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("org-name")).toHaveValue("Globex Studio");
    // retention is flagged not enforced
    await expect(page.getByTestId("retention-note")).toContainText(/not enforced/i);
    // rbac matrix
    await expect(page.getByTestId("rbac-edit_projects-viewer")).toHaveAttribute("data-allowed", "false");
    await expect(page.getByTestId("rbac-approve_projects-admin")).toHaveAttribute("data-allowed", "true");
    // no false claims
    const txt = await page.locator("main, body").first().innerText();
    expect(txt).not.toMatch(/SSO is (now )?(active|enabled|connected)/i);
    expect(txt).not.toMatch(/domain (is )?verified(?! locally)/i);
    await noOverflow(page);
    expect(errors).toEqual([]);
  });

  test("SSO test connection validates fields locally only", async ({ page }) => {
    await page.goto(`${BASE}/security#sso`);
    await page.getByTestId("sso-test").click();
    await expect(page.getByTestId("sso-result")).toHaveAttribute("data-result", "bad");
    await expect(page.getByTestId("sso-result")).toContainText("Validated locally only. SSO requires a backend identity-provider integration that is not connected.");
    await page.getByTestId("sso-meta").fill("https://idp.example.com/metadata");
    await page.getByTestId("sso-entity").fill("urn:idp:example");
    await page.getByTestId("sso-cert").fill("-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----");
    await page.getByTestId("sso-test").click();
    await expect(page.getByTestId("sso-result")).toHaveAttribute("data-result", "ok");
    await expect(page.getByTestId("sso-result")).toContainText("not connected");
    await expect(page.getByTestId("sso-acs")).toContainText("/api/sso/acs");
    // retry: under heavy load the first click can land before hydration and be dropped
    await expect(async () => {
      // click the visible label, as a user would (the radio itself is visually hidden)
      await page.locator('label:has([data-testid="sso-oidc"])').click();
      await expect(page.getByTestId("sso-issuer")).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 15_000 });
    await page.getByTestId("sso-save").click();
    await expect(page.getByTestId("toast").last()).toContainText(/not applied to a real identity provider/i);
  });

  test("domain verification shows a deterministic TXT record and never verifies", async ({ page }) => {
    await page.goto(`${BASE}/security#domains`);
    await page.getByTestId("domain-input").fill("https://nope");
    await page.getByTestId("domain-add").click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await page.getByTestId("domain-input").fill("Example.com");
    await page.getByTestId("domain-add").click();
    const v1 = await page.getByTestId("dns-value").innerText();
    expect(v1).toMatch(/^kinetic-verify=[0-9a-f]{28}$/);
    await expect(page.getByTestId("dns-host")).toHaveText("_kinetic-verify.example.com");
    await expect(page.getByTestId("domain-row").getByTestId("status-pill")).toHaveText(/Not verified/);
    await page.reload();
    expect(await page.getByTestId("dns-value").innerText()).toBe(v1); // deterministic across reloads
    await page.getByTestId("dns-check").click();
    await expect(page.getByTestId("dns-check-msg")).toContainText("Verification requires a DNS check service that is not connected");
    await expect(page.getByTestId("domain-row").getByTestId("status-pill")).toHaveText(/Not verified/);
  });

  test("audit log records workspace actions, filters and exports CSV", async ({ page }) => {
    await page.goto(`${BASE}/projects`);
    await act(page, "admin");
    await openProject(page, "Spring campaign");
    await page.getByTestId("approve-btn").click();
    await page.getByTestId("modal-close").click();
    await page.goto(`${BASE}/security#audit`);
    await expect(page.getByTestId("section-audit")).toContainText("Local demo log: not tamper-proof, not a compliance audit trail.");
    await expect(page.getByTestId("audit-row")).toHaveCount(1);
    await expect(page.getByTestId("audit-row")).toContainText("project.approved");
    await expect(page.getByTestId("audit-row")).toContainText("(admin)");
    await page.getByTestId("audit-search").fill("nothing-like-this");
    await expect(page.getByTestId("audit-row")).toHaveCount(0);
    await expect(page.getByTestId("audit-export")).toBeDisabled();
    await page.getByTestId("audit-search").fill("");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("audit-export").click()]);
    expect(dl.suggestedFilename()).toMatch(/^kinetic-demo-audit-\d{4}-\d{2}-\d{2}\.csv$/);
    await page.getByTestId("audit-clear").click();
    await page.getByTestId("confirm-ok").click();
    await expect(page.getByTestId("audit-empty")).toBeVisible();
  });

  test("guests see 'Sign in to manage real sessions'", async ({ page }) => {
    await page.goto(`${BASE}/security#sessions`);
    await expect(page.getByTestId("sessions-guest")).toContainText("Sign in to manage real sessions");
  });
});

test.describe("billing", () => {
  test("truthful billing: no invoices, no payment method, add-ons to quote, intents are local", async ({ page, errors }) => {
    await page.goto(`${BASE}/billing`);
    await expect(page.getByTestId("current-plan")).toHaveText("Enterprise (quote pending)");
    await expect(page.getByTestId("invoices-empty")).toContainText("billing isn’t connected to a payment provider");
    await expect(page.getByTestId("sample-invoice")).toContainText("Sample invoice layout (demo)");
    await expect(page.getByRole("link", { name: "Request invoice billing" })).toHaveAttribute("href", "/enterprise#quote");
    await expect(page.locator("body")).not.toContainText(/payment (was )?(received|processed|successful)/i);
    // cycles come from the shared annual rule
    await expect(page.getByTestId("cycle-annual")).toContainText("Save 20%");
    // add-ons
    await expect(page.getByTestId("add-to-quote")).toBeDisabled();
    await page.getByRole("button", { name: "More 5,000 credits packs" }).click();
    await page.getByRole("button", { name: "More 5,000 credits packs" }).click();
    await page.getByRole("button", { name: "More 20,000 credits packs" }).click();
    await expect(page.getByTestId("addon-total")).toContainText("30,000");
    await page.getByTestId("add-to-quote").click();
    await expect(page.getByTestId("addons-saved")).toBeVisible();
    await expect(page.getByTestId("addons-quote-link")).toHaveAttribute("href", /\/enterprise\?.*addons=5k%3A2%2C20k%3A1.*#quote$/);
    // subscription intents
    await expect(page.getByTestId("sub-upgrade")).toBeDisabled();
    await page.getByTestId("sub-downgrade").click();
    await expect(page.getByTestId("confirm-dialog")).toContainText("Nothing is charged".length ? "no money moves" : "");
    await page.getByTestId("confirm-ok").click();
    await expect(page.getByTestId("current-plan")).toHaveText("Team (demo)");
    await expect(page.getByTestId("intent-row")).toHaveCount(1);
    await page.getByTestId("sub-cancel").click();
    await page.getByTestId("confirm-cancel").click();
    await expect(page.getByTestId("current-plan")).toHaveText("Team (demo)");
    await page.reload();
    await expect(page.getByTestId("current-plan")).toHaveText("Team (demo)");
    await noOverflow(page);
    expect(errors).toEqual([]);
  });
});

test.describe("developers", () => {
  test("guest sees sign-in prompt; webhooks, integrations and honesty labels", async ({ page, errors }) => {
    await page.goto(`${BASE}/developers`);
    await expect(page.getByTestId("keys-guest")).toContainText("Sign in to create API keys");
    await expect(page.getByTestId("goto-connect").or(page.getByRole("link", { name: "Connect page" })).first()).toBeVisible();
    // usage + logs honesty
    await expect(page.getByTestId("section-usage")).toContainText("Usage stats need request logging that is not enabled");
    await expect(page.getByTestId("section-usage").getByTestId("demo-badge").first()).toBeVisible();
    await expect(page.getByTestId("section-logs").getByTestId("status-pill").first()).toHaveText(/Not enabled/);
    // webhooks
    await page.getByTestId("wh-url").fill("http://example.com/hook");
    await page.getByTestId("wh-add").click();
    await expect(page.getByTestId("wh-url-error")).toContainText(/https/);
    await page.getByTestId("wh-url").fill("https://example.com/hook");
    await page.getByTestId("wh-add").click();
    const secret = await page.getByTestId("wh-secret").innerText();
    expect(secret).toMatch(/^whsec_[A-Za-z0-9_-]{43}$/);
    await expect(page.getByTestId("wh-demo-note")).toContainText("Demo: events are not delivered, no secret is registered with any server.");
    await page.getByTestId("wh-test").click();
    await expect(page.getByTestId("wh-not-sent")).toContainText("Not sent anywhere");
    await expect(page.getByTestId("wh-signature")).toContainText(/t=\d+,v1=[0-9a-f]{64}/);
    await expect(page.getByTestId("wh-payload")).toContainText('"demo": true');
    // secret is never stored in the browser
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(stored).not.toContain(secret);
    await page.reload();
    await expect(page.getByTestId("wh-secret")).toHaveCount(0); // shown once
    await expect(page.getByTestId("wh-row")).toHaveCount(1);
    // integrations
    await expect(page.getByTestId("integration-claude-mcp")).toContainText("Available");
    await expect(page.getByTestId("integration-slack")).toContainText("Not available yet");
    await expect(page.getByTestId("integration-figma")).toContainText("Planned");
    await expect(page.locator('[data-testid="integration-grid"]')).not.toContainText(/\bConnected\b/);
    await page.getByTestId("integration-slack").getByTestId("request-integration").click();
    await page.getByTestId("interest-submit").click();
    await expect(page.getByTestId("integration-slack").getByTestId("interest-recorded")).toBeVisible();
    // docs
    await expect(page.getByTestId("curl-snippet")).toContainText("kn_YOUR_KEY");
    await expect(page.getByTestId("curl-snippet")).toContainText(page.url().split("/enterprise")[0]);
    await expect(page.getByTestId("doc-readme")).toHaveAttribute("href", "https://github.com/tusharyadav11/higgsfield-ai-clone");
    await noOverflow(page);
    expect(errors).toEqual([]);
  });
});

test.describe("real keys and sessions (needs DATABASE_URL)", () => {
  test.beforeEach(async ({ request }) => {
    const r = await request.get("/api/auth/me");
    test.skip(!(await r.json()).db, "DATABASE_URL not set: demo mode");
  });

  async function signup(page: Page) {
    const email = uniq();
    await page.goto("/signup");
    await page.getByTestId("auth-email").fill(email);
    await page.getByTestId("auth-password").fill(PW);
    await Promise.all([page.waitForURL((u) => u.pathname === "/"), page.getByTestId("auth-submit").click()]);
    return email;
  }

  test("API key: create (shown once, copy), list prefix only, revoke with confirm", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
    await signup(page);
    await page.goto(`${BASE}/developers`);
    await expect(page.getByTestId("create-key")).toBeVisible();
    await expect(page.getByTestId("keys-empty")).toBeVisible();
    await page.getByTestId("create-key").click();
    const key = await page.getByTestId("new-key").innerText();
    expect(key).toMatch(/^kn_[0-9a-f]{32}$/);
    await expect(page.getByTestId("key-row")).toHaveCount(1);
    await expect(page.getByTestId("key-row")).toContainText(key.slice(0, 9));
    await expect(page.getByTestId("key-row")).not.toContainText(key);
    // the key really works on the MCP endpoint
    const rpc = await page.request.post("/api/mcp", { headers: { authorization: `Bearer ${key}` }, data: { jsonrpc: "2.0", id: 1, method: "tools/list" } });
    expect(rpc.status()).toBe(200);
    // never stored client side
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(key);
    await page.reload();
    await expect(page.getByTestId("new-key")).toHaveCount(0);
    await expect(page.getByTestId("key-row")).toHaveCount(1);
    await page.getByTestId("revoke-key").click();
    await page.getByTestId("confirm-cancel").click();
    await expect(page.getByTestId("key-row")).toHaveCount(1);
    await page.getByTestId("revoke-key").click();
    await page.getByTestId("confirm-ok").click();
    await expect(page.getByTestId("keys-empty")).toBeVisible();
    const revoked = await page.request.post("/api/mcp", { headers: { authorization: `Bearer ${key}` }, data: { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_models", arguments: {} } } });
    expect(JSON.stringify(await revoked.json())).toMatch(/revoked/i);
    // audit trail exists locally
    await page.goto(`${BASE}/security#audit`);
    await expect(page.getByTestId("audit-table")).toContainText("api_key.created");
    await expect(page.getByTestId("audit-table")).toContainText("api_key.revoked");
  });

  test("sessions: list, revoke another (really signs it out), sign out others", async ({ page, baseURL }) => {
    const email = await signup(page);
    const other = await pwRequest.newContext({ baseURL });
    const login = await other.post("/api/auth/login", { data: { email, password: PW }, headers: { origin: baseURL! } });
    expect(login.ok()).toBe(true);
    expect((await (await other.get("/api/me")).json()).user.email).toBe(email);
    await page.goto(`${BASE}/security#sessions`);
    await expect(page.getByTestId("session-row")).toHaveCount(2);
    await expect(page.getByTestId("current-badge")).toHaveCount(1);
    await expect(page.locator('[data-testid="session-row"][data-current="true"]').getByTestId("revoke-session")).toHaveCount(0);
    await page.locator('[data-testid="session-row"][data-current="false"]').getByTestId("revoke-session").click();
    await page.getByTestId("confirm-ok").click();
    await expect(page.getByTestId("session-row")).toHaveCount(1);
    expect((await (await other.get("/api/me")).json()).user).toBeNull();
    // still signed in here
    await page.reload();
    await expect(page.getByTestId("session-row")).toHaveCount(1);
    await expect(page.getByTestId("signout-others")).toBeDisabled();
    // two more sessions then sign out others
    const o2 = await pwRequest.newContext({ baseURL });
    await o2.post("/api/auth/login", { data: { email, password: PW }, headers: { origin: baseURL! } });
    await page.reload();
    await expect(page.getByTestId("session-row")).toHaveCount(2);
    await page.getByTestId("signout-others").click();
    await page.getByTestId("confirm-ok").click();
    await expect(page.getByTestId("session-row")).toHaveCount(1);
    expect((await (await o2.get("/api/me")).json()).user).toBeNull();
    await other.dispose();
    await o2.dispose();
  });
});

test.describe("layout at 280px, both themes", () => {
  for (const theme of ["dark", "light"] as const) {
    test(`no horizontal overflow on every page (${theme})`, async ({ page, errors }) => {
      await page.setViewportSize({ width: 280, height: 700 });
      for (const p of ["projects", "projects?open=p-spring", "security", "billing", "developers"]) {
        await page.goto(`${BASE}/${p}`);
        await setTheme(page, theme);
        await expect(page.locator("main, body").first()).toBeVisible();
        await page.waitForTimeout(400);
        await noOverflow(page);
      }
      expect(errors).toEqual([]);
    });
  }
});
