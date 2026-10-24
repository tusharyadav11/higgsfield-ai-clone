import "./env";
import { sql } from "drizzle-orm";
import { db } from "../../../src/db";

/** globalSetup env mutations are not visible to workers, so probe directly. */
export async function dbAvailable(): Promise<boolean> {
  try {
    await db().execute(sql`select 1 from users limit 1`);
    return true;
  } catch (e) {
    console.warn(`[db tests] skipped: ${(e as Error).message}. Run \`createdb kinetic_test\` and re-run.`);
    return false;
  }
}

export async function truncateAll() {
  await db().execute(sql`truncate table users, quotes restart identity cascade`);
}

const ORIGIN = "http://localhost:3000";

export type Call = { method?: string; body?: unknown; cookie?: string | null; headers?: Record<string, string> };

export function req(path: string, c: Call = {}): Request {
  const headers: Record<string, string> = { origin: ORIGIN, host: "localhost:3000", ...(c.headers ?? {}) };
  if (c.body !== undefined) headers["content-type"] = "application/json";
  if (c.cookie) headers.cookie = `kn_session=${c.cookie}`;
  return new Request(ORIGIN + path, { method: c.method ?? "GET", headers, body: c.body === undefined ? undefined : JSON.stringify(c.body) });
}

export function tokenFrom(res: Response): string | null {
  const sc = res.headers.get("set-cookie") ?? "";
  const m = /kn_session=([^;]*)/.exec(sc);
  return m && m[1] ? m[1] : null;
}

export const PW = "correct horse battery";
let n = 0;
export const email = (tag = "u") => `${tag}${++n}-${Date.now().toString(36)}@example.com`;

export async function signupUser(opts: { email?: string; password?: string; name?: string; ref?: string } = {}) {
  const { POST } = await import("../../../src/app/api/auth/signup/route");
  const e = opts.email ?? email();
  const res = await POST(req("/api/auth/signup", { method: "POST", body: { email: e, password: opts.password ?? PW, name: opts.name, ref: opts.ref } }));
  const body = await res.json();
  return { res, body, token: tokenFrom(res) as string, email: e, user: body.user as { id: string; referralCode: string } };
}

export async function me(token: string | null) {
  const { GET } = await import("../../../src/app/api/me/route");
  const res = await GET(req("/api/me", { cookie: token }));
  return res.json();
}
