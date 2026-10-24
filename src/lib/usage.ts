import { getModel } from "./models";

/** Shared by the server (credit_ledger) and the browser (guest library). Pure: no clock, no I/O. */
export const RANGES = ["7d", "30d", "90d"] as const;
export type Range = (typeof RANGES)[number];
export const RANGE_DAYS: Record<Range, number> = { "7d": 7, "30d": 30, "90d": 90 };
export const isRange = (v: unknown): v is Range => typeof v === "string" && (RANGES as readonly string[]).includes(v);

export const TOOLS = ["image", "video", "enhance", "mcp"] as const;
export type Tool = (typeof TOOLS)[number] | "other";
export const TOOL_LABEL: Record<Tool, string> = { image: "Image", video: "Video", enhance: "Enhance", mcp: "Agent (MCP)", other: "Other" };

/** One credit movement. `delta < 0` is a spend. */
export type UsageEntry = {
  at: string; // ISO timestamp
  delta: number;
  reason: string; // generate | refund | signup | daily | referral_* | reward | promo | import | ...
  ref?: string;
  tool?: Tool;
  model?: string;
};

export type DayPoint = { date: string; spent: number; earned: number };
export type ToolStat = { tool: Tool; spent: number; count: number; share: number; prevSpent: number; deltaPct: number | null; spark: number[] };
export type ModelStat = { id: string; name: string; kind: "image" | "video" | "other"; spent: number; count: number; avg: number };
export type GrantStat = { reason: string; label: string; amount: number };

export type UsageSummary = {
  range: Range;
  from: string; // first UTC day (YYYY-MM-DD)
  to: string; // last UTC day (today)
  balance: number;
  streak: number;
  days: DayPoint[];
  spent: number;
  earned: number;
  prevSpent: number;
  generations: number;
  avgCost: number;
  tools: ToolStat[]; // always image, video, enhance, mcp (+ other when non-zero)
  models: ModelStat[]; // by spend desc
  grants: GrantStat[]; // by amount desc
  monthSpent: number; // current UTC month-to-date, independent of range
  guest: boolean;
};

const DAY = 86400000;
export const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const startOfUtcDay = (ms: number) => Math.floor(ms / DAY) * DAY;

export const GRANT_LABEL: Record<string, string> = {
  signup: "Signup bonus",
  daily: "Daily claims",
  referral_invited: "Referrals (invited)",
  referral_joined: "Referrals (joined)",
  reward: "Referral rewards",
  promo: "Promo codes",
  import: "Imported from guest",
};
export const grantLabel = (r: string) => GRANT_LABEL[r] ?? r.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Earliest instant the server must load so summarize() has everything it needs. */
export function loadFrom(range: Range, nowMs: number): number {
  const today = startOfUtcDay(nowMs);
  const prevFrom = today - (2 * RANGE_DAYS[range] - 1) * DAY;
  const month = Date.UTC(new Date(nowMs).getUTCFullYear(), new Date(nowMs).getUTCMonth(), 1);
  return Math.min(prevFrom, month);
}

export function summarize(entries: UsageEntry[], o: { range: Range; nowMs: number; balance: number; streak: number; guest?: boolean }): UsageSummary {
  const n = RANGE_DAYS[o.range];
  const today = startOfUtcDay(o.nowMs);
  const from = today - (n - 1) * DAY;
  const prevFrom = from - n * DAY;
  const end = today + DAY; // exclusive
  const d = new Date(o.nowMs);
  const monthStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);

  const days: DayPoint[] = Array.from({ length: n }, (_, i) => ({ date: dayKey(from + i * DAY), spent: 0, earned: 0 }));
  const idx = (t: number) => Math.floor((t - from) / DAY);

  // A refund inherits the tool/model of the charge it reverses, so spend nets out per tool and model.
  const charge = new Map<string, UsageEntry>();
  const refunded = new Set<string>();
  for (const e of entries) {
    if (e.reason === "generate" && e.ref) charge.set(e.ref, e);
    if (e.reason === "refund" && e.ref) refunded.add(e.ref);
  }

  const toolSpent = new Map<Tool, number>();
  const toolPrev = new Map<Tool, number>();
  const toolCount = new Map<Tool, number>();
  const toolSpark = new Map<Tool, number[]>();
  const models = new Map<string, { spent: number; count: number; kind: ModelStat["kind"] }>();
  const grants = new Map<string, number>();
  let spent = 0, earned = 0, prevSpent = 0, generations = 0, monthSpent = 0;
  const sparkFor = (t: Tool) => {
    let a = toolSpark.get(t);
    if (!a) toolSpark.set(t, (a = Array(n).fill(0)));
    return a;
  };

  for (const e of entries) {
    const t = Date.parse(e.at);
    if (!Number.isFinite(t) || t >= end || !Number.isFinite(e.delta)) continue;
    const isSpend = e.reason === "generate" || e.reason === "refund";
    if (isSpend) {
      const src = e.reason === "refund" && e.ref ? (charge.get(e.ref) ?? e) : e;
      const tool: Tool = src.tool ?? "other";
      const amt = -e.delta; // spend positive, refund negative
      if (t >= monthStart) monthSpent += amt;
      if (t >= from) {
        const i = idx(t);
        days[i].spent += amt;
        spent += amt;
        toolSpent.set(tool, (toolSpent.get(tool) ?? 0) + amt);
        sparkFor(tool)[i] += amt;
        const mk = src.model ?? "";
        const m = models.get(mk) ?? { spent: 0, count: 0, kind: tool === "image" || tool === "video" ? tool : "other" };
        m.spent += amt;
        if (e.reason === "generate" && !(e.ref && refunded.has(e.ref))) {
          generations++;
          m.count++;
          toolCount.set(tool, (toolCount.get(tool) ?? 0) + 1);
        }
        models.set(mk, m);
      } else if (t >= prevFrom) {
        prevSpent += amt;
        toolPrev.set(tool, (toolPrev.get(tool) ?? 0) + amt);
      }
    } else if (e.delta > 0 && t >= from) {
      days[idx(t)].earned += e.delta;
      earned += e.delta;
      grants.set(e.reason, (grants.get(e.reason) ?? 0) + e.delta);
    }
  }
  for (const p of days) p.spent = Math.max(0, p.spent); // a refund landing after midnight must not draw below zero
  for (const a of toolSpark.values()) for (let i = 0; i < a.length; i++) a[i] = Math.max(0, a[i]);

  const present: Tool[] = [...TOOLS];
  if ((toolSpent.get("other") ?? 0) !== 0 || (toolPrev.get("other") ?? 0) !== 0) present.push("other");
  const tools: ToolStat[] = present.map((tool) => {
    const s = Math.max(0, toolSpent.get(tool) ?? 0);
    const prev = Math.max(0, toolPrev.get(tool) ?? 0);
    return {
      tool,
      spent: s,
      count: toolCount.get(tool) ?? 0,
      share: spent > 0 ? s / spent : 0,
      prevSpent: prev,
      deltaPct: prev > 0 ? Math.round(((s - prev) / prev) * 100) : null,
      spark: toolSpark.get(tool) ?? Array(n).fill(0),
    };
  });

  const modelList: ModelStat[] = [...models]
    .filter(([id, m]) => id && (m.spent > 0 || m.count > 0))
    .map(([id, m]) => ({ id, name: getModel(id)?.name ?? id, kind: m.kind, spent: Math.max(0, m.spent), count: m.count, avg: m.count ? Math.round((m.spent / m.count) * 10) / 10 : 0 }))
    .sort((a, b) => b.spent - a.spent || a.name.localeCompare(b.name));

  return {
    range: o.range,
    from: dayKey(from),
    to: dayKey(today),
    balance: o.balance,
    streak: o.streak,
    days,
    spent: Math.max(0, spent),
    earned,
    prevSpent: Math.max(0, prevSpent),
    generations,
    avgCost: generations ? Math.round((Math.max(0, spent) / generations) * 10) / 10 : 0,
    tools,
    models: modelList,
    grants: [...grants].map(([reason, amount]) => ({ reason, label: grantLabel(reason), amount })).sort((a, b) => b.amount - a.amount),
    monthSpent: Math.max(0, monthSpent),
    guest: !!o.guest,
  };
}

/** Guests have no ledger: rebuild spend from the local library using each model's price. */
export function guestEntries(library: { id: string; kind: string; model: string; createdAt: string }[]): UsageEntry[] {
  return library.map((g) => ({
    at: g.createdAt,
    delta: -(getModel(g.model)?.credits ?? 0),
    reason: "generate",
    ref: g.id,
    tool: g.kind === "video" ? "video" : "image",
    model: g.model,
  }));
}

export const isEmpty = (s: UsageSummary) => s.generations === 0 && s.spent === 0 && s.earned === 0;

const pct = (a: number, b: number) => Math.round(((a - b) / b) * 100);

/** 2-3 short, factual sentences. Never invents numbers. */
export function insights(s: UsageSummary): string[] {
  const out: string[] = [];
  const img = s.tools.find((t) => t.tool === "image");
  const vid = s.tools.find((t) => t.tool === "video");
  if (img && vid && img.count > 0 && vid.count > 0) {
    const ia = img.spent / img.count, va = vid.spent / vid.count;
    if (va >= ia * 1.5) out.push(`Video costs you ${(va / ia).toFixed(1).replace(/\.0$/, "")}x more per run than images. Try the Fast models to stretch your credits.`);
  }
  if (s.models[0] && s.spent > 0) out.push(`${s.models[0].name} is your top model: ${Math.round((s.models[0].spent / s.spent) * 100)}% of what you spent.`);
  if (s.prevSpent > 0 && s.spent > 0) {
    const d = pct(s.spent, s.prevSpent);
    if (Math.abs(d) >= 10) out.push(`You spent ${Math.abs(d)}% ${d > 0 ? "more" : "less"} than the previous ${RANGE_DAYS[s.range]} days.`);
  }
  if (s.spent > 0) {
    const perDay = s.spent / s.days.length;
    const runway = perDay > 0 ? Math.floor(s.balance / perDay) : 0;
    if (runway > 0 && runway < 14) out.push(`At this pace your balance lasts about ${runway} more day${runway === 1 ? "" : "s"}. Daily claims add up.`);
  }
  if (!out.length && s.generations > 0) out.push(`${s.generations} creation${s.generations === 1 ? "" : "s"} at ${s.avgCost} credits on average.`);
  if (!out.length) out.push("Make a few creations and your patterns will show up here.");
  return out.slice(0, 3);
}

/** Smooth monotone-cubic path through points (x ascending). Returns "" for no points. */
export function smoothPath(pts: [number, number][]): string {
  const n = pts.length;
  if (!n) return "";
  if (n === 1) return `M${pts[0][0]} ${pts[0][1]}`;
  const dx: number[] = [], m: number[] = [], tg: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0] || 1e-9;
    m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i];
  }
  tg[0] = m[0];
  tg[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) tg[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { tg[i] = 0; tg[i + 1] = 0; continue; }
    const a = tg[i] / m[i], b = tg[i + 1] / m[i], h = Math.hypot(a, b);
    if (h > 3) { const k = 3 / h; tg[i] = k * a * m[i]; tg[i + 1] = k * b * m[i]; }
  }
  const f = (v: number) => Math.round(v * 100) / 100;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const x1 = pts[i][0] + dx[i] / 3, x2 = pts[i + 1][0] - dx[i] / 3;
    d += `C${f(x1)} ${f(pts[i][1] + (tg[i] * dx[i]) / 3)} ${f(x2)} ${f(pts[i + 1][1] - (tg[i + 1] * dx[i]) / 3)} ${f(pts[i + 1][0])} ${f(pts[i + 1][1])}`;
  }
  return d;
}

const csvCell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
export function toCsv(s: UsageSummary): string {
  const rows: (string | number)[][] = [["date", "credits_spent", "credits_earned"], ...s.days.map((d) => [d.date, d.spent, d.earned])];
  rows.push([], ["tool", "credits_spent", "generations"], ...s.tools.map((t) => [t.tool, t.spent, t.count]));
  rows.push([], ["model", "credits_spent", "generations"], ...s.models.map((m) => [m.id, m.spent, m.count]));
  return rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}
