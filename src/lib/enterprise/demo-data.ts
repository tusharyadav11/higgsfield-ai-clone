import { CREDITS_PER_SEAT } from "@/lib/plans";

/** Everything in this file is SAMPLE data for the demo workspace. There is no org backend. */
export const DAY_MS = 86_400_000;
export const DEFAULT_SEATS = 25;
export const poolFor = (seats: number) => seats * CREDITS_PER_SEAT;

export type SampleMember = { id: string; name: string; email: string; role: "owner" | "admin" | "editor" | "viewer"; status: "active" | "pending" | "suspended"; activeAgoH: number | null; joinedAgoD: number | null; weight: number };

/** Fictional people on a reserved example domain. `weight` = relative credit appetite. */
export const SAMPLE_MEMBERS: SampleMember[] = [
  { id: "m-ava", name: "Ava Lindqvist", email: "ava@acme-demo.example", role: "owner", status: "active", activeAgoH: 1, joinedAgoD: 410, weight: 1.2 },
  { id: "m-noah", name: "Noah Okafor", email: "noah@acme-demo.example", role: "admin", status: "active", activeAgoH: 3, joinedAgoD: 380, weight: 1.6 },
  { id: "m-priya", name: "Priya Raman", email: "priya@acme-demo.example", role: "admin", status: "active", activeAgoH: 26, joinedAgoD: 300, weight: 1 },
  { id: "m-leo", name: "Leo Marchetti", email: "leo@acme-demo.example", role: "editor", status: "active", activeAgoH: 2, joinedAgoD: 240, weight: 2.4 },
  { id: "m-mei", name: "Mei Tanaka", email: "mei@acme-demo.example", role: "editor", status: "active", activeAgoH: 5, joinedAgoD: 200, weight: 2 },
  { id: "m-sam", name: "Sam Whitaker", email: "sam@acme-demo.example", role: "editor", status: "active", activeAgoH: 70, joinedAgoD: 150, weight: 1.3 },
  { id: "m-zoe", name: "Zoe Haddad", email: "zoe@acme-demo.example", role: "viewer", status: "active", activeAgoH: 120, joinedAgoD: 90, weight: 0.4 },
  { id: "m-omar", name: "Omar Reyes", email: "omar@acme-demo.example", role: "viewer", status: "suspended", activeAgoH: 900, joinedAgoD: 60, weight: 0.5 },
  { id: "m-ines", name: "Ines Duarte", email: "ines@acme-demo.example", role: "editor", status: "pending", activeAgoH: null, joinedAgoD: null, weight: 0 },
];

export const SAMPLE_PROJECTS = [
  { id: "p-spring", name: "Spring campaign" },
  { id: "p-launch", name: "Product launch reel" },
  { id: "p-social", name: "Social cutdowns" },
  { id: "p-brand", name: "Brand refresh" },
  { id: "p-catalog", name: "Catalog imagery" },
  { id: "p-pitch", name: "Investor pitch visuals" },
] as const;
export const SAMPLE_TOOLS = ["Image", "Video", "Enhance"] as const;
export type SampleTool = (typeof SAMPLE_TOOLS)[number];

/** Deterministic PRNG (mulberry32) + string hash. No Math.random anywhere. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type UsageEntry = { id: string; date: string; memberId: string; projectId: string; tool: SampleTool; credits: number };

export const HISTORY_DAYS = 200; // enough to cover 6 calendar months back
export const dayStart = (ms: number) => Math.floor(ms / DAY_MS) * DAY_MS;
export const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Members that have usage history (everyone who has ever been active). Pending invitees have none. */
export const USAGE_MEMBERS = SAMPLE_MEMBERS.filter((m) => m.weight > 0);

/**
 * Stable per-day sample consumption. Each (day, member) pair is generated from its own seed, so a day's entries
 * never change when `nowMs` moves. `scale` multiplies amounts (used by the debug seed to simulate a nearly empty pool).
 */
export function generateUsage(nowMs: number, scale = 1, seed = "kinetic-ws"): UsageEntry[] {
  const today = dayStart(nowMs);
  const out: UsageEntry[] = [];
  for (let back = HISTORY_DAYS - 1; back >= 0; back--) {
    const t = today - back * DAY_MS;
    const date = dayKey(t);
    const dow = new Date(t).getUTCDay();
    const weekday = dow !== 0 && dow !== 6 ? 1 : 0.25;
    for (const m of USAGE_MEMBERS) {
      const rnd = prng(hash(`${seed}|${date}|${m.id}`));
      if (rnd() > 0.55 * weekday + 0.2 * (m.weight > 1 ? 1 : 0)) continue;
      const runs = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < runs; k++) {
        const tool = SAMPLE_TOOLS[Math.floor(rnd() * SAMPLE_TOOLS.length)];
        const base = tool === "Video" ? 14 : tool === "Image" ? 3 : 1;
        const units = 1 + Math.floor(rnd() * 6 * m.weight);
        const credits = Math.max(1, Math.round(base * units * scale));
        const project = SAMPLE_PROJECTS[Math.floor(rnd() * SAMPLE_PROJECTS.length)];
        out.push({ id: `${date}-${m.id}-${k}`, date, memberId: m.id, projectId: project.id, tool, credits });
      }
    }
  }
  return out;
}

// ---- aggregation (pure, UTC) ----
export type RangeId = "daily" | "weekly" | "monthly";
export const RANGE_META: Record<RangeId, { label: string; hint: string; n: number }> = {
  daily: { label: "Daily", hint: "Last 14 days", n: 14 },
  weekly: { label: "Weekly", hint: "Last 12 weeks", n: 12 },
  monthly: { label: "Monthly", hint: "Last 6 months", n: 6 },
};
export type Bucket = { key: string; label: string; from: string; to: string; credits: number };

const fmtShort = (ms: number) => new Date(ms).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
const fmtMonth = (ms: number) => new Date(ms).toLocaleDateString("en", { month: "short", year: "2-digit", timeZone: "UTC" });

/** Inclusive [from,to] UTC day keys covered by a range ending today. Weeks are rolling 7-day windows ending today. */
export function bucketsFor(range: RangeId, nowMs: number): Bucket[] {
  const today = dayStart(nowMs);
  const n = RANGE_META[range].n;
  if (range === "daily") {
    return Array.from({ length: n }, (_, i) => {
      const t = today - (n - 1 - i) * DAY_MS;
      return { key: dayKey(t), label: fmtShort(t), from: dayKey(t), to: dayKey(t), credits: 0 };
    });
  }
  if (range === "weekly") {
    return Array.from({ length: n }, (_, i) => {
      const end = today - (n - 1 - i) * 7 * DAY_MS;
      const start = end - 6 * DAY_MS;
      return { key: dayKey(start), label: fmtShort(start), from: dayKey(start), to: dayKey(end), credits: 0 };
    });
  }
  const d = new Date(today);
  return Array.from({ length: n }, (_, i) => {
    const back = n - 1 - i;
    const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1);
    const nextStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back + 1, 1);
    const end = Math.min(nextStart - DAY_MS, today);
    return { key: dayKey(start), label: fmtMonth(start), from: dayKey(start), to: dayKey(end), credits: 0 };
  });
}

/** Sum entries into buckets. Day keys compare lexically (YYYY-MM-DD), so boundaries are inclusive and exact. */
export function aggregate(entries: UsageEntry[], range: RangeId, nowMs: number): Bucket[] {
  const buckets = bucketsFor(range, nowMs);
  for (const e of entries) {
    for (const b of buckets) {
      if (e.date >= b.from && e.date <= b.to) {
        b.credits += e.credits;
        break;
      }
    }
  }
  return buckets;
}

export const windowOf = (range: RangeId, nowMs: number) => {
  const b = bucketsFor(range, nowMs);
  return { from: b[0].from, to: b[b.length - 1].to };
};
export const inWindow = (entries: UsageEntry[], from: string, to: string) => entries.filter((e) => e.date >= from && e.date <= to);

export const monthStartKey = (nowMs: number) => {
  const d = new Date(nowMs);
  return dayKey(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};

export type Group = { id: string; credits: number; count: number };
export function groupBy(entries: UsageEntry[], key: "memberId" | "projectId"): Group[] {
  const m = new Map<string, Group>();
  for (const e of entries) {
    const g = m.get(e[key]) ?? { id: e[key], credits: 0, count: 0 };
    g.credits += e.credits;
    g.count++;
    m.set(e[key], g);
  }
  return [...m.values()].sort((a, b) => b.credits - a.credits || a.id.localeCompare(b.id));
}
export const sumCredits = (entries: UsageEntry[]) => entries.reduce((s, e) => s + e.credits, 0);

/** Scale factor so the current month's consumption lands near `pct` of the pool (debug seed). */
export function scaleForPct(nowMs: number, pct: number, seats: number): number {
  const base = sumCredits(inWindow(generateUsage(nowMs, 1), monthStartKey(nowMs), dayKey(nowMs)));
  return base > 0 ? (poolFor(seats) * pct) / 100 / base : 1;
}

export type Severity = "ok" | "warn" | "high" | "full";
export function severityOf(pct: number): Severity {
  return pct >= 100 ? "full" : pct >= 95 ? "high" : pct >= 80 ? "warn" : "ok";
}

/** Projected run-out date from the trailing 7-day average; null when nothing is consumed or already empty. */
export function projectRunOut(entries: UsageEntry[], remaining: number, nowMs: number): { days: number; date: string } | null {
  if (remaining <= 0) return null;
  const today = dayStart(nowMs);
  const from = dayKey(today - 6 * DAY_MS);
  const avg = sumCredits(inWindow(entries, from, dayKey(today))) / 7;
  if (avg <= 0) return null;
  const days = Math.ceil(remaining / avg);
  return { days, date: dayKey(today + days * DAY_MS) };
}
