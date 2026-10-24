import { generate } from "@/lib/generate";
import { hasDb } from "@/db";
import { ASPECTS, getModel, type Aspect } from "@/lib/models";

import { getSessionUser, readCookie } from "@/server/auth";
import { chargedGenerate } from "@/server/credits";
import { sameOrigin } from "@/server/http";

const bad = (error: string) =>
  Response.json({ error }, { status: 400, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body");
  }
  if (!body || typeof body !== "object") return bad("Invalid body");
  const { kind, model, prompt, aspect } = body as Record<string, unknown>;
  if (kind !== "image" && kind !== "video") return bad("kind must be image or video");
  if (typeof prompt !== "string") return bad("prompt is required");
  const p = prompt.trim();
  if (p.length < 1 || p.length > 500) return bad("prompt must be 1-500 characters");
  const m = typeof model === "string" ? getModel(model) : undefined;
  if (!m) return bad("Unknown model");
  if (m.kind !== kind) return bad("Model does not match kind");
  if (typeof aspect !== "string" || !ASPECTS.includes(aspect as Aspect)) return bad("Invalid aspect");
  // Signed-in users are charged server-side (atomic ledger); guests keep the client-side flow.
  if (hasDb() && readCookie(req)) {
    if (!sameOrigin(req)) return Response.json({ error: "Cross-origin request blocked" }, { status: 403 });
    try {
      const u = await getSessionUser(req);
      if (u) {
        const r = await chargedGenerate(u.id, { kind, model: m.id, prompt: p, aspect: aspect as Aspect }, req.signal);
        const h = { "Cache-Control": "no-store" };
        if (!r.ok) return Response.json({ error: r.error, balance: r.balance }, { status: r.status, headers: h });
        return Response.json({ ...r.generation, balance: r.balance }, { headers: h });
      }
    } catch (e) {
      console.error("[generate]", e);
      return Response.json({ error: "Generation failed" }, { status: 500 });
    }
  }
  try {
    const out = await generate({ kind, model: m.id, prompt: p, aspect: aspect as Aspect });
    return Response.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Generation failed" }, { status: 500 });
  }
}
