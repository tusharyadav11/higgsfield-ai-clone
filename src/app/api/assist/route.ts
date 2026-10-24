import type { NextRequest } from "next/server";
import { localAnswer } from "@/lib/guide/assist";
import { kbPrompt } from "@/lib/guide/kb";

const MAX_INPUT = 500;
const MAX_MSGS = 12;
const MAX_REPLY_CHARS = 700;
const LIMIT = 20; // requests per minute per IP
const hits = new Map<string, number[]>();

function limited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 60_000)) hits.delete(k);
  return arr.length > LIMIT;
}

type Msg = { role: "user" | "assistant"; content: string };

function parse(body: unknown): Msg[] | null {
  const raw = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const msgs: Msg[] = [];
  for (const m of raw.slice(-MAX_MSGS)) {
    const r = (m as { role?: unknown })?.role;
    const c = (m as { content?: unknown })?.content;
    if ((r !== "user" && r !== "assistant") || typeof c !== "string") return null;
    msgs.push({ role: r, content: c.slice(0, 2000) });
  }
  const last = msgs[msgs.length - 1];
  if (last.role !== "user") return null;
  const t = last.content.trim();
  if (!t || last.content.length > MAX_INPUT) return null;
  last.content = t;
  // Anthropic needs the first message to be from the user.
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return msgs;
}

const enc = new TextEncoder();
const sse = (o: unknown) => enc.encode(`data: ${JSON.stringify(o)}\n\n`);
const HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Accel-Buffering": "no",
};

function builtin(question: string): Response {
  const r = localAnswer(question);
  const stream = new ReadableStream({
    async start(c) {
      const words = r.text.split(/(\s+)/);
      for (let i = 0; i < words.length; i += 3) {
        c.enqueue(sse({ t: "delta", text: words.slice(i, i + 3).join("") }));
        await new Promise((res) => setTimeout(res, 15));
      }
      c.enqueue(sse({ t: "done", mode: "builtin", links: r.links }));
      c.close();
    },
  });
  return new Response(stream, { headers: HEADERS });
}

async function ai(msgs: Msg[], key: string, links: ReturnType<typeof localAnswer>["links"]): Promise<Response | null> {
  let up: Response;
  try {
    up = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 300, stream: true, system: kbPrompt(), messages: msgs }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return null;
  }
  if (!up.ok || !up.body) return null;
  const reader = up.body.getReader();
  const dec = new TextDecoder();
  const stream = new ReadableStream({
    async start(c) {
      let buf = "";
      let sent = 0;
      try {
        outer: for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (!line.startsWith("data:")) continue;
            try {
              const j = JSON.parse(line.slice(5));
              if (j.type === "content_block_delta" && j.delta?.type === "text_delta") {
                const text: string = j.delta.text.slice(0, MAX_REPLY_CHARS - sent);
                sent += text.length;
                if (text) c.enqueue(sse({ t: "delta", text }));
                if (sent >= MAX_REPLY_CHARS) break outer;
              }
            } catch {
              /* ignore malformed event */
            }
          }
        }
        if (sent === 0) throw new Error("empty");
        c.enqueue(sse({ t: "done", mode: "ai", links }));
      } catch {
        c.enqueue(sse({ t: "error", message: "The AI service hiccuped. Try again." }));
      } finally {
        reader.cancel().catch(() => {});
        c.close();
      }
    },
  });
  return new Response(stream, { headers: HEADERS });
}

export async function POST(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (limited(ip)) {
    return Response.json({ error: "Too many requests, slow down." }, { status: 429, headers: { "Retry-After": "30" } });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const msgs = parse(body);
  if (!msgs) {
    return Response.json({ error: `Send messages ending with a user message of 1..${MAX_INPUT} characters.` }, { status: 400 });
  }
  const question = msgs[msgs.length - 1].content;
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) {
    const r = await ai(msgs, key, localAnswer(question).links);
    if (r) return r;
  }
  return builtin(question);
}
