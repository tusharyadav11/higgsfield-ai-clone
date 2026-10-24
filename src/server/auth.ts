import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { REFEREE_BONUS, REFERRER_BONUS, normalizeRef } from "@/lib/referral";
import { SIGNUP_BONUS } from "@/lib/rules";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const COOKIE = "kn_session";
export const SESSION_MS = 30 * 24 * 3600 * 1000;
export const MAX_FAILS = 5;
export const LOCK_SECONDS = 60;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normalizeEmail = (v: string) => v.trim().toLowerCase();
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/* ---------------- passwords ---------------- */

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const want = Buffer.from(keyHex, "hex");
  const got = await scrypt(pw, Buffer.from(saltHex, "hex"), want.length);
  return got.length === want.length && timingSafeEqual(got, want);
}

// A throwaway hash so that "unknown email" costs the same as "wrong password".
let dummy: Promise<string> | undefined;

/* ---------------- sessions / cookies ---------------- */

export function readCookie(req: Request, name = COOKIE): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function secure(req: Request) {
  if (process.env.NODE_ENV !== "production") return false;
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  return proto === "https";
}

export function sessionCookie(req: Request, token: string, maxAgeS = SESSION_MS / 1000): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeS}${secure(req) ? "; Secure" : ""}`;
}
export const clearCookie = (req: Request) => sessionCookie(req, "", 0);

export async function createSession(userId: string, d: Pick<ReturnType<typeof db>, "insert"> = db()) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await d.insert(t.sessions).values({ tokenHash: sha256(token), userId, expiresAt });
  return { token, expiresAt };
}

export type SessionUser = { id: string; email: string; name: string; referralCode: string; createdAt: Date; referredBy?: string | null };

export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const token = readCookie(req);
  if (!token || token.length > 200) return null;
  const rows = await db()
    .select({ id: t.users.id, email: t.users.email, name: t.users.name, referralCode: t.users.referralCode, createdAt: t.users.createdAt, referredBy: t.users.referredBy })
    .from(t.sessions)
    .innerJoin(t.users, eq(t.users.id, t.sessions.userId))
    .where(and(eq(t.sessions.tokenHash, sha256(token)), gt(t.sessions.expiresAt, sql`now()`)))
    .limit(1);
  return rows[0] ?? null;
}

export async function destroySession(req: Request) {
  const token = readCookie(req);
  if (token) await db().delete(t.sessions).where(eq(t.sessions.tokenHash, sha256(token)));
}

/* ---------------- signup / login ---------------- */

export type Field = "email" | "password" | "name";
export type Fail = { ok: false; status: number; error: string; field?: Field };

const isUnique = (e: unknown): boolean => {
  const x = e as { code?: string; cause?: unknown } | null;
  return !!x && (x.code === "23505" || (x.cause !== undefined && isUnique(x.cause)));
};

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newReferralCode() {
  const b = randomBytes(6);
  return "K" + Array.from(b, (x) => CODE_CHARS[x % CODE_CHARS.length]).join("");
}

export async function signup(input: Record<string, unknown>) {
  const email = typeof input.email === "string" ? normalizeEmail(input.email) : "";
  const password = typeof input.password === "string" ? input.password : "";
  const rawName = typeof input.name === "string" ? input.name.trim() : "";
  if (email.length > 254 || !EMAIL_RE.test(email)) return fail(400, "Enter a valid email address.", "email");
  if (password.length < 8) return fail(400, "Use at least 8 characters.", "password");
  if (password.length > 200) return fail(400, "Password is too long.", "password");
  if (rawName.length > 60) return fail(400, "Name must be 60 characters or fewer.", "name");
  const name = rawName || email.split("@")[0].slice(0, 60);
  const ref = normalizeRef(input.ref);
  const passwordHash = await hashPassword(password);

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await db().transaction(async (tx) => {
        const [u] = await tx.insert(t.users).values({ email, name, passwordHash, referralCode: newReferralCode() }).returning();
        await tx.insert(t.streaks).values({ userId: u.id });
        await tx.insert(t.creditLedger).values({ userId: u.id, delta: SIGNUP_BONUS, reason: "signup", ref: "" }).onConflictDoNothing();
        let referred = false;
        if (ref) {
          const [r] = await tx.select({ id: t.users.id }).from(t.users).where(eq(t.users.referralCode, ref)).limit(1);
          if (r && r.id !== u.id) {
            const ins = await tx.insert(t.referrals).values({ referrerId: r.id, referredId: u.id }).onConflictDoNothing().returning({ id: t.referrals.id });
            if (ins.length) {
              referred = true;
              await tx.update(t.users).set({ referredBy: r.id }).where(eq(t.users.id, u.id));
              await tx.insert(t.creditLedger).values({ userId: u.id, delta: REFEREE_BONUS, reason: "referral_joined", ref: r.id }).onConflictDoNothing();
              await tx.insert(t.creditLedger).values({ userId: r.id, delta: REFERRER_BONUS, reason: "referral_invited", ref: u.id }).onConflictDoNothing();
            }
          }
        }
        const session = await createSession(u.id, tx);
        return { ok: true as const, user: { id: u.id, email: u.email, name: u.name, referralCode: u.referralCode, createdAt: u.createdAt }, token: session.token, referred };
      });
    } catch (e) {
      if (!isUnique(e)) throw e;
      const [exists] = await db().select({ id: t.users.id }).from(t.users).where(eq(t.users.email, email)).limit(1);
      if (exists) return fail(409, "An account with this email already exists. Log in instead.", "email");
      // otherwise a referral_code collision: retry with a fresh code
    }
  }
  return fail(500, "Could not create account. Please try again.");
}

const GENERIC = "Incorrect email or password.";

export async function login(input: Record<string, unknown>) {
  const email = typeof input.email === "string" ? normalizeEmail(input.email) : "";
  const password = typeof input.password === "string" ? input.password : "";
  if (!email || !password || email.length > 254 || password.length > 200) return fail(400, GENERIC);
  const d = db();
  const [u] = await d.select().from(t.users).where(eq(t.users.email, email)).limit(1);
  if (!u) {
    dummy ??= hashPassword("not-a-real-password");
    await verifyPassword(password, await dummy);
    return fail(401, GENERIC);
  }
  if (u.lockedUntil && u.lockedUntil.getTime() > Date.now()) {
    return fail(429, `Too many attempts. Try again in ${Math.ceil((u.lockedUntil.getTime() - Date.now()) / 1000)}s.`);
  }
  if (!(await verifyPassword(password, u.passwordHash))) {
    // atomic: concurrent failures cannot undercount
    const [r] = await d
      .update(t.users)
      .set({
        failedLogins: sql`CASE WHEN ${t.users.failedLogins} + 1 >= ${MAX_FAILS} THEN 0 ELSE ${t.users.failedLogins} + 1 END`,
        lockedUntil: sql`CASE WHEN ${t.users.failedLogins} + 1 >= ${MAX_FAILS} THEN now() + make_interval(secs => ${LOCK_SECONDS}) ELSE ${t.users.lockedUntil} END`,
      })
      .where(eq(t.users.id, u.id))
      .returning({ lockedUntil: t.users.lockedUntil });
    if (r?.lockedUntil && r.lockedUntil.getTime() > Date.now()) return fail(429, `Too many attempts. Try again in ${LOCK_SECONDS}s.`);
    return fail(401, GENERIC);
  }
  await d.update(t.users).set({ failedLogins: 0, lockedUntil: null }).where(eq(t.users.id, u.id));
  const session = await createSession(u.id, d);
  return { ok: true as const, user: { id: u.id, email: u.email, name: u.name, referralCode: u.referralCode, createdAt: u.createdAt }, token: session.token };
}

function fail(status: number, error: string, field?: Field): Fail {
  return { ok: false, status, error, ...(field ? { field } : {}) };
}

export const publicUser = (u: SessionUser) => ({ id: u.id, email: u.email, name: u.name, referralCode: u.referralCode, createdAt: u.createdAt.toISOString(), referred: !!u.referredBy });
