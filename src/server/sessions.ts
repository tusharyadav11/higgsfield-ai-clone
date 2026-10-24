import { and, desc, eq, gt, ne, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { COOKIE, readCookie, sha256 } from "./auth";

/** Opaque, stable public id for a session. Derived (one-way) from the stored token hash, which is never exposed. */
export const sessionPublicId = (tokenHash: string) => sha256(`kn-session-id:${tokenHash}`).slice(0, 32);
export const SESSION_ID_RE = /^[0-9a-f]{32}$/;

export const currentTokenHash = (req: Request): string | null => {
  const tok = readCookie(req, COOKIE);
  return tok && tok.length <= 200 ? sha256(tok) : null;
};

export type SessionInfo = { id: string; label: string; createdAt: string; expiresAt: string; current: boolean };

export async function listSessions(userId: string, currentHash: string | null): Promise<SessionInfo[]> {
  const rows = await db()
    .select({ tokenHash: t.sessions.tokenHash, createdAt: t.sessions.createdAt, expiresAt: t.sessions.expiresAt })
    .from(t.sessions)
    .where(and(eq(t.sessions.userId, userId), gt(t.sessions.expiresAt, sql`now()`)))
    .orderBy(desc(t.sessions.createdAt));
  return rows.map((r) => {
    const id = sessionPublicId(r.tokenHash);
    return { id, label: `Session ${id.slice(0, 6)}`, createdAt: r.createdAt.toISOString(), expiresAt: r.expiresAt.toISOString(), current: r.tokenHash === currentHash };
  });
}

export type RevokeResult = "ok" | "not_found" | "current";

/** Revoke one of the user's OTHER sessions. Never touches another user's rows; refuses the current session. */
export async function revokeSession(userId: string, publicId: string, currentHash: string | null): Promise<RevokeResult> {
  const rows = await db().select({ tokenHash: t.sessions.tokenHash }).from(t.sessions).where(eq(t.sessions.userId, userId));
  const hit = rows.find((r) => sessionPublicId(r.tokenHash) === publicId);
  if (!hit) return "not_found";
  if (hit.tokenHash === currentHash) return "current";
  await db().delete(t.sessions).where(and(eq(t.sessions.tokenHash, hit.tokenHash), eq(t.sessions.userId, userId)));
  return "ok";
}

export async function revokeOtherSessions(userId: string, currentHash: string): Promise<number> {
  const r = await db().delete(t.sessions).where(and(eq(t.sessions.userId, userId), ne(t.sessions.tokenHash, currentHash))).returning({ h: t.sessions.tokenHash });
  return r.length;
}
