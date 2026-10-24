import { NextResponse, type NextRequest } from "next/server";
import { normalizeRef } from "@/lib/referral";

// DEMO LEDGER: in-memory, per server instance. Lost on cold start/redeploy and not shared
// across serverless instances. A real product would use a database.
const ledger = new Map<string, { referee: string; at: string }[]>();
const seenReferees = new Set<string>();

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { code?: unknown; referee?: unknown } | null;
  const code = normalizeRef(body?.code);
  const referee = typeof body?.referee === "string" ? body.referee : "";
  if (!code || !/^[A-Za-z0-9]{6,64}$/.test(referee)) return NextResponse.json({ error: "Invalid code or referee" }, { status: 400 });
  if (seenReferees.has(referee)) return NextResponse.json({ ok: true, duplicate: true });
  seenReferees.add(referee);
  const list = ledger.get(code) ?? [];
  list.push({ referee, at: new Date().toISOString() });
  ledger.set(code, list);
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const code = normalizeRef(req.nextUrl.searchParams.get("code"));
  if (!code) return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  return NextResponse.json({ redemptions: ledger.get(code) ?? [] }, { headers: { "cache-control": "no-store" } });
}
