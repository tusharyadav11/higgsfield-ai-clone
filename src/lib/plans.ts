export type PlanId = "free" | "pro" | "studio";
export const PLANS = [
  { id: "free", name: "Free", monthly: 0, yearly: 0, credits: "50 credits to start + daily claim", perks: ["All image models", "Community feed", "Local library"], cta: "Start free" },
  { id: "pro", name: "Pro", monthly: 15, yearly: 12, credits: "1,000 credits / month", perks: ["Everything in Free", "All video models", "Priority queue", "No watermark"], cta: "Go Pro", featured: true },
  { id: "studio", name: "Studio", monthly: 49, yearly: 39, credits: "5,000 credits / month", perks: ["Everything in Pro", "Fastest queue", "Commercial license", "Early access models"], cta: "Go Studio" },
] as const;

// ---- Enterprise (indicative list prices; the quote is the source of truth) ----
export const SEAT_PRICE = 19; // USD / seat / month before volume discount
export const CREDITS_PER_SEAT = 1500;
export const INDIVIDUAL_PRO_PER_1000_CREDITS = 15;
export const PRESETS = [5, 25, 100, 500] as const;

export const VOLUME_TIERS = [
  { min: 0, pct: 0, label: "1-9 seats" },
  { min: 10, pct: 5, label: "10+ seats" },
  { min: 25, pct: 10, label: "25+ seats" },
  { min: 100, pct: 15, label: "100+ seats" },
  { min: 500, pct: null, label: "500+ seats (custom)" },
] as const;

export function volumePct(seats: number): number | null {
  if (seats >= 500) return null;
  let pct = 0;
  for (const t of VOLUME_TIERS) if (t.pct !== null && seats >= t.min) pct = t.pct;
  return pct;
}

export function enterpriseEstimate(seats: number) {
  const pct = volumePct(seats);
  const effPct = pct ?? 15; // indicative floor for custom tier
  const list = seats * SEAT_PRICE;
  const monthly = Math.round(list * (1 - effPct / 100) * 100) / 100;
  const pool = seats * CREDITS_PER_SEAT;
  const individual = Math.round((pool / 1000) * INDIVIDUAL_PRO_PER_1000_CREDITS * 100) / 100;
  return { pct, custom: pct === null, list, monthly, pool, individual, savings: Math.max(0, Math.round((individual - monthly) * 100) / 100) };
}

export const ENTERPRISE_FEATURES: { name: string; team: boolean; enterprise: boolean }[] = [
  { name: "SSO (SAML / OIDC)", team: false, enterprise: true },
  { name: "Shared library", team: true, enterprise: true },
  { name: "Usage dashboard", team: true, enterprise: true },
  { name: "Priority queue", team: true, enterprise: true },
  { name: "99.9% uptime SLA", team: false, enterprise: true },
  { name: "Invoice billing", team: false, enterprise: true },
];
