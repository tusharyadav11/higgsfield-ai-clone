import "./db/env";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "../../src/db";
import { PW, dbAvailable, email, me, req, signupUser, tokenFrom, truncateAll } from "./db/helpers";
import { GET as listRoute, DELETE as revokeOthersRoute } from "../../src/app/api/me/sessions/route";
import { DELETE as revokeRoute } from "../../src/app/api/me/sessions/[id]/route";
import { POST as loginRoute } from "../../src/app/api/auth/login/route";
import { sha256 } from "../../src/server/auth";
import { AUDIT_MAX, __resetAuditForTests, auditToCsv, filterAudit, readAudit, record } from "../../src/lib/enterprise/audit";
import { DEFAULT_ORG, DEFAULT_SSO, SECURITY_CHECKLIST, dnsRecordFor, domainToken, logoInitial, slugify, validateDomain, validateOrg, validateSso } from "../../src/lib/enterprise/security";
import { ACTIONS, ROLES, can } from "../../src/lib/enterprise/roles";

describe("organization profile", () => {
  it("validates", () => {
    expect(validateOrg(DEFAULT_ORG)).toEqual({});
    expect(validateOrg({ ...DEFAULT_ORG, name: " a " }).name).toBeTruthy();
    expect(validateOrg({ ...DEFAULT_ORG, slug: "Bad Slug" }).slug).toBeTruthy();
    expect(validateOrg({ ...DEFAULT_ORG, slug: "a--b" }).slug).toBeTruthy();
    expect(validateOrg({ ...DEFAULT_ORG, timezone: "Mars/Base" }).timezone).toBeTruthy();
    expect(validateOrg({ ...DEFAULT_ORG, defaultRole: "owner" }).defaultRole).toBeTruthy();
  });
  it("derives slug and logo initial", () => {
    expect(slugify("  Acme Studio & Co.! ")).toBe("acme-studio-co");
    expect(logoInitial(" zed")).toBe("Z");
    expect(logoInitial("")).toBe("?");
  });
  it("permission matrix agrees with roles.ts", () => {
    for (const r of ROLES) for (const a of ACTIONS) expect(typeof can(r, a.id)).toBe("boolean");
    expect(can("viewer", "edit_projects")).toBe(false);
    expect(can("owner", "manage_billing")).toBe(true);
  });
});

describe("SSO form validation (local only)", () => {
  it("SAML requires https metadata, entity id and a PEM certificate", () => {
    const e = validateSso(DEFAULT_SSO);
    expect(Object.keys(e).sort()).toEqual(["certificate", "entityId", "metadataUrl"]);
    const good = { ...DEFAULT_SSO, metadataUrl: "https://idp.example.com/meta", entityId: "urn:idp", certificate: "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----" };
    expect(validateSso(good)).toEqual({});
    expect(validateSso({ ...good, metadataUrl: "http://idp.example.com" }).metadataUrl).toBeTruthy();
    expect(validateSso({ ...good, certificate: "just text" }).certificate).toMatch(/PEM/);
    expect(validateSso({ ...good, attrEmail: "bad attr!" }).attrEmail).toBeTruthy();
  });
  it("OIDC requires issuer and client id", () => {
    expect(Object.keys(validateSso({ ...DEFAULT_SSO, protocol: "oidc" })).sort()).toEqual(["clientId", "issuer"]);
    expect(validateSso({ ...DEFAULT_SSO, protocol: "oidc", issuer: "https://login.example.com", clientId: "abc" })).toEqual({});
  });
  it("the checklist never marks unbuilt capabilities active", () => {
    const active = SECURITY_CHECKLIST.filter((c) => c.status === "active").map((c) => c.id);
    expect(active).toEqual(["sessions"]);
    expect(SECURITY_CHECKLIST.find((c) => c.id === "sso")?.status).toBe("needs-integration");
  });
});

describe("domain verification token", () => {
  it("is deterministic per org and domain, and differs otherwise", () => {
    expect(domainToken("Example.com", "acme")).toBe(domainToken("example.com.", "acme"));
    expect(domainToken("example.com", "acme")).not.toBe(domainToken("example.org", "acme"));
    expect(domainToken("example.com", "acme")).not.toBe(domainToken("example.com", "other"));
    expect(domainToken("example.com", "acme")).toMatch(/^[0-9a-f]{28}$/);
    expect(dnsRecordFor("example.com", "acme")).toEqual({ type: "TXT", host: "_kinetic-verify.example.com", value: `kinetic-verify=${domainToken("example.com", "acme")}` });
  });
  it("validates domains", () => {
    expect(validateDomain("example.com")).toBeNull();
    expect(validateDomain("sub.example.co.uk")).toBeNull();
    expect(validateDomain("https://example.com")).toBeTruthy();
    expect(validateDomain("example")).toBeTruthy();
    expect(validateDomain("exa mple.com")).toBeTruthy();
    expect(validateDomain("example.com", ["example.com"])).toMatch(/already/);
    expect(validateDomain("")).toBeTruthy();
  });
});

describe("local audit log", () => {
  beforeEach(__resetAuditForTests);
  it("records newest first, caps size and filters", () => {
    record({ action: "invite.sent", target: "a@b.co", actor: "You", role: "owner", at: "2026-10-24T10:00:00.000Z" });
    record({ action: "project.approved", target: "Spring", detail: "ok", at: "2026-10-24T10:01:00.000Z" });
    const l = readAudit();
    expect(l.map((e) => e.action)).toEqual(["project.approved", "invite.sent"]);
    expect(filterAudit(l, { action: "invite.sent" })).toHaveLength(1);
    expect(filterAudit(l, { q: "spring" })).toHaveLength(1);
    expect(filterAudit(l, { q: "nope" })).toHaveLength(0);
    for (let i = 0; i < AUDIT_MAX + 5; i++) record({ action: "x", target: String(i) });
    expect(readAudit()).toHaveLength(AUDIT_MAX);
  });
  it("exports CSV with quoting and formula-injection protection", () => {
    record({ action: "a", target: '=HYPERLINK("x")', detail: 'say "hi", ok', at: "2026-10-24T10:00:00.000Z" });
    const csv = auditToCsv(readAudit());
    expect(csv.split("\n")[0]).toBe('"time","actor","role","action","target","detail"');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"say ""hi"", ok"');
  });
});

/* ------------------------- real session endpoints (local test DB) ------------------------- */

const ok = await dbAvailable();
const d = ok ? describe : describe.skip;

d("session endpoints", () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  const list = (token: string | null) => listRoute(req("/api/me/sessions", { cookie: token }));
  const revoke = (token: string | null, id: string, headers?: Record<string, string>) =>
    revokeRoute(req(`/api/me/sessions/${id}`, { method: "DELETE", cookie: token, headers }), { params: Promise.resolve({ id }) });
  const login = async (e: string) => tokenFrom(await loginRoute(req("/api/auth/login", { method: "POST", body: { email: e, password: PW } })))!;

  it("requires sign-in", async () => {
    expect((await list(null)).status).toBe(401);
    expect((await revoke(null, "a".repeat(32))).status).toBe(401);
  });

  it("lists own sessions with a current flag and never leaks tokens or hashes", async () => {
    const u = await signupUser();
    const t2 = await login(u.email);
    const res = await list(u.token);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.sessions).toHaveLength(2);
    expect(body.sessions.filter((s: { current: boolean }) => s.current)).toHaveLength(1);
    const text = JSON.stringify(body);
    for (const t of [u.token, t2]) {
      expect(text).not.toContain(t);
      expect(text).not.toContain(sha256(t));
    }
    expect(body.sessions[0]).toEqual({ id: expect.stringMatching(/^[0-9a-f]{32}$/), label: expect.stringMatching(/^Session [0-9a-f]{6}$/), createdAt: expect.any(String), expiresAt: expect.any(String), current: expect.any(Boolean) });
    // the other login's view flags a different one as current
    const other = (await (await list(t2)).json()).sessions;
    expect(other.find((s: { current: boolean }) => s.current).id).not.toBe(body.sessions.find((s: { current: boolean }) => s.current).id);
  });

  it("revokes another session (really signs it out) but refuses the current one", async () => {
    const u = await signupUser();
    const t2 = await login(u.email);
    const sessions = (await (await list(u.token)).json()).sessions as { id: string; current: boolean }[];
    const cur = sessions.find((s) => s.current)!;
    const oth = sessions.find((s) => !s.current)!;
    const r0 = await revoke(u.token, cur.id);
    expect(r0.status).toBe(400);
    expect((await me(u.token)).user).toBeTruthy();
    const r1 = await revoke(u.token, oth.id);
    expect(r1.status).toBe(200);
    expect((await me(t2)).user).toBeNull();
    expect((await me(u.token)).user).toBeTruthy();
    expect((await revoke(u.token, oth.id)).status).toBe(404); // already gone
    const rows = (await db().execute(sql`select count(*)::int as n from sessions`)) as unknown as { n: number }[];
    expect(rows[0].n).toBe(1);
  });

  it("ownership: cannot touch another user's session; bad ids are 404; cross-origin is blocked", async () => {
    const a = await signupUser();
    const b = await signupUser();
    const bId = ((await (await list(b.token)).json()).sessions as { id: string }[])[0].id;
    expect((await revoke(a.token, bId)).status).toBe(404);
    expect((await me(b.token)).user).toBeTruthy();
    expect((await revoke(a.token, "not-an-id")).status).toBe(404);
    const aId = ((await (await list(a.token)).json()).sessions as { id: string }[])[0].id;
    expect((await revoke(a.token, aId, { origin: "http://evil.example" })).status).toBe(403);
  });

  it("'sign out other sessions' keeps only the current session", async () => {
    const u = await signupUser();
    await login(u.email);
    const t3 = await login(u.email);
    const bystander = await signupUser();
    const res = await revokeOthersRoute(req("/api/me/sessions", { method: "DELETE", cookie: u.token }));
    expect(res.status).toBe(200);
    expect((await res.json()).revoked).toBe(2);
    expect((await me(u.token)).user).toBeTruthy();
    expect((await me(t3)).user).toBeNull();
    expect((await me(bystander.token)).user).toBeTruthy();
    expect((await revokeOthersRoute(req("/api/me/sessions", { method: "DELETE", cookie: u.token, headers: { origin: "http://evil.example" } }))).status).toBe(403);
    void email;
  });
});
