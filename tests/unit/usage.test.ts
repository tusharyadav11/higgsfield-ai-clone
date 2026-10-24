import { describe, expect, it } from "vitest";
import { guestEntries, insights, isEmpty, loadFrom, smoothPath, summarize, toCsv, type UsageEntry } from "../../src/lib/usage";

const NOW = Date.UTC(2026, 9, 24, 15, 30); // 2026-10-24 15:30 UTC
const at = (d: string, t = "12:00:00") => `${d}T${t}Z`;
const gen = (d: string, cost: number, tool: "image" | "video", model: string, ref: string, t?: string): UsageEntry => ({ at: at(d, t), delta: -cost, reason: "generate", ref, tool, model });
const base = { nowMs: NOW, balance: 40, streak: 2 };

describe("summarize", () => {
  it("handles empty data", () => {
    const s = summarize([], { ...base, range: "7d" });
    expect(s.days).toHaveLength(7);
    expect(s.days[6].date).toBe("2026-10-24");
    expect(s.days[0].date).toBe("2026-10-18");
    expect(s.spent).toBe(0);
    expect(s.generations).toBe(0);
    expect(s.avgCost).toBe(0);
    expect(s.models).toEqual([]);
    expect(s.tools.map((t) => t.tool)).toEqual(["image", "video", "enhance", "mcp"]);
    expect(isEmpty(s)).toBe(true);
    expect(insights(s)).toHaveLength(1);
  });

  it("aggregates a single day", () => {
    const s = summarize([gen("2026-10-24", 3, "image", "soul-v2", "a"), gen("2026-10-24", 15, "video", "veo-lite", "b"), { at: at("2026-10-24", "01:00:00"), delta: 5, reason: "daily", ref: "2026-10-24" }], { ...base, range: "7d" });
    expect(s.days[6]).toEqual({ date: "2026-10-24", spent: 18, earned: 5 });
    expect(s.spent).toBe(18);
    expect(s.generations).toBe(2);
    expect(s.avgCost).toBe(9);
    expect(s.tools.find((t) => t.tool === "video")!.share).toBeCloseTo(15 / 18);
    expect(s.models[0]).toMatchObject({ id: "veo-lite", name: "Veo Lite", spent: 15, count: 1 });
    expect(s.grants).toEqual([{ reason: "daily", label: "Daily claims", amount: 5 }]);
    expect(s.monthSpent).toBe(18);
  });

  it("includes both range boundaries and excludes outside, with UTC bucketing", () => {
    const s = summarize(
      [
        gen("2026-10-18", 2, "image", "flux-lite", "first", "00:00:00"), // first instant of day 1
        gen("2026-10-17", 4, "image", "imagen-pro", "prev", "23:59:59"), // last second of previous period
        gen("2026-10-24", 3, "image", "soul-v2", "last", "23:59:59"), // later today
        gen("2026-10-25", 9, "image", "soul-v2", "future", "00:00:00"), // future: ignored
      ],
      { ...base, range: "7d" },
    );
    expect(s.days[0].spent).toBe(2);
    expect(s.days[6].spent).toBe(3);
    expect(s.spent).toBe(5);
    expect(s.prevSpent).toBe(4);
    expect(s.tools[0].deltaPct).toBe(25);
  });

  it("nets refunds out of spend, count and models", () => {
    const s = summarize(
      [gen("2026-10-23", 10, "video", "kling-fast", "x"), { at: at("2026-10-23", "12:00:05"), delta: 10, reason: "refund", ref: "x" }, gen("2026-10-23", 2, "image", "flux-lite", "y")],
      { ...base, range: "30d" },
    );
    expect(s.spent).toBe(2);
    expect(s.generations).toBe(1);
    expect(s.tools.find((t) => t.tool === "video")!.spent).toBe(0);
    expect(s.models.map((m) => m.id)).toEqual(["flux-lite"]);
    expect(s.earned).toBe(0); // refunds are not earnings
    expect(s.grants).toEqual([]);
  });

  it("covers 90 days and sparks per tool", () => {
    const s = summarize([gen("2026-07-27", 4, "image", "imagen-pro", "o"), gen("2026-07-26", 4, "image", "imagen-pro", "p")], { ...base, range: "90d" });
    expect(s.days).toHaveLength(90);
    expect(s.days[0].date).toBe("2026-07-27");
    expect(s.spent).toBe(4);
    expect(s.prevSpent).toBe(4);
    expect(s.tools[0].spark).toHaveLength(90);
    expect(s.tools[0].spark[0]).toBe(4);
  });

  it("loadFrom covers previous period and the month start", () => {
    expect(new Date(loadFrom("7d", NOW)).toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(new Date(loadFrom("30d", NOW)).toISOString()).toBe("2026-08-26T00:00:00.000Z");
  });

  it("builds guest entries from the library", () => {
    const e = guestEntries([{ id: "1", kind: "video", model: "sora-max", createdAt: at("2026-10-24") }]);
    const s = summarize(e, { ...base, range: "7d", guest: true });
    expect(s.spent).toBe(20);
    expect(s.guest).toBe(true);
  });
});

describe("helpers", () => {
  it("insights compares video and image cost per run", () => {
    const s = summarize([gen("2026-10-24", 2, "image", "flux-lite", "a"), gen("2026-10-24", 20, "video", "sora-max", "b")], { ...base, range: "7d" });
    expect(insights(s).some((t) => /Video costs you 10x more/.test(t))).toBe(true);
    expect(insights(s).length).toBeLessThanOrEqual(3);
  });
  it("smoothPath and csv", () => {
    expect(smoothPath([])).toBe("");
    expect(smoothPath([[0, 1], [10, 5], [20, 2]])).toMatch(/^M0 1C/);
    const csv = toCsv(summarize([], { ...base, range: "7d" }));
    expect(csv.split("\n")[0]).toBe("date,credits_spent,credits_earned");
  });
});
