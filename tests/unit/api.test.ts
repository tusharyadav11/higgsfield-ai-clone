import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";

async function load(name: string): Promise<any> {
  try {
    if (name === "models") return await import("../../src/app/api/models/route");
    if (name === "feed") return await import("../../src/app/api/feed/route");
    return await import("../../src/app/api/generate/route");
  } catch (e) {
    throw new Error(`Cannot import src/app/api/${name}/route.ts (not implemented yet?): ${(e as Error).message}`);
  }
}
const url = (p: string) => new NextRequest("http://localhost" + p);
const post = (body: unknown, raw = false) =>
  new NextRequest("http://localhost/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  });

describe("GET /api/models", () => {
  it("returns model list with contract fields and cache header", async () => {
    const { GET } = await load("models");
    const res = await GET(url("/api/models"));
    expect(res.status).toBe(200);
    const cc = res.headers.get("cache-control") ?? "";
    expect(cc, "Cache-Control must include s-maxage=3600").toContain("s-maxage=3600");
    expect(cc).toContain("stale-while-revalidate");
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    for (const m of data) {
      expect(typeof m.id).toBe("string");
      expect(typeof m.name).toBe("string");
      expect(["image", "video"]).toContain(m.kind);
      expect(typeof m.credits).toBe("number");
      expect(m.speed).toBeDefined();
      if (m.kind === "image") expect(m.credits).toBeGreaterThanOrEqual(2), expect(m.credits).toBeLessThanOrEqual(4);
      else expect(m.credits).toBeGreaterThanOrEqual(10), expect(m.credits).toBeLessThanOrEqual(20);
    }
    expect(data.some((m: any) => m.kind === "image")).toBe(true);
    expect(data.some((m: any) => m.kind === "video")).toBe(true);
    expect(new Set(data.map((m: any) => m.id)).size).toBe(data.length);
  });
});

describe("GET /api/feed", () => {
  const feed = async (q = "") => {
    const { GET } = await load("feed");
    return GET(url("/api/feed" + q));
  };

  it("default response shape + cache header", async () => {
    const res = await feed();
    expect(res.status).toBe(200);
    const cc = res.headers.get("cache-control") ?? "";
    expect(cc, "feed Cache-Control").toContain("s-maxage=60");
    expect(cc).toContain("stale-while-revalidate=600");
    const d = await res.json();
    expect(Array.isArray(d.items)).toBe(true);
    expect(d).toHaveProperty("nextCursor");
    const p = d.items[0];
    for (const k of ["id","kind","title","prompt","model","aspect","author","likes","remixes","tags","src","poster","createdAt"])
      expect(p, `post missing ${k}`).toHaveProperty(k);
    expect(Array.isArray(p.tags)).toBe(true);
  });

  it("tag filter returns only that tag; unknown tag -> empty 200", async () => {
    const all = await (await feed("?limit=48")).json();
    const tag = all.items.find((i: any) => i.tags.length)?.tags[0];
    expect(tag).toBeTruthy();
    const res = await feed(`?tag=${encodeURIComponent(tag)}&limit=48`);
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.items.length).toBeGreaterThan(0);
    for (const i of d.items) expect(i.tags).toContain(tag);
    const u = await feed("?tag=zzz-no-such-tag");
    expect(u.status).toBe(200);
    expect((await u.json()).items).toEqual([]);
  });

  it.each([["0", 1], ["-1", 1], ["9999", 48], ["NaN", null], ["abc", null]])(
    "limit=%s is clamped to 1..48 (never 500)",
    async (l, expected) => {
      const res = await feed(`?limit=${l}`);
      expect(res.status, `limit=${l}`).toBe(200);
      const d = await res.json();
      expect(d.items.length).toBeGreaterThanOrEqual(1);
      expect(d.items.length).toBeLessThanOrEqual(48);
      if (expected !== null) expect(d.items.length).toBe(expected);
    },
  );

  it("bad cursor -> 400", async () => {
    for (const c of ["garbage", "-5", "%00", "999999999", "1e9"]) {
      const res = await feed(`?cursor=${c}`);
      expect(res.status, `cursor=${c}`).toBe(400);
    }
  });

  it("pagination covers all 48 posts with no duplicates", async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 60; i++) {
      const res = await feed(`?limit=10${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      expect(res.status).toBe(200);
      const d = await res.json();
      seen.push(...d.items.map((x: any) => x.id));
      cursor = d.nextCursor;
      if (!cursor) break;
    }
    expect(cursor, "pagination must terminate").toBeNull();
    expect(seen.length).toBe(48);
    expect(new Set(seen).size).toBe(48);
  });

  it("limit=48 returns all 48 and nextCursor null", async () => {
    const d = await (await feed("?limit=48")).json();
    expect(d.items.length).toBe(48);
    expect(d.nextCursor).toBeNull();
  });
});

describe("POST /api/generate", () => {
  const gen = async (req: Request) => (await load("generate")).POST(req);
  let imageModel: any, videoModel: any;
  const models = async () => {
    if (!imageModel) {
      const list = await (await (await load("models")).GET(url("/api/models"))).json();
      imageModel = list.find((m: any) => m.kind === "image");
      videoModel = list.find((m: any) => m.kind === "video");
    }
  };

  it("valid image", async () => {
    await models();
    const res = await gen(post({ kind: "image", model: imageModel.id, prompt: "a neon fox", aspect: "1:1" }));
    expect(res.status).toBe(200);
    const d = await res.json();
    for (const k of ["id","url","kind","prompt","model","aspect","createdAt"]) expect(d).toHaveProperty(k);
    expect(d.kind).toBe("image");
    expect(d.model).toBe(imageModel.id);
    expect(d.aspect).toBe("1:1");
    expect(d.prompt).toBe("a neon fox");
    expect(typeof d.url).toBe("string");
    expect(d.url.length).toBeGreaterThan(0);
  });

  it("valid video for every aspect", async () => {
    await models();
    for (const aspect of ["1:1", "16:9", "9:16", "4:3"]) {
      const res = await gen(post({ kind: "video", model: videoModel.id, prompt: "drone shot", aspect }));
      expect(res.status, aspect).toBe(200);
      expect((await res.json()).kind).toBe("video");
    }
  });

  it("mock is deterministic for same prompt (same url), differs for another prompt", async () => {
    await models();
    const b = { kind: "image", model: imageModel.id, aspect: "1:1" };
    const a1 = await (await gen(post({ ...b, prompt: "same prompt" }))).json();
    const a2 = await (await gen(post({ ...b, prompt: "same prompt" }))).json();
    const o = await (await gen(post({ ...b, prompt: "very different prompt" }))).json();
    expect(a1.url, "same prompt must give same art").toBe(a2.url);
    expect(o.url, "different prompt should give different art").not.toBe(a1.url);
  });

  it("prompt is trimmed-validated; 500 ok, 501 rejected, empty/whitespace rejected", async () => {
    await models();
    const b = { kind: "image", model: imageModel.id, aspect: "1:1" };
    for (const prompt of ["", "   ", "\n\t "]) {
      const res = await gen(post({ ...b, prompt }));
      expect(res.status, JSON.stringify(prompt)).toBe(400);
      expect(typeof (await res.json()).error).toBe("string");
    }
    expect((await gen(post({ ...b, prompt: "x".repeat(501) }))).status).toBe(400);
    expect((await gen(post({ ...b, prompt: "x".repeat(500) }))).status).toBe(200);
    // 500 chars + surrounding whitespace is valid after trim
    expect((await gen(post({ ...b, prompt: "  " + "y".repeat(500) + "  " }))).status).toBe(200);
  });

  it("wrong model for kind / unknown model -> 400", async () => {
    await models();
    expect((await gen(post({ kind: "video", model: imageModel.id, prompt: "p", aspect: "1:1" }))).status).toBe(400);
    expect((await gen(post({ kind: "image", model: videoModel.id, prompt: "p", aspect: "1:1" }))).status).toBe(400);
    expect((await gen(post({ kind: "image", model: "nope", prompt: "p", aspect: "1:1" }))).status).toBe(400);
    expect((await gen(post({ kind: "audio", model: imageModel.id, prompt: "p", aspect: "1:1" }))).status).toBe(400);
  });

  it("unknown aspect -> 400 with {error}", async () => {
    await models();
    const res = await gen(post({ kind: "image", model: imageModel.id, prompt: "p", aspect: "21:9" }));
    expect(res.status).toBe(400);
    expect(typeof (await res.json()).error).toBe("string");
  });

  it("invalid JSON / empty / non-object body -> 400 not 500", async () => {
    for (const raw of ["{not json", "", "null", "[]", '"str"', "42"]) {
      const res = await gen(post(raw, true));
      expect(res.status, `body=${raw}`).toBe(400);
    }
  });

  it("missing fields / wrong types -> 400", async () => {
    await models();
    const full: any = { kind: "image", model: imageModel.id, prompt: "p", aspect: "1:1" };
    for (const k of Object.keys(full)) {
      const b = { ...full }; delete b[k];
      expect((await gen(post(b))).status, `missing ${k}`).toBe(400);
    }
    expect((await gen(post({ ...full, prompt: 123 }))).status).toBe(400);
    expect((await gen(post({ ...full, prompt: null }))).status).toBe(400);
    expect((await gen(post({}))).status).toBe(400);
  });
});
