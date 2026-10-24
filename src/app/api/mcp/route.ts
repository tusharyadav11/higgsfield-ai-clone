import { hasDb } from "@/db";
import { lookupKey } from "@/server/keys";
import { bearerKey, handleMessage, E, TOOLS, type RpcResponse } from "@/lib/mcp/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Accept",
  "Cache-Control": "no-store",
};

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });
const perr = (code: number, message: string): RpcResponse => ({ jsonrpc: "2.0", id: null, error: { code, message } });

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(perr(E.PARSE, "Parse error: body is not valid JSON"), 400);
  }
  const key = bearerKey(req);
  const ctx: { origin: string; userId?: string | null; revoked?: boolean } = { origin: new URL(req.url).origin };
  if (key && hasDb()) {
    try {
      const k = await lookupKey(key);
      if (k === "revoked") ctx.revoked = true;
      else if (k) ctx.userId = k.userId;
      else if (process.env.MCP_REQUIRE_REAL_KEYS === "1") ctx.revoked = true;
    } catch (e) {
      console.error("[mcp] key lookup failed, falling back to demo mode", e);
    }
  }

  if (Array.isArray(body)) {
    if (!body.length) return json(perr(E.INVALID, "Invalid Request: empty batch"), 400);
    if (body.length > 20) return json(perr(E.INVALID, "Batch too large (max 20)"), 400);
    const out = (await Promise.all(body.map((m) => handleMessage(m, key, ctx)))).map((r) => r.res).filter((r): r is RpcResponse => !!r);
    return out.length ? json(out) : new Response(null, { status: 202, headers: CORS });
  }

  const { res, status } = await handleMessage(body, key, ctx);
  if (!res) return new Response(null, { status: 202, headers: CORS });
  return json(res, res.error?.code === E.INVALID ? 400 : (status ?? 200));
}

export function GET() {
  return json(
    {
      name: "kinetic",
      transport: "streamable-http (POST JSON-RPC 2.0; no SSE stream)",
      usage: "POST JSON-RPC to this URL. tools/list is open; tools/call needs 'Authorization: Bearer kn_<key>'. Create a key at /connect.",
      tools: TOOLS.map((t) => t.name),
    },
    405,
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
