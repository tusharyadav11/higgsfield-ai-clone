/**
 * Enterprise pricing calculator: pure functions, integer-cent maths, no I/O.
 * Every rate is derived from constants that already exist in `@/lib/plans`:
 *  - seat list price, credits per seat, volume tiers (500+ is custom, indicative floor = highest numeric tier)
 *  - add-on packs are priced at the existing Pro credit rate (INDIVIDUAL_PRO_PER_1000_CREDITS)
 *  - annual billing uses the only annual rule the product has: the Pro yearly/monthly price ratio (12/15)
 * All figures are indicative; a written quote is the source of truth.
 */
import { CREDITS_PER_SEAT, INDIVIDUAL_PRO_PER_1000_CREDITS, PLANS, SEAT_PRICE, VOLUME_TIERS } from "@/lib/plans";

export const SEAT_PRICE_CENTS = SEAT_PRICE * 100;
export const PRO_PER_1000_CENTS = INDIVIDUAL_PRO_PER_1000_CREDITS * 100;
export const MIN_SEATS = 1;
export const MAX_SEATS = 5000;
export const SLIDER_MAX = 500;
export const MAX_ADDON_QTY = 50;
export const MAX_EXPECTED_CREDITS = 100_000_000;

const pro = PLANS.find((p) => p.id === "pro")!;
/** Annual billing factor = Pro yearly / Pro monthly (12 / 15 = 0.8, i.e. 20% off). */
export const ANNUAL_NUM = pro.yearly;
export const ANNUAL_DEN = pro.monthly;
export const ANNUAL_DISCOUNT_PCT = Math.round((1 - ANNUAL_NUM / ANNUAL_DEN) * 100);

export type Billing = "monthly" | "annual";
export type Tier = { min: number; pct: number | null; label: string };
export type Tiers = readonly Tier[];

export const ADDON_PACKS = [
  { id: "5k", credits: 5_000, label: "5,000 credits" },
  { id: "20k", credits: 20_000, label: "20,000 credits" },
  { id: "100k", credits: 100_000, label: "100,000 credits" },
] as const;
export type AddonId = (typeof ADDON_PACKS)[number]["id"];
export type Addons = Partial<Record<AddonId, number>>;

/** Integer cents for one add-on pack at the Pro monthly credit rate. */
export const addonPackCents = (credits: number) => (credits / 1000) * PRO_PER_1000_CENTS;

const divRound = (a: number, b: number) => Math.round(a / b);
/** Apply the annual billing ratio to a monthly cent amount (rounded to a whole cent). */
export const annualCents = (monthlyCents: number) => divRound(monthlyCents * ANNUAL_NUM, ANNUAL_DEN);

/** Percent discount for a seat count under the given tiers; null = custom (500+). */
export function tierPct(seats: number, tiers: Tiers = VOLUME_TIERS): number | null {
  let hit: Tier = tiers[0];
  for (const t of tiers) if (seats >= t.min) hit = t;
  return hit.pct;
}
export function activeTierMin(seats: number, tiers: Tiers = VOLUME_TIERS): number {
  let hit = tiers[0].min;
  for (const t of tiers) if (seats >= t.min) hit = t.min;
  return hit;
}
/** Indicative floor used for the custom tier: the highest numeric tier discount. */
export function customFloorPct(tiers: Tiers = VOLUME_TIERS): number {
  let p = 0;
  for (const t of tiers) if (t.pct !== null) p = Math.max(p, t.pct);
  return p;
}

// ---------------------------------------------------------------- input parsing

export type SeatsParse = {
  /** null when nothing usable was entered */
  seats: number | null;
  status: "ok" | "empty" | "invalid" | "rounded" | "clamped";
  message: string;
};

/** Defensive parse of whatever a person types or pastes into the team-size box. */
export function parseSeats(raw: unknown): SeatsParse {
  if (typeof raw === "number") raw = Number.isFinite(raw) ? String(raw) : "";
  const s0 = typeof raw === "string" ? raw : "";
  const s = s0.replace(/[\s,_ ']/g, "").replace(/^\+/, "");
  if (s === "") return { seats: null, status: "empty", message: `Enter a whole number from ${MIN_SEATS} to ${MAX_SEATS.toLocaleString("en-US")}.` };
  if (!/^-?\d+(\.\d+)?$/.test(s)) return { seats: null, status: "invalid", message: "Use digits only, for example 25." };
  const n = Number(s);
  if (!Number.isFinite(n)) return { seats: null, status: "invalid", message: "That number is too large." };
  if (n < MIN_SEATS) return { seats: MIN_SEATS, status: "clamped", message: `Team size starts at ${MIN_SEATS}; using ${MIN_SEATS}.` };
  if (n > MAX_SEATS) return { seats: MAX_SEATS, status: "clamped", message: `Online sizing goes up to ${MAX_SEATS.toLocaleString("en-US")} seats; using ${MAX_SEATS.toLocaleString("en-US")}. Request a quote for more.` };
  if (!Number.isInteger(n)) {
    const r = Math.min(MAX_SEATS, Math.max(MIN_SEATS, Math.round(n)));
    return { seats: r, status: "rounded", message: `Seats are whole numbers; rounded to ${r}.` };
  }
  return { seats: n, status: "ok", message: "" };
}

export function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function normalizeAddons(a: unknown): Addons {
  const out: Addons = {};
  if (!a || typeof a !== "object") return out;
  for (const p of ADDON_PACKS) {
    const q = clampInt((a as Record<string, unknown>)[p.id], 0, MAX_ADDON_QTY, 0);
    if (q > 0) out[p.id] = q;
  }
  return out;
}

// ---------------------------------------------------------------- the calculator

export type QuoteInput = {
  seats: number;
  billing?: Billing;
  addons?: Addons;
  /** expected monthly credits; undefined/null = "use the included pool" */
  expectedCredits?: number | null;
  tiers?: Tiers;
};

export type Estimate = {
  seats: number;
  billing: Billing;
  tiers: Tiers;
  /** null = custom tier */
  pct: number | null;
  custom: boolean;
  /** discount actually applied (custom uses the indicative floor) */
  effPct: number;
  seatListCents: number;
  volumeDiscountCents: number;
  /** seats after volume discount, monthly billing */
  seatsMonthlyCents: number;
  /** seats for the chosen billing cycle, per month */
  seatsCents: number;
  annualSeatAdjustCents: number;
  /** per-seat price after volume discount (and annual rule if chosen), per month; may be fractional cents */
  perSeatCents: number;
  perSeatListCents: number;
  addons: { id: AddonId; qty: number; credits: number; unitCents: number; monthlyCents: number; cents: number }[];
  addonCredits: number;
  addonsMonthlyCents: number;
  /** add-ons for the chosen billing cycle, per month */
  addonsCents: number;
  annualAddonAdjustCents: number;
  /** grand total per month for the chosen billing cycle */
  monthlyTotalCents: number;
  /** 12 x monthlyTotalCents */
  annualTotalCents: number;
  monthlyBillingTotalCents: number;
  annualBillingMonthlyCents: number;
  annualBillingTotalCents: number;
  /** what annual billing saves per year versus monthly billing */
  annualSavingsCents: number;
  includedPool: number;
  totalPool: number;
  expectedCredits: number;
  headroom: number;
  shortfall: number;
  individualCents: number;
  savingsCents: number;
};

export function computeQuote(input: QuoteInput): Estimate {
  const tiers = input.tiers ?? VOLUME_TIERS;
  const seats = clampInt(input.seats, MIN_SEATS, MAX_SEATS, MIN_SEATS);
  const billing: Billing = input.billing === "annual" ? "annual" : "monthly";
  const pct = tierPct(seats, tiers);
  const effPct = pct ?? customFloorPct(tiers);
  const seatListCents = seats * SEAT_PRICE_CENTS;
  const seatsMonthlyCents = divRound(seatListCents * (100 - effPct), 100);
  const volumeDiscountCents = seatListCents - seatsMonthlyCents;
  const seatsCents = billing === "annual" ? annualCents(seatsMonthlyCents) : seatsMonthlyCents;

  const norm = normalizeAddons(input.addons);
  const addons = ADDON_PACKS.filter((p) => norm[p.id]).map((p) => {
    const qty = norm[p.id]!;
    const unitCents = addonPackCents(p.credits);
    const monthlyCents = unitCents * qty;
    return { id: p.id, qty, credits: p.credits * qty, unitCents, monthlyCents, cents: billing === "annual" ? annualCents(monthlyCents) : monthlyCents };
  });
  const addonsMonthlyCents = addons.reduce((a, x) => a + x.monthlyCents, 0);
  const addonsCents = addons.reduce((a, x) => a + x.cents, 0);
  const addonCredits = addons.reduce((a, x) => a + x.credits, 0);

  const monthlyTotalCents = seatsCents + addonsCents;
  const monthlyBillingTotalCents = seatsMonthlyCents + addonsMonthlyCents;
  const annualBillingMonthlyCents = annualCents(seatsMonthlyCents) + addons.reduce((a, x) => a + annualCents(x.monthlyCents), 0);

  const includedPool = seats * CREDITS_PER_SEAT;
  const totalPool = includedPool + addonCredits;
  const expectedCredits =
    input.expectedCredits === null || input.expectedCredits === undefined ? totalPool : clampInt(input.expectedCredits, 0, MAX_EXPECTED_CREDITS, totalPool);

  // individual Pro plans buying the same pool at the Pro credit rate (same billing basis)
  const individualMonthly = divRound(includedPool * PRO_PER_1000_CENTS, 1000);
  const individualCents = billing === "annual" ? annualCents(individualMonthly) : individualMonthly;

  return {
    seats,
    billing,
    tiers,
    pct,
    custom: pct === null,
    effPct,
    seatListCents,
    volumeDiscountCents,
    seatsMonthlyCents,
    seatsCents,
    annualSeatAdjustCents: billing === "annual" ? seatsMonthlyCents - seatsCents : 0,
    perSeatCents: seatsCents / seats,
    perSeatListCents: SEAT_PRICE_CENTS,
    addons,
    addonCredits,
    addonsMonthlyCents,
    addonsCents,
    annualAddonAdjustCents: billing === "annual" ? addonsMonthlyCents - addonsCents : 0,
    monthlyTotalCents,
    annualTotalCents: monthlyTotalCents * 12,
    monthlyBillingTotalCents,
    annualBillingMonthlyCents,
    annualBillingTotalCents: annualBillingMonthlyCents * 12,
    annualSavingsCents: Math.max(0, (monthlyBillingTotalCents - annualBillingMonthlyCents) * 12),
    includedPool,
    totalPool,
    expectedCredits,
    headroom: Math.max(0, totalPool - expectedCredits),
    shortfall: Math.max(0, expectedCredits - totalPool),
    individualCents,
    savingsCents: Math.max(0, individualCents - seatsCents),
  };
}

// ---------------------------------------------------------------- formatting

/** $1,234 or $1,234.56 from integer cents (whole dollars drop the decimals). */
export function formatCents(cents: number): string {
  const neg = cents < 0;
  const c = Math.abs(Math.round(cents));
  const d = Math.floor(c / 100);
  const r = c % 100;
  return `${neg ? "-" : ""}$${d.toLocaleString("en-US")}${r ? `.${String(r).padStart(2, "0")}` : ""}`;
}
export const formatNum = (n: number) => Math.round(n).toLocaleString("en-US");

// ---------------------------------------------------------------- URL state

export type CalcState = { seats: number; billing: Billing; addons: Addons; expectedCredits: number | null };
export const DEFAULT_CALC: CalcState = { seats: 25, billing: "monthly", addons: {}, expectedCredits: null };

/** Parse `?seats=&billing=&addons=5k:2,20k:1&credits=` defensively; anything unusable falls back to defaults. */
export function parseCalcSearch(search: string): CalcState {
  let p: URLSearchParams;
  try {
    p = new URLSearchParams(search);
  } catch {
    return { ...DEFAULT_CALC };
  }
  const sp = parseSeats(p.get("seats") ?? "");
  const seats = sp.seats ?? DEFAULT_CALC.seats;
  const billing: Billing = p.get("billing") === "annual" ? "annual" : "monthly";
  const addons: Addons = {};
  for (const part of (p.get("addons") ?? "").slice(0, 200).split(",")) {
    const [id, q] = part.split(":");
    const pack = ADDON_PACKS.find((a) => a.id === id);
    if (pack) {
      const n = clampInt(q, 0, MAX_ADDON_QTY, 0);
      if (n > 0) addons[pack.id] = n;
    }
  }
  const cr = p.get("credits");
  const expectedCredits = cr && /^\d{1,9}$/.test(cr) ? clampInt(cr, 0, MAX_EXPECTED_CREDITS, 0) : null;
  return { seats, billing, addons, expectedCredits };
}

export function serializeCalc(s: CalcState): string {
  const p = new URLSearchParams();
  p.set("seats", String(s.seats));
  p.set("billing", s.billing);
  const a = ADDON_PACKS.filter((x) => s.addons[x.id]).map((x) => `${x.id}:${s.addons[x.id]}`).join(",");
  if (a) p.set("addons", a);
  if (s.expectedCredits !== null) p.set("credits", String(s.expectedCredits));
  return p.toString();
}

/** Plain-text summary for the copy button. */
export function summaryText(e: Estimate): string {
  const lines = [
    "Kinetic Enterprise: indicative estimate (not a quote)",
    `Seats: ${formatNum(e.seats)}${e.custom ? " (custom tier, indicative floor discount)" : ""}`,
    `Billing: ${e.billing === "annual" ? `annual (same rate as yearly plans, ${ANNUAL_DISCOUNT_PCT}% off monthly)` : "monthly"}`,
    `Volume discount: ${e.custom ? "custom" : `${e.pct}%`} (${formatCents(e.volumeDiscountCents)}/mo)`,
    `Per seat: ${formatCents(Math.round(e.perSeatCents))}/mo`,
    `Credit pool: ${formatNum(e.totalPool)} credits/mo (${formatNum(e.includedPool)} included + ${formatNum(e.addonCredits)} add-ons)`,
  ];
  for (const a of e.addons) lines.push(`Add-on: ${a.qty} x ${formatNum(a.credits / a.qty)} credits = ${formatCents(a.cents)}/mo`);
  lines.push(`Monthly total: ${formatCents(e.monthlyTotalCents)}`, `Annual total: ${formatCents(e.annualTotalCents)}`, "Indicative only; a written quote is the source of truth.");
  return lines.join("\n");
}

/** Smallest set of add-on packs (largest first, last one rounded up) that covers a credit shortfall. */
export function suggestAddons(shortfall: number): Addons {
  const out: Addons = {};
  let left = Math.max(0, Math.ceil(shortfall));
  const packs = [...ADDON_PACKS].sort((a, b) => b.credits - a.credits);
  for (let i = 0; i < packs.length && left > 0; i++) {
    const p = packs[i];
    const last = i === packs.length - 1;
    const q = Math.min(MAX_ADDON_QTY, last ? Math.ceil(left / p.credits) : Math.floor(left / p.credits));
    if (q > 0) {
      out[p.id] = q;
      left -= q * p.credits;
    }
  }
  return out;
}
