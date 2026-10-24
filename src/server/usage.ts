import { and, eq, gte } from "drizzle-orm";
import { db, t } from "@/db";
import { loadFrom, summarize, type Range, type Tool, type UsageEntry, type UsageSummary } from "@/lib/usage";
import { balanceOf } from "./credits";

const MAX_ROWS = 20000;

export async function usageFor(userId: string, range: Range, now = new Date()): Promise<UsageSummary> {
  const d = db();
  const since = new Date(loadFrom(range, now.getTime()));
  const [rows, balance, [streak]] = await Promise.all([
    d
      .select({ at: t.creditLedger.createdAt, delta: t.creditLedger.delta, reason: t.creditLedger.reason, ref: t.creditLedger.ref, kind: t.generations.kind, model: t.generations.model })
      .from(t.creditLedger)
      .leftJoin(t.generations, and(eq(t.generations.id, t.creditLedger.ref), eq(t.generations.userId, t.creditLedger.userId)))
      .where(and(eq(t.creditLedger.userId, userId), gte(t.creditLedger.createdAt, since)))
      .limit(MAX_ROWS),
    balanceOf(userId),
    d.select().from(t.streaks).where(eq(t.streaks.userId, userId)),
  ]);
  const entries: UsageEntry[] = rows.map((r) => ({
    at: r.at.toISOString(),
    delta: r.delta,
    reason: r.reason,
    ref: r.ref,
    // only charges join to a generation row; refunds inherit from their charge inside summarize()
    ...(r.reason === "generate" ? { tool: (r.kind === "image" || r.kind === "video" ? r.kind : "other") as Tool, ...(r.model ? { model: r.model } : {}) } : {}),
  }));
  return summarize(entries, { range, nowMs: now.getTime(), balance, streak: streak?.streak ?? 0 });
}
