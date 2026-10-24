// DEMO-GRADE AUTH. Accounts live in this browser's localStorage only. Passwords are
// salted SHA-256 hashed with WebCrypto. There is no server, no email, and nothing
// here is real security. It exists so the product flow can be demonstrated honestly.
const ACCOUNTS_KEY = "kinetic-accounts";
const LOCK_KEY = "kinetic-lockout";
export const MAX_FAILS = 5;
export const LOCK_MS = 60_000;

type Account = { id: string; email: string; name: string; salt: string; hash: string; createdAt: string };
export type PublicUser = { id: string; email: string; name: string };

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function sha(salt: string, pw: string) {
  const data = new TextEncoder().encode(salt + ":" + pw);
  return hex(await crypto.subtle.digest("SHA-256", data));
}
const newSalt = () => hex(crypto.getRandomValues(new Uint8Array(16)).buffer as ArrayBuffer);

export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  const score = Math.min(s, 4) as 0 | 1 | 2 | 3 | 4;
  return { score, label: ["Too short", "Weak", "Okay", "Good", "Strong"][score] };
}

export type AuthResult = { ok: true; user: PublicUser } | { ok: false; error: string; field?: "email" | "password" | "name" };

export async function signUp(input: { id: string; email: string; password: string; name: string }): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address.", field: "email" };
  if (input.password.length < 8) return { ok: false, error: "Use at least 8 characters.", field: "password" };
  if (passwordStrength(input.password).score < 2) return { ok: false, error: "Password is too weak. Mix cases, numbers or symbols.", field: "password" };
  const accounts = read<Account[]>(ACCOUNTS_KEY, []);
  if (accounts.some((a) => a.email === email)) return { ok: false, error: "An account with this email already exists in this browser. Log in instead.", field: "email" };
  const salt = newSalt();
  const acc: Account = { id: input.id, email, name: name || email.split("@")[0], salt, hash: await sha(salt, input.password), createdAt: new Date().toISOString() };
  write(ACCOUNTS_KEY, [...accounts, acc]);
  return { ok: true, user: { id: acc.id, email, name: acc.name } };
}

export function lockRemaining(): number {
  const l = read<{ fails: number; until: number }>(LOCK_KEY, { fails: 0, until: 0 });
  return Math.max(0, l.until - Date.now());
}

export async function logIn(emailRaw: string, password: string): Promise<AuthResult> {
  const remaining = lockRemaining();
  if (remaining > 0) return { ok: false, error: `Too many attempts. Try again in ${Math.ceil(remaining / 1000)}s (demo lockout).` };
  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address.", field: "email" };
  if (!password) return { ok: false, error: "Enter your password.", field: "password" };
  const acc = read<Account[]>(ACCOUNTS_KEY, []).find((a) => a.email === email);
  const good = acc ? (await sha(acc.salt, password)) === acc.hash : false;
  const l = read<{ fails: number; until: number }>(LOCK_KEY, { fails: 0, until: 0 });
  if (!acc || !good) {
    const fails = l.until && l.until < Date.now() ? 1 : l.fails + 1;
    const locked = fails >= MAX_FAILS;
    write(LOCK_KEY, { fails: locked ? 0 : fails, until: locked ? Date.now() + LOCK_MS : 0 });
    return {
      ok: false,
      error: locked ? "Too many attempts. Locked for 60s (demo lockout)." : `Incorrect email or password. ${MAX_FAILS - fails} attempt(s) left.`,
    };
  }
  write(LOCK_KEY, { fails: 0, until: 0 });
  return { ok: true, user: { id: acc.id, email: acc.email, name: acc.name } };
}

/** Wipes every demo key owned by the growth system. */
export function clearAuthData() {
  try {
    for (const k of [ACCOUNTS_KEY, LOCK_KEY, "kinetic-ref-ledger", "kinetic-store"]) localStorage.removeItem(k);
  } catch {}
}
