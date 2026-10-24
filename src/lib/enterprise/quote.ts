/** Shared (client + server) validation and sanitising for quote and demo requests. Pure; no I/O. */
import { ANNUAL_DISCOUNT_PCT, MAX_EXPECTED_CREDITS, MAX_SEATS, MIN_SEATS, computeQuote, normalizeAddons, type Addons, type Billing } from "./pricing";

export const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const LIMITS = { name: 100, email: 200, company: 150, message: 1000, other: 200, tz: 60, teamSizeServer: 100000 } as const;

export const USE_CASES = [
  { id: "agency", label: "Creative agency" },
  { id: "brand", label: "In-house brand team" },
  { id: "studio", label: "Film, game or animation studio" },
  { id: "education", label: "Education or research" },
  { id: "other", label: "Something else" },
] as const;
export type UseCaseId = (typeof USE_CASES)[number]["id"];

export const DEMO_WINDOWS = [
  { id: "weekday-morning", label: "Weekday mornings" },
  { id: "weekday-afternoon", label: "Weekday afternoons" },
  { id: "weekday-evening", label: "Weekday evenings" },
  { id: "flexible", label: "Flexible, any time" },
] as const;
export type DemoWindowId = (typeof DEMO_WINDOWS)[number]["id"];

export type Kind = "quote" | "demo";

export type QuoteValue = {
  kind: Kind;
  name: string;
  email: string;
  company: string;
  teamSize: number;
  expectedCredits: number | null;
  useCase: string;
  message: string;
  billingCycle: Billing;
  config: {
    seats: number;
    billing: Billing;
    addons: Addons;
    expectedCredits: number | null;
    indicative: { monthlyTotalCents: number; annualTotalCents: number; custom: boolean; annualRuleDiscountPct: number };
    demo?: { window: DemoWindowId; timezone: string };
  };
};
export type QuoteErrors = Partial<Record<"name" | "email" | "company" | "teamSize" | "expectedCredits" | "useCase" | "useCaseOther" | "message" | "window", string>>;
export type QuoteResult = { ok: true; value: QuoteValue } | { ok: false; errors: QuoteErrors };

const FREE_MAIL = /@(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|me|aol|proton|protonmail|gmx|mail|qq|163)\.[a-z.]+$/i;
export const isFreeMail = (email: string) => FREE_MAIL.test(email.trim());

const CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
/** Trim, strip control chars, cap length. Newlines/tabs are kept (callers decide). */
export const clean = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(CTRL, "").trim().slice(0, max) : "");
const oneLine = (v: unknown, max: number) => clean(v, max * 2).replace(/\s+/g, " ").trim().slice(0, max);

function intOf(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && /^\s*-?\d+(\.\d+)?\s*$/.test(v)) return Number(v);
  return null;
}

export function validateQuote(raw: unknown): QuoteResult {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: QuoteErrors = {};
  const kind: Kind = b.kind === "demo" ? "demo" : "quote";
  const name = oneLine(b.name, LIMITS.name);
  const email = oneLine(b.email, LIMITS.email);
  const company = oneLine(b.company, LIMITS.company);
  const message = clean(b.message, LIMITS.message);
  if (typeof b.message === "string" && b.message.trim().length > LIMITS.message) errors.message = `Keep your message under ${LIMITS.message} characters.`;
  if (name.length < 2) errors.name = "Enter your full name.";
  if (!EMAIL_FORMAT.test(email)) errors.email = "Enter a valid email address, like name@company.com.";
  if (!company) errors.company = "Enter your company or organisation.";

  const sizeRaw = b.teamSize ?? b.size;
  let teamSize = intOf(sizeRaw);
  if (teamSize === null || !Number.isInteger(teamSize) || teamSize < MIN_SEATS || teamSize > LIMITS.teamSizeServer) {
    if (kind === "demo" && (sizeRaw === undefined || sizeRaw === "" || sizeRaw === null)) teamSize = 1;
    else {
      errors.teamSize = `Enter a whole number of seats from ${MIN_SEATS} to ${LIMITS.teamSizeServer.toLocaleString("en-US")}.`;
      teamSize = MIN_SEATS;
    }
  }

  let expectedCredits: number | null = null;
  if (b.expectedCredits !== undefined && b.expectedCredits !== null && b.expectedCredits !== "") {
    const n = intOf(b.expectedCredits);
    if (n === null || !Number.isInteger(n) || n < 0 || n > MAX_EXPECTED_CREDITS) errors.expectedCredits = "Enter expected monthly credits as a whole number (0 or more).";
    else expectedCredits = n;
  }

  // use case: structured (select + other) or the legacy free-text field
  let useCase = "";
  const kindId = typeof b.useCaseKind === "string" ? b.useCaseKind : "";
  const uc = USE_CASES.find((u) => u.id === kindId);
  if (uc) {
    if (uc.id === "other") {
      const other = oneLine(b.useCaseOther, LIMITS.other);
      if (other.length < 3) errors.useCaseOther = "Tell us briefly what you plan to use Kinetic for.";
      useCase = `Other: ${other}`;
    } else useCase = uc.label;
  } else if (kind === "demo") {
    useCase = oneLine(b.useCase, LIMITS.other) || "Demo request";
  } else {
    const legacy = clean(b.useCase, 2000);
    if (legacy.length < 10) errors.useCase = "Choose the use case that fits best.";
    useCase = legacy;
  }

  const billingCycle: Billing = b.billingCycle === "annual" || b.billing === "annual" ? "annual" : "monthly";
  const cfgIn = (b.config && typeof b.config === "object" ? b.config : {}) as Record<string, unknown>;
  const addons = normalizeAddons(cfgIn.addons);
  const seatsForCfg = Math.min(MAX_SEATS, Math.max(MIN_SEATS, Math.round(teamSize)));
  const est = computeQuote({ seats: seatsForCfg, billing: billingCycle, addons, expectedCredits });
  const config: QuoteValue["config"] = {
    seats: seatsForCfg,
    billing: billingCycle,
    addons,
    expectedCredits,
    // always recomputed server-side from the sanitised inputs; the client's numbers are never trusted
    indicative: { monthlyTotalCents: est.monthlyTotalCents, annualTotalCents: est.annualTotalCents, custom: est.custom, annualRuleDiscountPct: ANNUAL_DISCOUNT_PCT },
  };
  if (kind === "demo") {
    const w = DEMO_WINDOWS.find((x) => x.id === b.window);
    if (!w) errors.window = "Choose a preferred time window.";
    config.demo = { window: (w ?? DEMO_WINDOWS[3]).id, timezone: oneLine(b.timezone, LIMITS.tz) };
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { kind, name, email, company, teamSize: Math.round(teamSize), expectedCredits, useCase, message, billingCycle, config } };
}

// ---------------------------------------------------------------- in-memory per-IP rate limit

export type RateStore = Map<string, number[]>;
const globalStore: RateStore = new Map();

/** Sliding window. Returns `ok:false` plus seconds to wait. Entries are pruned as they age out. */
export function rateLimit(ip: string, now: number, opts: { max?: number; windowMs?: number; store?: RateStore } = {}): { ok: boolean; retryAfter: number } {
  const max = opts.max ?? 8;
  const windowMs = opts.windowMs ?? 10 * 60_000;
  const store = opts.store ?? globalStore;
  const hits = (store.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    store.set(ip, hits);
    return { ok: false, retryAfter: Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000)) };
  }
  hits.push(now);
  store.set(ip, hits);
  if (store.size > 5000) for (const [k, v] of store) if (v.every((t) => now - t >= windowMs)) store.delete(k);
  return { ok: true, retryAfter: 0 };
}
