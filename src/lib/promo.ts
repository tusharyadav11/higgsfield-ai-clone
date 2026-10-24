import type { PlanId } from "./plans";

export type PromoCtx = {
  yearly: boolean;
  signedIn: boolean;
  /** epoch ms when the welcome window ends, or null if the user never signed up here */
  welcomeExpiresAt: number | null;
  now: number;
};
export type PromoOk = {
  ok: true;
  code: string;
  label: string;
  pct: number;
  plans: PlanId[];
  forceYearly?: boolean;
};
export type PromoResult = PromoOk | { ok: false; error: string };

export const REFERRAL_PCT = 10;
export const WELCOME_HOURS = 48;
const ALL: PlanId[] = ["pro", "studio"];

export function validatePromo(raw: string, ctx: PromoCtx): PromoResult {
  const code = raw.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter a code." };
  switch (code) {
    case "WELCOME20":
      if (!ctx.signedIn || ctx.welcomeExpiresAt === null)
        return { ok: false, error: "WELCOME20 is for new accounts. Create a free account to unlock it." };
      if (ctx.now > ctx.welcomeExpiresAt) return { ok: false, error: "WELCOME20 has expired (valid 48h after signup)." };
      return { ok: true, code, label: "20% off your first paid month", pct: 20, plans: ALL };
    case "YEARLY":
      return { ok: true, code, label: "Yearly billing: 2 months free", pct: 0, plans: ALL, forceYearly: true };
    case "TEAM10":
      return { ok: true, code, label: "10% off Studio for teams", pct: 10, plans: ["studio"] };
    default:
      return { ok: false, error: `"${code}" isn't a valid code.` };
  }
}

export const money = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);
export const discounted = (price: number, pct: number) => Math.round(price * (1 - pct / 100) * 100) / 100;

/** Best single discount wins (no stacking, no tricks). */
export function bestPct(planId: PlanId, promo: PromoOk | null, referral: boolean): { pct: number; source: string | null } {
  const p = promo && promo.plans.includes(planId) ? promo.pct : 0;
  const r = referral && ALL.includes(planId) ? REFERRAL_PCT : 0;
  if (p === 0 && r === 0) return { pct: 0, source: null };
  return p >= r ? { pct: p, source: promo!.code } : { pct: r, source: "Referral" };
}
