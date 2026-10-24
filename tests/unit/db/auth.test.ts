import "./env";
import { beforeEach, afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "../../../src/db";
import { PW, dbAvailable, email, me, req, signupUser, tokenFrom, truncateAll } from "./helpers";
import { POST as signupRoute } from "../../../src/app/api/auth/signup/route";
import { POST as loginRoute } from "../../../src/app/api/auth/login/route";
import { POST as logoutRoute } from "../../../src/app/api/auth/logout/route";
import { GET as meRoute } from "../../../src/app/api/auth/me/route";

const ok = await dbAvailable();
const d = ok ? describe : describe.skip;

d("auth", () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  const login = (e: string, password: string) => loginRoute(req("/api/auth/login", { method: "POST", body: { email: e, password } }));

  it("signs up, stores only hashes, sets a hardened cookie and grants the signup bonus once", async () => {
    const { res, body, token, email: e } = await signupUser({ email: "  Mixed.Case@Example.COM " });
    expect(res.status).toBe(201);
    expect(body.user.email).toBe("mixed.case@example.com");
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=2592000/);
    expect(token!.length).toBeGreaterThan(30);
    const [u] = (await db().execute(sql`select password_hash from users`)) as unknown as { password_hash: string }[];
    expect(u.password_hash).not.toContain(PW);
    expect(u.password_hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    const sessions = (await db().execute(sql`select token_hash from sessions`)) as unknown as { token_hash: string }[];
    expect(sessions).toHaveLength(1);
    expect(sessions[0].token_hash).not.toBe(token);
    expect((await me(token)).balance).toBe(25);
    // a different case of the same email is the same account
    const dup = await signupUser({ email: e.toUpperCase() });
    expect(dup.res.status).toBe(409);
  });

  it("validates input", async () => {
    const bad = async (body: Record<string, unknown>) => (await signupRoute(req("/api/auth/signup", { method: "POST", body }))).status;
    expect(await bad({ email: "nope", password: PW })).toBe(400);
    expect(await bad({ email: email(), password: "short" })).toBe(400);
    expect(await bad({ email: email(), password: PW, name: "x".repeat(61) })).toBe(400);
    expect(await bad({ email: 5, password: PW })).toBe(400);
  });

  it("logs in with a generic error for wrong password and unknown email", async () => {
    const { email: e } = await signupUser();
    const a = await login(e, "wrong-password-1");
    const b = await login(email("ghost"), "wrong-password-1");
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect((await a.json()).error).toBe((await b.json()).error);
    const good = await login(e.toUpperCase(), PW);
    expect(good.status).toBe(200);
    expect(tokenFrom(good)).toBeTruthy();
  });

  it("locks the account for 60s after 5 failures, server-side, even for the right password", async () => {
    const { email: e } = await signupUser();
    for (let i = 0; i < 4; i++) expect((await login(e, "bad-password-" + i)).status).toBe(401);
    expect((await login(e, "bad-password-5")).status).toBe(429);
    const locked = await login(e, PW);
    expect(locked.status).toBe(429);
    expect((await locked.json()).error).toMatch(/try again in \d+s/i);
    const [row] = (await db().execute(sql`select locked_until > now() + interval '50 seconds' as long from users`)) as unknown as { long: boolean }[];
    expect(row.long).toBe(true);
    await db().execute(sql`update users set locked_until = now() - interval '1 second'`);
    expect((await login(e, PW)).status).toBe(200);
  });

  it("sessions: logout invalidates the token; expired sessions are rejected", async () => {
    const { token } = await signupUser();
    const who = async (t: string | null) => (await (await meRoute(req("/api/auth/me", { cookie: t }))).json()).user;
    expect(await who(token)).toBeTruthy();
    expect(await who("garbage")).toBeNull();
    const out = await logoutRoute(req("/api/auth/logout", { method: "POST", cookie: token }));
    expect(out.headers.get("set-cookie")).toMatch(/Max-Age=0/);
    expect(await who(token)).toBeNull();
    const second = await login((await db().execute(sql`select email from users`) as unknown as { email: string }[])[0].email, PW);
    const t2 = tokenFrom(second);
    expect(await who(t2)).toBeTruthy();
    await db().execute(sql`update sessions set expires_at = now() - interval '1 second'`);
    expect(await who(t2)).toBeNull();
  });

  it("rejects cross-origin mutations", async () => {
    const res = await signupRoute(req("/api/auth/signup", { method: "POST", body: { email: email(), password: PW }, headers: { origin: "https://evil.example" } }));
    expect(res.status).toBe(403);
  });
});
