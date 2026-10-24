import { randomBytes } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { sha256 } from "./auth";

export const MAX_ACTIVE_KEYS = 5;

/** Creates a key; the plaintext is returned once and never stored (only sha256 + a display prefix). */
export async function createKey(userId: string) {
  return db().transaction(async (tx) => {
    await tx.execute(sql`select id from users where id = ${userId} for update`);
    const [c] = await tx.select({ n: sql<number>`count(*)::int` }).from(t.apiKeys).where(and(eq(t.apiKeys.userId, userId), isNull(t.apiKeys.revokedAt)));
    if ((c?.n ?? 0) >= MAX_ACTIVE_KEYS) return null;
    const key = "kn_" + randomBytes(16).toString("hex");
    const [row] = await tx.insert(t.apiKeys).values({ userId, keyHash: sha256(key), prefix: key.slice(0, 9) }).returning();
    return { key, id: row.id, prefix: row.prefix, createdAt: row.createdAt.toISOString() };
  });
}

export async function revokeKey(userId: string, id: string): Promise<boolean> {
  const r = await db().update(t.apiKeys).set({ revokedAt: new Date() }).where(and(eq(t.apiKeys.id, id), eq(t.apiKeys.userId, userId), isNull(t.apiKeys.revokedAt))).returning({ id: t.apiKeys.id });
  return r.length > 0;
}

/** active -> user id; revoked -> "revoked"; unknown -> null */
export async function lookupKey(key: string): Promise<{ userId: string } | "revoked" | null> {
  const [r] = await db().select({ userId: t.apiKeys.userId, revokedAt: t.apiKeys.revokedAt }).from(t.apiKeys).where(eq(t.apiKeys.keyHash, sha256(key))).limit(1);
  if (!r) return null;
  return r.revokedAt ? "revoked" : { userId: r.userId };
}
