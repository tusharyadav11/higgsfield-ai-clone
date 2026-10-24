import { generate } from "@/lib/generate";
import { ASPECTS, getModel, type Aspect } from "@/lib/models";

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
  try {
    const out = await generate({ kind, model: m.id, prompt: p, aspect: aspect as Aspect });
    return Response.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Generation failed" }, { status: 500 });
  }
}
