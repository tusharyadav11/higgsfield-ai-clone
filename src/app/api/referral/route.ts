import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, hasDb, t } from "@/db";
import { normalizeRef } from "@/lib/referral";
import { getSessionUser } from "@/server/auth";
import { sameOrigin } from "@/server/http";

// Backed by Postgres. Without DATABASE_URL the route answers 503 {demo:true} and the client
// falls back to its local-only demo ledger.
const off = () => NextResponse.json({ error: "Referrals are local-only in demo mode", demo: true }, { status: 503 });

/** POST {code}: the signed-in user redeems a code after the fact (signup normally does this atomically). Idempotent. */
export async function POST(req: NextRequest) {
  if (!hasDb()) return off();
  if (!sameOrigin(req)) return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
  const code = normalizeRef(body?.code);
  if (!code) return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  const u = await getSessionUser(req);
  if (!u) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  return NextResponse.json({ ok: true, duplicate: true, note: "Referral codes are redeemed at signup" });
}

/** GET ?code= : redemptions of a code (anonymised ids). Signed-in owners only see their own code. */
export async function GET(req: NextRequest) {
  const code = normalizeRef(req.nextUrl.searchParams.get("code"));
  if (!code) return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  if (!hasDb()) return off();
  const u = await getSessionUser(req);
  if (!u || u.referralCode !== code) return NextResponse.json({ redemptions: [] }, { headers: { "cache-control": "no-store" } });
  const rows = await db()
    .select({ id: t.referrals.referredId, at: t.referrals.createdAt })
    .from(t.referrals)
    .innerJoin(t.users, eq(t.users.id, t.referrals.referrerId))
    .where(eq(t.users.referralCode, code));
  return NextResponse.json(
    { redemptions: rows.map((r) => ({ referee: r.id.replace(/-/g, "").slice(0, 8), at: r.at.toISOString() })) },
    { headers: { "cache-control": "no-store" } },
  );
}
