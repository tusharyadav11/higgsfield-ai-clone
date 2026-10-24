import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { generate, type Generation, type GenerateInput } from "@/lib/generate";
import { getModel } from "@/lib/models";
import { REWARD_TIERS } from "@/lib/referral";
import { claimBonus, IMPORT_CREDITS_CAP } from "@/lib/rules";

type Db = ReturnType<typeof db>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Q = Db | Tx;

export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);

export async function balanceOf(userId: string, q: Q = db()): Promise<number> {
  const [r] = await q.select({ b: sql<number>`coalesce(sum(${t.creditLedger.delta}), 0)::int` }).from(t.creditLedger).where(eq(t.creditLedger.userId, userId));
  return r?.b ?? 0;
}

/** Serialises all balance-changing work for one user. Must run inside a transaction. */
const lockUser = (tx: Tx, userId: string) => tx.execute(sql`select id from users where id = ${userId} for update`);

/* ---------------- daily claim ---------------- */

export async function claimDaily(userId: string, now = new Date()) {
  const today = utcDay(now);
  const yesterday = utcDay(new Date(now.getTime() - 86400000));
  return db().transaction(async (tx) => {
    await lockUser(tx, userId);
    await tx.insert(t.streaks).values({ userId }).onConflictDoNothing();
    const [s] = await tx.select().from(t.streaks).where(eq(t.streaks.userId, userId));
    if (s.lastClaim === today) return { ok: false as const, gained: 0, streak: s.streak, lastClaim: today, balance: await balanceOf(userId, tx) };
    const streak = s.lastClaim === yesterday ? s.streak + 1 : 1;
    const gained = claimBonus(streak);
    const ins = await tx.insert(t.creditLedger).values({ userId, delta: gained, reason: "daily", ref: today }).onConflictDoNothing().returning({ id: t.creditLedger.id });
    if (!ins.length) return { ok: false as const, gained: 0, streak: s.streak, lastClaim: today, balance: await balanceOf(userId, tx) };
    await tx.update(t.streaks).set({ streak, lastClaim: today }).where(eq(t.streaks.userId, userId));
    return { ok: true as const, gained, streak, lastClaim: today, balance: await balanceOf(userId, tx) };
  });
}

/* ---------------- generate: charge / refund ---------------- */

export class InsufficientCredits extends Error {
  constructor(public balance: number, public cost: number) {
    super("Not enough credits");
  }
}

/** Atomically charges `cost`; throws InsufficientCredits (balance never goes negative). */
export async function charge(userId: string, cost: number, genId: string): Promise<number> {
  return db().transaction(async (tx) => {
    await lockUser(tx, userId);
    const bal = await balanceOf(userId, tx);
    if (bal < cost) throw new InsufficientCredits(bal, cost);
    await tx.insert(t.creditLedger).values({ userId, delta: -cost, reason: "generate", ref: genId });
    return bal - cost;
  });
}

export async function refund(userId: string, cost: number, genId: string): Promise<number> {
  return db().transaction(async (tx) => {
    await lockUser(tx, userId);
    await tx.insert(t.creditLedger).values({ userId, delta: cost, reason: "refund", ref: genId }).onConflictDoNothing();
    return balanceOf(userId, tx);
  });
}

export type ChargedResult =
  | { ok: true; generation: Generation; balance: number }
  | { ok: false; status: 402 | 500; error: string; balance: number };

/**
 * Server-side pipeline for signed-in users: charge -> provider -> persist; refund on failure
 * (or when the caller went away, `signal`). Input must already be validated.
 */
export async function chargedGenerate(userId: string, input: GenerateInput, signal?: AbortSignal): Promise<ChargedResult> {
  const m = getModel(input.model)!;
  const genId = `gen_${randomUUID().replace(/-/g, "")}`;
  try {
    await charge(userId, m.credits, genId);
  } catch (e) {
    if (e instanceof InsufficientCredits) return { ok: false, status: 402, error: `Not enough credits: this needs ${m.credits} and you have ${e.balance}.`, balance: e.balance };
    throw e;
  }
  try {
    const g = { ...(await generate(input)), id: genId };
    if (signal?.aborted) throw new Error("aborted");
    await db().insert(t.generations).values({ id: genId, userId, kind: g.kind, model: g.model, prompt: g.prompt, aspect: g.aspect, url: g.url, poster: g.poster ?? null });
    return { ok: true, generation: g, balance: await balanceOf(userId) };
  } catch {
    const balance = await refund(userId, m.credits, genId);
    return { ok: false, status: 500, error: "Generation failed. Credits refunded.", balance };
  }
}

/* ---------------- rewards / import ---------------- */

export async function claimReward(userId: string, invites: number) {
  const tier = REWARD_TIERS.find((x) => x.invites === invites);
  if (!tier) return { ok: false as const, error: "Unknown reward" };
  return db().transaction(async (tx) => {
    await lockUser(tx, userId);
    const [c] = await tx.select({ n: sql<number>`count(*)::int` }).from(t.referrals).where(eq(t.referrals.referrerId, userId));
    if ((c?.n ?? 0) < invites) return { ok: false as const, error: "Not unlocked yet" };
    const ins = await tx.insert(t.creditLedger).values({ userId, delta: tier.credits, reason: "reward", ref: String(invites) }).onConflictDoNothing().returning({ id: t.creditLedger.id });
    return ins.length ? { ok: true as const, gained: tier.credits, balance: await balanceOf(userId, tx) } : { ok: false as const, error: "Already claimed" };
  });
}

const urlOk = (u: unknown): u is string => typeof u === "string" && u.length <= 2000 && /^(\/(?!\/)|https?:\/\/|data:image\/)/.test(u);
const KINDS = ["image", "video"];
const ASPECTS = ["1:1", "16:9", "9:16", "4:3"];
export const MAX_IMPORT_ITEMS = 60;
export const MAX_IMPORT_LIKES = 500;

/** One-time, idempotent merge of a guest's local data into a new account. Caps everything it cannot verify. */
export async function importGuest(userId: string, body: Record<string, unknown>) {
  const lib = Array.isArray(body.library) ? body.library.slice(0, MAX_IMPORT_ITEMS) : [];
  const likes = Array.isArray(body.likes) ? body.likes.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 100).slice(0, MAX_IMPORT_LIKES) : [];
  const credits = Math.min(IMPORT_CREDITS_CAP, Math.max(0, Math.floor(Number(body.credits) || 0)));
  const rows: (typeof t.generations.$inferInsert)[] = [];
  for (const x of lib) {
    const o = x as Record<string, unknown>;
    if (!o || typeof o !== "object") continue;
    if (typeof o.id !== "string" || !/^[\w-]{1,64}$/.test(o.id)) continue;
    if (!urlOk(o.url) || typeof o.prompt !== "string" || !o.prompt.trim() || typeof o.model !== "string" || o.model.length > 64) continue;
    if (!KINDS.includes(o.kind as string) || !ASPECTS.includes(o.aspect as string)) continue;
    const at = typeof o.createdAt === "string" ? new Date(o.createdAt) : new Date();
    rows.push({
      id: o.id,
      userId,
      kind: o.kind as string,
      model: o.model,
      prompt: o.prompt.trim().slice(0, 500),
      aspect: o.aspect as string,
      url: o.url,
      poster: urlOk(o.poster) ? o.poster : null,
      createdAt: Number.isNaN(at.getTime()) || at.getTime() > Date.now() ? new Date() : at,
    });
  }
  return db().transaction(async (tx) => {
    await lockUser(tx, userId);
    let granted = 0;
    if (credits > 0) {
      const ins = await tx.insert(t.creditLedger).values({ userId, delta: credits, reason: "import", ref: "" }).onConflictDoNothing().returning({ id: t.creditLedger.id });
      if (ins.length) granted = credits;
    }
    // id is globally unique: an id that already belongs to someone else is silently skipped
    const imported = rows.length ? (await tx.insert(t.generations).values(rows).onConflictDoNothing().returning({ id: t.generations.id })).length : 0;
    if (likes.length) await tx.insert(t.likes).values(likes.map((postId) => ({ userId, postId }))).onConflictDoNothing();
    return { granted, imported, balance: await balanceOf(userId, tx) };
  });
}

/* ---------------- full state ---------------- */

export async function loadState(userId: string) {
  const d = db();
  const [streak] = await d.select().from(t.streaks).where(eq(t.streaks.userId, userId));
  const [library, likeRows, invitedRows, promoRows, keyRows, balance, rewardRows] = await Promise.all([
    d.select().from(t.generations).where(eq(t.generations.userId, userId)).orderBy(desc(t.generations.createdAt)).limit(60),
    d.select({ postId: t.likes.postId }).from(t.likes).where(eq(t.likes.userId, userId)),
    d.select({ id: t.referrals.referredId, at: t.referrals.createdAt }).from(t.referrals).where(eq(t.referrals.referrerId, userId)).orderBy(t.referrals.createdAt),
    d.select({ code: t.promoRedemptions.code, at: t.promoRedemptions.createdAt }).from(t.promoRedemptions).where(eq(t.promoRedemptions.userId, userId)),
    d.select({ id: t.apiKeys.id, prefix: t.apiKeys.prefix, createdAt: t.apiKeys.createdAt }).from(t.apiKeys).where(and(eq(t.apiKeys.userId, userId), sql`${t.apiKeys.revokedAt} is null`)).orderBy(desc(t.apiKeys.createdAt)),
    balanceOf(userId),
    d.select({ ref: t.creditLedger.ref }).from(t.creditLedger).where(and(eq(t.creditLedger.userId, userId), eq(t.creditLedger.reason, "reward"))),
  ]);
  return {
    balance,
    streak: streak?.streak ?? 0,
    lastClaim: streak?.lastClaim ?? null,
    library: library.map((g) => ({ id: g.id, url: g.url, kind: g.kind, prompt: g.prompt, model: g.model, aspect: g.aspect, ...(g.poster ? { poster: g.poster } : {}), createdAt: g.createdAt.toISOString() })),
    likes: likeRows.map((l) => l.postId),
    referrals: { count: invitedRows.length, invited: invitedRows.map((r) => ({ id: r.id, at: r.at.toISOString() })), rewardsClaimed: rewardRows.map((r) => Number(r.ref)) },
    promos: promoRows.map((p) => ({ code: p.code, at: p.at.toISOString() })),
    keys: keyRows.map((k) => ({ id: k.id, prefix: k.prefix, createdAt: k.createdAt.toISOString() })),
  };
}

/* ---------------- likes / library / promo / keys ---------------- */

export async function toggleLike(userId: string, postId: string): Promise<boolean> {
  return db().transaction(async (tx) => {
    const del = await tx.delete(t.likes).where(and(eq(t.likes.userId, userId), eq(t.likes.postId, postId))).returning({ p: t.likes.postId });
    if (del.length) return false;
    await tx.insert(t.likes).values({ userId, postId }).onConflictDoNothing();
    return true;
  });
}

export async function deleteGeneration(userId: string, id: string): Promise<boolean> {
  const r = await db().delete(t.generations).where(and(eq(t.generations.id, id), eq(t.generations.userId, userId))).returning({ id: t.generations.id });
  return r.length > 0;
}
