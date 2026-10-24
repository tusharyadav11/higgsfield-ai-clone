import { NextResponse, type NextRequest } from "next/server";
import { db, hasDb, t } from "@/db";
import { sameOrigin } from "@/server/http";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const name = str(b.name, 100), email = str(b.email, 200), company = str(b.company, 150), useCase = str(b.useCase, 2000);
  const size = Number(b.size);
  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "Enter your name.";
  if (!EMAIL.test(email)) errors.email = "Enter a valid work email.";
  if (!company) errors.company = "Enter your company.";
  if (useCase.length < 10) errors.useCase = "Tell us a bit more (10+ characters).";
  if (!Number.isFinite(size) || size < 1 || size > 100000) errors.size = "Invalid team size.";
  if (Object.keys(errors).length) return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
  if (hasDb()) {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
    try {
      const [row] = await db().insert(t.quotes).values({ name, email: email.toLowerCase(), company, teamSize: Math.floor(size), useCase }).returning({ id: t.quotes.id });
      return NextResponse.json({ reference: `Q-${row.id.slice(0, 8).toUpperCase()}`, stored: true }, { status: 201 });
    } catch (e) {
      console.error("[quote]", e);
      return NextResponse.json({ error: "Could not save your request. Please try again." }, { status: 500 });
    }
  }
  const reference = `Q-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  // No database: no CRM or email. The request is only logged.
  console.log("[quote]", JSON.stringify({ reference, name, email, company, size, useCase }));
  return NextResponse.json({ reference }, { status: 201 });
}
