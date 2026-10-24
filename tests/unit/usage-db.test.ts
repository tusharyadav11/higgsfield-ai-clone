import "./db/env";
import { beforeEach, afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "../../src/db";
import { dbAvailable, req, signupUser, truncateAll } from "./db/helpers";
import { GET as usageRoute } from "../../src/app/api/me/usage/route";

const ok = await dbAvailable();
const d = ok ? describe : describe.skip;

d("GET /api/me/usage", () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it("requires a session and a valid range", async () => {
    expect((await usageRoute(req("/api/me/usage"))).status).toBe(401);
    const u = await signupUser();
    expect((await usageRoute(req("/api/me/usage?range=1y", { cookie: u.token }))).status).toBe(400);
  });

  it("aggregates the ledger joined to generations, netting refunds", async () => {
    const u = await signupUser();
    const id = u.user.id;
    await db().execute(sql`insert into generations (id, user_id, kind, model, prompt, aspect, url) values ('g1', ${id}, 'video', 'veo-lite', 'p', '16:9', '/x.mp4')`);
    await db().execute(sql`insert into credit_ledger (user_id, delta, reason, ref) values (${id}, -15, 'generate', 'g1'), (${id}, -10, 'generate', 'g2'), (${id}, 10, 'refund', 'g2')`);
    const res = await usageRoute(req("/api/me/usage?range=7d", { cookie: u.token }));
    expect(res.status).toBe(200);
    const s = await res.json();
    expect(s.spent).toBe(15);
    expect(s.generations).toBe(1);
    expect(s.balance).toBe(25 - 15);
    expect(s.models[0]).toMatchObject({ id: "veo-lite", spent: 15, count: 1 });
    expect(s.tools.find((t: { tool: string }) => t.tool === "video").spent).toBe(15);
    expect(s.grants).toEqual([{ reason: "signup", label: "Signup bonus", amount: 25 }]);
    expect(s.days).toHaveLength(7);
  });
});
