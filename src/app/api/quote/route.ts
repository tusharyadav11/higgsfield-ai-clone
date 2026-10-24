import { NextResponse, type NextRequest } from "next/server";
import { db, hasDb, t } from "@/db";
import { sameOrigin } from "@/server/http";
import { rateLimit, validateQuote } from "@/lib/enterprise/quote";

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_BODY = 16_000;

const clientIp = (req: NextRequest) =>
  (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim().slice(0, 64) || "local";

const out = (body: unknown, status: number, extra: Record<string, string> = {}) => NextResponse.json(body, { status, headers: { ...NO_STORE, ...extra } });

/**
 * Quote and demo requests. Honest by construction:
 *  - with a database the request is stored (`stored: true`); there is no email or CRM integration
 *  - without one nothing is stored and the response says so (`stored: false, demo: true`)
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return out({ error: "Cross-origin request blocked" }, 403);
  const text = await req.text().catch(() => "");
  if (text.length > MAX_BODY) return out({ error: "Request too large" }, 413);
  let b: Record<string, unknown> | null = null;
  try {
    const j = JSON.parse(text);
    b = j && typeof j === "object" && !Array.isArray(j) ? (j as Record<string, unknown>) : null;
  } catch {}
  if (!b) return out({ error: "Invalid JSON" }, 400);

  const rl = rateLimit(clientIp(req), Date.now(), { max: Number(process.env.QUOTE_RATE_LIMIT) || 8 });
  if (!rl.ok) return out({ error: "Too many requests. Please try again in a few minutes.", retryAfter: rl.retryAfter }, 429, { "Retry-After": String(rl.retryAfter) });

  // honeypot: real people never fill this hidden field. Pretend success, store nothing.
  if (typeof b.website === "string" && b.website.trim() !== "") {
    return out({ reference: `Q-${Math.random().toString(36).slice(2, 10).toUpperCase()}`, stored: false, demo: false, kind: "quote" }, 201);
  }

  const v = validateQuote(b);
  if (!v.ok) return out({ error: "Validation failed", errors: v.errors }, 400);
  const q = v.value;
  const prefix = q.kind === "demo" ? "D" : "Q";

  if (!hasDb()) {
    // No database: nothing is stored, emailed or forwarded. Say so.
    const reference = `${prefix}-DEMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    console.log("[quote] demo mode, not stored", JSON.stringify({ reference, kind: q.kind, seats: q.teamSize }));
    return out({ reference, stored: false, demo: true, kind: q.kind }, 201);
  }
  try {
    const [row] = await db()
      .insert(t.quotes)
      .values({
        name: q.name,
        email: q.email.toLowerCase(),
        company: q.company,
        teamSize: q.teamSize,
        useCase: q.useCase,
        expectedCredits: q.expectedCredits,
        message: q.message,
        billingCycle: q.billingCycle,
        config: q.config,
        kind: q.kind,
      })
      .returning({ id: t.quotes.id });
    return out({ reference: `${prefix}-${row.id.slice(0, 8).toUpperCase()}`, stored: true, demo: false, kind: q.kind }, 201);
  } catch (e) {
    console.error("[quote]", e);
    return out({ error: "Could not save your request. Please try again." }, 500);
  }
}
