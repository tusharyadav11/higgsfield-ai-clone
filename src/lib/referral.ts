// Referral helpers. DEMO LEDGER: there is no database. Redemptions are recorded
// (a) in this browser's localStorage and (b) in an in-memory Map inside the
// /api/referral route (per server instance, lost on redeploy/cold start).
export const REF_RE = /^K[0-9A-Z]{6}$/;
export const REFERRER_BONUS = 30;
export const REFEREE_BONUS = 20;

export const REWARD_TIERS = [
  { invites: 1, credits: 20, badge: "Spark" },
  { invites: 3, credits: 50, badge: "Catalyst" },
  { invites: 5, credits: 100, badge: "Amplifier" },
  { invites: 10, credits: 250, badge: "Legend" },
] as const;

export function codeFor(id: string): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return "K" + h.toString(36).toUpperCase().padStart(6, "0").slice(-6);
}

export function normalizeRef(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.trim().toUpperCase();
  return REF_RE.test(c) ? c : null;
}

export const shareLink = (origin: string, code: string) => `${origin}/signup?ref=${code}`;

export type Redemption = { referee: string; at: string };
const LEDGER_KEY = "kinetic-ref-ledger";

export function readLocalLedger(): Record<string, Redemption[]> {
  try {
    return JSON.parse(localStorage.getItem(LEDGER_KEY) ?? "{}") as Record<string, Redemption[]>;
  } catch {
    return {};
  }
}

/** Client only. Records a redemption locally and best-effort on the demo server ledger. */
export async function redeemReferral(code: string, referee: string): Promise<void> {
  try {
    const l = readLocalLedger();
    const list = l[code] ?? [];
    if (!list.some((r) => r.referee === referee)) list.push({ referee, at: new Date().toISOString() });
    l[code] = list;
    localStorage.setItem(LEDGER_KEY, JSON.stringify(l));
  } catch {}
  try {
    await fetch("/api/referral", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, referee }),
    });
  } catch {}
}

/** Client only. Merge local + server demo ledgers for a code. */
export async function fetchRedemptions(code: string): Promise<Redemption[]> {
  const out = new Map<string, Redemption>();
  for (const r of readLocalLedger()[code] ?? []) out.set(r.referee, r);
  try {
    const res = await fetch(`/api/referral?code=${encodeURIComponent(code)}`, { cache: "no-store" });
    if (res.ok) {
      const j = (await res.json()) as { redemptions?: Redemption[] };
      for (const r of j.redemptions ?? []) out.set(r.referee, r);
    }
  } catch {}
  return [...out.values()];
}
