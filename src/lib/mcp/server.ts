import { generate } from "@/lib/generate";
import { ASPECTS, MODELS, getModel, type Aspect, type Kind } from "@/lib/models";
import { getPosts } from "@/lib/seed";

/**
 * Minimal MCP server over Streamable HTTP (JSON responses only, no SSE, stateless).
 * Auth: with a database, a key issued from /connect is resolved against api_keys (revoked keys are refused and
 * generate_* calls are charged to the owner's ledger). Any other well-formed key is a DEMO key: it works, charges nobody.
 */
export const KEY_RE = /^kn_[a-z0-9]{24,}$/;
const SUPPORTED = ["2025-06-18", "2025-03-26", "2024-11-05"];

type Id = string | number | null;
type Msg = { jsonrpc?: unknown; id?: Id; method?: unknown; params?: unknown };
export type RpcResponse = { jsonrpc: "2.0"; id: Id; result?: unknown; error?: { code: number; message: string; data?: unknown } };

export const E = { PARSE: -32700, INVALID: -32600, METHOD: -32601, PARAMS: -32602, INTERNAL: -32603, UNAUTH: -32001, RATE: -32029 };

const err = (id: Id, code: number, message: string, data?: unknown): RpcResponse => ({
  jsonrpc: "2.0", id, error: { code, message, ...(data !== undefined ? { data } : {}) },
});
const ok = (id: Id, result: unknown): RpcResponse => ({ jsonrpc: "2.0", id, result });

/* ---- per-key in-memory rate limit: 30 tool calls / minute ---- */
const hits = new Map<string, number[]>();
export const RATE_LIMIT = 30;
function limited(key: string): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  if (arr.length >= RATE_LIMIT) {
    hits.set(key, arr);
    return true;
  }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return false;
}

const text = (v: unknown, isError = false) => ({
  content: [{ type: "text", text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }],
  ...(isError ? { isError: true } : {}),
});

const genSchema = (kind: Kind) => ({
  type: "object",
  properties: {
    prompt: { type: "string", minLength: 1, maxLength: 500, description: "What to create (1-500 chars)" },
    model: { type: "string", enum: MODELS.filter((m) => m.kind === kind).map((m) => m.id), description: "Model id from list_models" },
    aspect: { type: "string", enum: ASPECTS, default: "1:1" },
  },
  required: ["prompt", "model"],
  additionalProperties: false,
});

export const TOOLS = [
  { name: "list_models", description: "List available image and video models with credit cost and speed.", inputSchema: { type: "object", properties: { kind: { type: "string", enum: ["image", "video"] } }, additionalProperties: false } },
  { name: "search_community", description: "Search community posts by free-text query and/or tag. Returns prompts you can remix.", inputSchema: { type: "object", properties: { query: { type: "string" }, tag: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 24, default: 8 } }, additionalProperties: false } },
  { name: "generate_image", description: "Generate an image (costs credits on the user's account in the app; the demo provider is a mock unless FAL_KEY is configured).", inputSchema: genSchema("image") },
  { name: "generate_video", description: "Generate a video clip (mock provider unless FAL_KEY is configured).", inputSchema: genSchema("video") },
  { name: "get_remix_prompt", description: "Get the full prompt, model and settings of a community post, plus a link to remix it in the studio.", inputSchema: { type: "object", properties: { postId: { type: "string" } }, required: ["postId"], additionalProperties: false } },
  { name: "explain_pricing", description: "Explain plans and per-model credit costs.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
];

/** userId: key resolved to a real account (credits are charged to it). revoked: key was revoked. */
type Ctx = { origin: string; userId?: string | null; revoked?: boolean };
type Args = Record<string, unknown>;

async function callTool(name: string, a: Args, ctx: Ctx) {
  switch (name) {
    case "list_models": {
      if (a.kind !== undefined && a.kind !== "image" && a.kind !== "video") return text("kind must be image or video", true);
      return text(MODELS.filter((m) => !a.kind || m.kind === a.kind));
    }
    case "search_community": {
      const q = typeof a.query === "string" ? a.query.trim().toLowerCase() : "";
      const tag = typeof a.tag === "string" ? a.tag.trim().toLowerCase() : "";
      const limit = Math.min(24, Math.max(1, Number.isInteger(a.limit) ? (a.limit as number) : 8));
      const items = getPosts()
        .filter((p) => (!tag || p.tags.includes(tag)) && (!q || `${p.title} ${p.prompt} ${p.tags.join(" ")}`.toLowerCase().includes(q)))
        .slice(0, limit)
        .map((p) => ({ id: p.id, title: p.title, kind: p.kind, model: p.model, aspect: p.aspect, tags: p.tags, likes: p.likes, remixes: p.remixes, prompt: p.prompt }));
      return text({ count: items.length, items });
    }
    case "generate_image":
    case "generate_video": {
      const kind: Kind = name === "generate_image" ? "image" : "video";
      if (typeof a.prompt !== "string") return text("prompt is required", true);
      const prompt = a.prompt.trim();
      if (prompt.length < 1 || prompt.length > 500) return text("prompt must be 1-500 characters", true);
      const m = typeof a.model === "string" ? getModel(a.model) : undefined;
      if (!m) return text("Unknown model. Call list_models.", true);
      if (m.kind !== kind) return text(`Model ${m.id} is a ${m.kind} model; use generate_${m.kind}.`, true);
      const aspect = a.aspect === undefined ? "1:1" : a.aspect;
      if (typeof aspect !== "string" || !ASPECTS.includes(aspect as Aspect)) return text(`aspect must be one of ${ASPECTS.join(", ")}`, true);
      if (ctx.userId) {
        const { chargedGenerate } = await import("@/server/credits");
        const r = await chargedGenerate(ctx.userId, { kind, model: m.id, prompt, aspect: aspect as Aspect });
        if (!r.ok) return text(r.status === 402 ? `Insufficient credits (balance ${r.balance}, needs ${m.credits}). Top up at ${ctx.origin}/pricing.` : r.error, true);
        const g = r.generation;
        return text({
          id: g.id, kind: g.kind, model: g.model, aspect: g.aspect, prompt: g.prompt, createdAt: g.createdAt, credits: m.credits, balance: r.balance,
          url: g.url.startsWith("/") ? `${ctx.origin}${g.url}` : g.url,
          openInStudio: `${ctx.origin}/library`,
        });
      }
      const g = await generate({ kind, model: m.id, prompt, aspect: aspect as Aspect });
      const remote = g.url.startsWith("http");
      return text({
        id: g.id, kind: g.kind, model: g.model, aspect: g.aspect, prompt: g.prompt, createdAt: g.createdAt, credits: m.credits,
        url: remote ? g.url : null,
        note: remote ? undefined : "Demo mock provider: art is generated in-browser. Open the studio link to view it.",
        openInStudio: `${ctx.origin}/create?${new URLSearchParams({ prompt, model: m.id }).toString()}`,
      });
    }
    case "get_remix_prompt": {
      const p = typeof a.postId === "string" ? getPosts().find((x) => x.id === a.postId) : undefined;
      if (!p) return text("No post with that id. Use search_community.", true);
      return text({ id: p.id, title: p.title, prompt: p.prompt, model: p.model, kind: p.kind, aspect: p.aspect, remixUrl: `${ctx.origin}/create?remix=${p.id}&${new URLSearchParams({ prompt: p.prompt, model: p.model }).toString()}` });
    }
    case "explain_pricing":
      return text({
        summary: "New accounts start with 50 free credits and can claim a daily streak bonus. Paid plans (Free / Pro / Studio) are on /pricing.",
        pricingPage: `${ctx.origin}/pricing`,
        perGeneration: MODELS.map((m) => ({ model: m.id, kind: m.kind, credits: m.credits })),
        note: "Failed generations are refunded automatically.",
      });
    default:
      return null;
  }
}

export function bearerKey(req: Request): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  return m && KEY_RE.test(m[1]) ? m[1] : null;
}

/** Returns null for notifications (no response expected). */
export async function handleMessage(raw: unknown, key: string | null, ctx: Ctx): Promise<{ res: RpcResponse | null; status?: number }> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { res: err(null, E.INVALID, "Invalid Request") };
  const m = raw as Msg;
  const hasId = "id" in m && m.id !== undefined;
  const id: Id = hasId && (typeof m.id === "string" || typeof m.id === "number" || m.id === null) ? (m.id as Id) : null;
  if (m.jsonrpc !== "2.0" || typeof m.method !== "string" || (hasId && id === null && m.id !== null)) return { res: err(id, E.INVALID, "Invalid Request") };
  const notify = !hasId;
  const params = (m.params && typeof m.params === "object" ? m.params : {}) as Args;

  try {
    switch (m.method) {
      case "initialize": {
        const want = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
        return { res: ok(id, {
          protocolVersion: SUPPORTED.includes(want) ? want : SUPPORTED[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "kinetic", title: "Kinetic Studio", version: "1.0.0" },
          instructions: "Create AI images/videos and browse community prompts. Send 'Authorization: Bearer kn_...' for tools/call.",
        }) };
      }
      case "ping":
        return { res: notify ? null : ok(id, {}) };
      case "tools/list":
        return { res: ok(id, { tools: TOOLS }) };
      case "tools/call": {
        if (ctx.revoked) return { res: err(id, E.UNAUTH, "Unauthorized: this API key was revoked. Create a new one at /connect.") };
        if (!key) return { res: err(id, E.UNAUTH, "Unauthorized: send 'Authorization: Bearer kn_<key>' (create one at /connect).") };
        if (limited(key)) return { res: err(id, E.RATE, `Rate limit exceeded (${RATE_LIMIT} calls/minute per key).`), status: 429 };
        if (typeof params.name !== "string") return { res: err(id, E.PARAMS, "params.name is required") };
        const args = params.arguments === undefined ? {} : params.arguments;
        if (!args || typeof args !== "object" || Array.isArray(args)) return { res: err(id, E.PARAMS, "params.arguments must be an object") };
        if (!TOOLS.some((t) => t.name === params.name)) return { res: err(id, E.PARAMS, `Unknown tool: ${params.name}`) };
        const out = await callTool(params.name, args as Args, ctx);
        return { res: ok(id, out) };
      }
      default:
        if (notify || m.method.startsWith("notifications/")) return { res: null };
        return { res: err(id, E.METHOD, `Method not found: ${m.method}`) };
    }
  } catch {
    return { res: notify ? null : err(id, E.INTERNAL, "Internal error") };
  }
}
