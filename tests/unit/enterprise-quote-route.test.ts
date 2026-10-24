import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import postgres from "postgres";
import { POST } from "../../src/app/api/quote/route";

const TEST_URL = process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/kinetic_test";
const saved = { url: process.env.DATABASE_URL, rl: process.env.QUOTE_RATE_LIMIT };
const good = { name: "Ada Lovelace", email: "ada@route-test.example", company: "Route Test", teamSize: 30, useCaseKind: "studio", billingCycle: "annual", config: { addons: { "20k": 1 } }, expectedCredits: 50000, message: "hello" };
let n = 0;
const call = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new NextRequest("http://localhost/api/quote", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "content-type": "application/json", "x-forwarded-for": `10.9.${Math.floor(++n / 250)}.${n % 250}`, ...headers } }));

afterAll(() => {
  if (saved.url === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = saved.url;
  if (saved.rl === undefined) delete process.env.QUOTE_RATE_LIMIT;
});

describe("POST /api/quote without a database", () => {
  beforeAll(() => {
    delete process.env.DATABASE_URL;
  });
  it("is honest: validated, but explicitly not stored", async () => {
    const r = await call(good);
    expect(r.status).toBe(201);
    const j = await r.json();
    expect(j).toMatchObject({ stored: false, demo: true, kind: "quote" });
    expect(j.reference).toMatch(/^Q-DEMO-/);
  });
  it("rejects bad JSON, bad fields, cross-origin and oversized bodies", async () => {
    expect((await call("{nope")).status).toBe(400);
    const bad = await call({ ...good, email: "x" });
    expect(bad.status).toBe(400);
    expect((await bad.json()).errors.email).toBeTruthy();
    expect((await call(good, { origin: "http://evil.example" })).status).toBe(403);
    expect((await call({ ...good, message: "x".repeat(20000) })).status).toBe(413);
  });
  it("honeypot gets a fake success and nothing real", async () => {
    const j = await (await call({ ...good, website: "http://spam" })).json();
    expect(j.stored).toBe(false);
    expect(j.demo).toBe(false);
  });
  it("rate-limits one IP", async () => {
    process.env.QUOTE_RATE_LIMIT = "3";
    const h = { "x-forwarded-for": "172.16.0.77" };
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await call(good, h)).status);
    delete process.env.QUOTE_RATE_LIMIT;
    expect(codes).toEqual([201, 201, 201, 429, 429]);
  });
});

describe("POST /api/quote with the test database", () => {
  let sql: ReturnType<typeof postgres> | null = null;
  beforeAll(async () => {
    try {
      const s = postgres(TEST_URL, { max: 1, connect_timeout: 3, onnotice: () => {} });
      await s`select 1 from quotes limit 1`;
      sql = s;
      process.env.DATABASE_URL = TEST_URL;
    } catch {
      sql = null;
    }
  });
  afterAll(async () => {
    if (sql) {
      await sql`delete from quotes where email like '%@route-test.example'`;
      await sql.end({ timeout: 2 });
    }
  });
  it("stores quote and demo with the new columns", async () => {
    if (!sql) return;
    const q = await (await call({ ...good, email: "q1@route-test.example" })).json();
    expect(q).toMatchObject({ stored: true, demo: false, kind: "quote" });
    expect(q.reference).toMatch(/^Q-[0-9A-F]{8}$/);
    const d = await (await call({ kind: "demo", name: "Dee Mo", email: "d1@route-test.example", company: "Route Test", window: "weekday-morning", timezone: "UTC" })).json();
    expect(d.reference).toMatch(/^D-[0-9A-F]{8}$/);
    const rows = await sql`select kind, team_size, expected_credits, billing_cycle, message, use_case, config from quotes where email like '%@route-test.example' order by kind`;
    expect(rows).toHaveLength(2);
    const dm = rows.find((r) => r.kind === "demo")!;
    expect(dm.config.demo).toEqual({ window: "weekday-morning", timezone: "UTC" });
    const qu = rows.find((r) => r.kind === "quote")!;
    expect(qu).toMatchObject({ team_size: 30, expected_credits: 50000, billing_cycle: "annual", message: "hello", use_case: "Film, game or animation studio" });
    expect(qu.config.addons).toEqual({ "20k": 1 });
    expect(qu.config.indicative.annualTotalCents).toBe(qu.config.indicative.monthlyTotalCents * 12);
  });
});
