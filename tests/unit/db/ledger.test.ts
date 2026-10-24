import "./env";
import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "../../../src/db";
import { dbAvailable, me, req, signupUser, truncateAll } from "./helpers";

const gen = vi.hoisted(() => ({ fail: false }));
vi.mock("@/lib/generate", async (orig) => {
  const real = await orig<typeof import("../../../src/lib/generate")>();
  return {
    ...real,
    generate: async (i: { kind: string; model: string; prompt: string; aspect: string }) => {
      await new Promise((r) => setTimeout(r, 20));
      if (gen.fail) throw new Error("provider down");
      return { ...i, id: "x", url: "/media/x.png", createdAt: new Date().toISOString() };
    },
  };
});

import { POST as claimRoute } from "../../../src/app/api/me/claim/route";
import { POST as generateRoute } from "../../../src/app/api/generate/route";
import { POST as likeRoute } from "../../../src/app/api/me/like/route";
import { DELETE as delLib } from "../../../src/app/api/me/library/[id]/route";
import { POST as keysRoute } from "../../../src/app/api/me/keys/route";
import { DELETE as delKey } from "../../../src/app/api/me/keys/[id]/route";
import { POST as mcpRoute } from "../../../src/app/api/mcp/route";
import { POST as importRoute } from "../../../src/app/api/me/import/route";
import { POST as promoRoute } from "../../../src/app/api/me/promo/route";
import { POST as quoteRoute } from "../../../src/app/api/quote/route";
import { claimDaily } from "../../../src/server/credits";

const ok = await dbAvailable();
const d = ok ? describe : describe.skip;
const IMG = { kind: "image", model: "", prompt: "a fox", aspect: "1:1" };
const post = (path: string, token: string | null, body?: unknown) => req(path, { method: "POST", cookie: token, body: body ?? {} });

async function imageModel() {
  const { MODELS } = await import("../../../src/lib/models");
  return MODELS.filter((m) => m.kind === "image").sort((a, b) => a.credits - b.credits)[0];
}
const setBalance = async (userId: string, target: number) => {
  const cur = ((await db().execute(sql`select coalesce(sum(delta),0)::int as b from credit_ledger where user_id = ${userId}`)) as unknown as { b: number }[])[0].b;
  await db().execute(sql`insert into credit_ledger (user_id, delta, reason, ref) values (${userId}, ${target - cur}, 'test', ${String(Math.random())})`);
};

d("referrals", () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it("grants both sides exactly once, via the ledger", async () => {
    const a = await signupUser();
    const b = await signupUser({ ref: a.user.referralCode });
    expect(b.body.referred).toBe(true);
    expect((await me(b.token)).balance).toBe(25 + 20);
    const ma = await me(a.token);
    expect(ma.balance).toBe(25 + 30); // lands immediately, no page-open sync
    expect(ma.referrals.count).toBe(1);
    // replaying the grants is a no-op (unique ledger key)
    await db().execute(sql`insert into credit_ledger (user_id, delta, reason, ref) select referrer_id, 30, 'referral_invited', referred_id::text from referrals on conflict do nothing`);
    expect((await me(a.token)).balance).toBe(55);
  });

  it("ignores unknown codes and malformed codes", async () => {
    const x = await signupUser({ ref: "KZZZZZZ" });
    const y = await signupUser({ ref: "not-a-code" });
    expect((await me(x.token)).balance).toBe(25);
    expect((await me(y.token)).balance).toBe(25);
    expect(x.body.referred).toBe(false);
  });

  it("a user cannot redeem their own code (self-referral)", async () => {
    // signup creates the user first, so a code can never point at the new user; verify nothing is granted
    const a = await signupUser();
    const { rows } = { rows: (await db().execute(sql`select count(*)::int as n from referrals`)) as unknown as { n: number }[] };
    expect(rows[0].n).toBe(0);
    expect((await me(a.token)).balance).toBe(25);
  });
});

d("daily claim", () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it("10 concurrent claims grant exactly once", async () => {
    const { token, user } = await signupUser();
    const rs = await Promise.all(Array.from({ length: 10 }, () => claimRoute(post("/api/me/claim", token))));
    const bodies = await Promise.all(rs.map((r) => r.json()));
    expect(bodies.filter((b) => b.ok)).toHaveLength(1);
    const m = await me(token);
    expect(m.balance).toBe(25 + 10);
    expect(m.streak).toBe(1);
    const n = ((await db().execute(sql`select count(*)::int as n from credit_ledger where user_id = ${user.id} and reason = 'daily'`)) as unknown as { n: number }[])[0].n;
    expect(n).toBe(1);
  });

  it("continues the streak next day, resets after a gap, and uses the client's bonus formula", async () => {
    const { user } = await signupUser();
    const day = (n: number) => new Date(Date.UTC(2030, 0, n, 12));
    expect((await claimDaily(user.id, day(1))).gained).toBe(10);
    expect((await claimDaily(user.id, day(2))).gained).toBe(15);
    expect((await claimDaily(user.id, day(2))).ok).toBe(false);
    const third = await claimDaily(user.id, day(3));
    expect(third.streak).toBe(3);
    expect(third.gained).toBe(20);
    const reset = await claimDaily(user.id, day(9));
    expect(reset.streak).toBe(1);
    expect(reset.gained).toBe(10);
  });
});

d("generate (server-charged)", () => {
  beforeEach(async () => {
    gen.fail = false;
    await truncateAll();
  });
  afterAll(truncateAll);

  it("charges once, saves to the library, returns the balance", async () => {
    const m = await imageModel();
    const { token } = await signupUser();
    const res = await generateRoute(post("/api/generate", token, { ...IMG, model: m.id }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.balance).toBe(25 - m.credits);
    const s = await me(token);
    expect(s.balance).toBe(25 - m.credits);
    expect(s.library.map((l: { id: string }) => l.id)).toEqual([body.id]);
  });

  it("insufficient credits -> 402 and nothing is charged", async () => {
    const m = await imageModel();
    const { token, user } = await signupUser();
    await setBalance(user.id, m.credits - 1);
    const res = await generateRoute(post("/api/generate", token, { ...IMG, model: m.id }));
    expect(res.status).toBe(402);
    expect((await res.json()).error).toMatch(/credits/i);
    expect((await me(token)).balance).toBe(m.credits - 1);
  });

  it("concurrent generates never overspend: balance stays >= 0", async () => {
    const m = await imageModel();
    const { token, user } = await signupUser();
    await setBalance(user.id, m.credits * 3 + 1);
    const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => generateRoute(post("/api/generate", token, { ...IMG, model: m.id, prompt: "p" + i }))));
    const codes = rs.map((r) => r.status);
    expect(codes.filter((c) => c === 200)).toHaveLength(3);
    expect(codes.filter((c) => c === 402)).toHaveLength(7);
    expect((await me(token)).balance).toBe(1);
  });

  it("refunds when the provider fails", async () => {
    const m = await imageModel();
    const { token } = await signupUser();
    gen.fail = true;
    const res = await generateRoute(post("/api/generate", token, { ...IMG, model: m.id }));
    expect(res.status).toBe(500);
    expect((await res.json()).balance).toBe(25);
    const s = await me(token);
    expect(s.balance).toBe(25);
    expect(s.library).toHaveLength(0);
    const reasons = ((await db().execute(sql`select reason from credit_ledger order by created_at, reason`)) as unknown as { reason: string }[]).map((r) => r.reason);
    expect(reasons).toEqual(expect.arrayContaining(["generate", "refund", "signup"]));
  });

  it("guests (no cookie) keep the old, uncharged response shape", async () => {
    const m = await imageModel();
    const res = await generateRoute(req("/api/generate", { method: "POST", body: { ...IMG, model: m.id } }));
    expect(res.status).toBe(200);
    expect(await res.json()).not.toHaveProperty("balance");
  });
});

d("keys, MCP and isolation", () => {
  beforeEach(async () => {
    gen.fail = false;
    await truncateAll();
  });
  afterAll(truncateAll);

  const mcp = (key: string, name = "generate_image", args: object = {}) =>
    mcpRoute(new Request("http://localhost:3000/api/mcp", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) })).then((r) => r.json());

  it("key plaintext is shown once, only a hash is stored, generate_* is billed to the owner, revoke is real", async () => {
    const m = await imageModel();
    const { token, user } = await signupUser();
    const created = await (await keysRoute(post("/api/me/keys", token))).json();
    expect(created.key).toMatch(/^kn_[0-9a-f]{32}$/);
    const rows = (await db().execute(sql`select key_hash, prefix from api_keys`)) as unknown as { key_hash: string; prefix: string }[];
    expect(rows[0].key_hash).not.toContain(created.key);
    expect(created.key.startsWith(rows[0].prefix)).toBe(true);
    expect(JSON.stringify(await me(token))).not.toContain(created.key);

    const r = await mcp(created.key, "generate_image", { model: m.id, prompt: "mcp fox" });
    expect(r.result.isError).toBeUndefined();
    expect((await me(token)).balance).toBe(25 - m.credits);
    expect((await me(token)).library).toHaveLength(1);

    await setBalance(user.id, 0);
    const broke = await mcp(created.key, "generate_image", { model: m.id, prompt: "mcp fox 2" });
    expect(broke.result.isError).toBe(true);
    expect(broke.result.content[0].text).toMatch(/insufficient/i);

    const del = await delKey(req(`/api/me/keys/${created.id}`, { method: "DELETE", cookie: token }), { params: Promise.resolve({ id: created.id }) });
    expect(del.status).toBe(200);
    const after = await mcp(created.key, "list_models");
    expect(after.error.message).toMatch(/revoked/i);
  });

  it("unknown well-formed keys stay demo keys: they work but never touch a ledger", async () => {
    const m = await imageModel();
    const { token } = await signupUser();
    const r = await mcp("kn_" + "a".repeat(32), "generate_image", { model: m.id, prompt: "demo" });
    expect(r.result.isError).toBeUndefined();
    expect((await me(token)).balance).toBe(25);
  });

  it("user A cannot delete, like, or read user B's data", async () => {
    const m = await imageModel();
    const A = await signupUser();
    const B = await signupUser();
    const g = await (await generateRoute(post("/api/generate", B.token, { ...IMG, model: m.id }))).json();
    await likeRoute(post("/api/me/like", B.token, { postId: "p1" }));
    const key = await (await keysRoute(post("/api/me/keys", B.token))).json();

    // A cannot delete B's generation or revoke B's key
    expect((await delLib(req(`/api/me/library/${g.id}`, { method: "DELETE", cookie: A.token }), { params: Promise.resolve({ id: g.id }) })).status).toBe(404);
    expect((await delKey(req(`/api/me/keys/${key.id}`, { method: "DELETE", cookie: A.token }), { params: Promise.resolve({ id: key.id }) })).status).toBe(404);
    // A's likes are A's own
    const liked = await (await likeRoute(post("/api/me/like", A.token, { postId: "p1" }))).json();
    expect(liked.liked).toBe(true);
    const mb = await me(B.token);
    expect(mb.library).toHaveLength(1);
    expect(mb.likes).toEqual(["p1"]);
    expect(mb.keys).toHaveLength(1);
    // A's state never contains B's data
    const ma = await me(A.token);
    expect(ma.library).toHaveLength(0);
    expect(ma.keys).toHaveLength(0);
    // unauthenticated -> 401
    expect((await likeRoute(post("/api/me/like", null, { postId: "p1" }))).status).toBe(401);
    // like toggles off
    expect((await (await likeRoute(post("/api/me/like", A.token, { postId: "p1" }))).json()).liked).toBe(false);
    // owner can delete
    expect((await delLib(req(`/api/me/library/${g.id}`, { method: "DELETE", cookie: B.token }), { params: Promise.resolve({ id: g.id }) })).status).toBe(200);
  });

  it("guest import is idempotent, capped and validated", async () => {
    const { token } = await signupUser();
    const lib = Array.from({ length: 80 }, (_, i) => ({ id: `gen_local${i}`, url: "/media/a.png", kind: "image", prompt: "p" + i, model: "m", aspect: "1:1", createdAt: new Date().toISOString() }));
    lib.push({ id: "bad", url: "javascript:alert(1)", kind: "image", prompt: "x", model: "m", aspect: "1:1", createdAt: "" });
    const body = { library: lib, credits: 1_000_000, likes: ["a", "b"] };
    const r1 = await (await importRoute(post("/api/me/import", token, body))).json();
    expect(r1.imported).toBe(60);
    expect(r1.granted).toBe(50);
    const r2 = await (await importRoute(post("/api/me/import", token, body))).json();
    expect(r2.imported).toBe(0);
    expect(r2.granted).toBe(0);
    const s = await me(token);
    expect(s.balance).toBe(25 + 50);
    expect(s.library).toHaveLength(60);
    expect(s.likes.sort()).toEqual(["a", "b"]);
  });

  it("promo redemption is recorded; WELCOME20 works for a new account; quote persists", async () => {
    const { token } = await signupUser();
    const r = await promoRoute(post("/api/me/promo", token, { code: "welcome20" }));
    expect(r.status).toBe(200);
    expect((await promoRoute(post("/api/me/promo", token, { code: "nope" }))).status).toBe(400);
    expect((await me(token)).promos.map((p: { code: string }) => p.code)).toEqual(["WELCOME20"]);
    const q = await quoteRoute(new Request("http://localhost:3000/api/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Ada", email: "ada@corp.com", company: "Corp", size: 40, useCase: "Campaign visuals at scale" }) }) as never);
    expect(q.status).toBe(201);
    const { reference } = await q.json();
    expect(reference).toMatch(/^Q-[0-9A-F]{8}$/);
    expect(((await db().execute(sql`select count(*)::int as n from quotes`)) as unknown as { n: number }[])[0].n).toBe(1);
  });
});
