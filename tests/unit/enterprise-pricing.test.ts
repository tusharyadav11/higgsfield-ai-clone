import { describe, expect, it } from "vitest";
import { CREDITS_PER_SEAT, INDIVIDUAL_PRO_PER_1000_CREDITS, SEAT_PRICE, enterpriseEstimate, volumePct } from "../../src/lib/plans";
import {
  ADDON_PACKS, ANNUAL_DISCOUNT_PCT, DEFAULT_CALC, MAX_SEATS, addonPackCents, annualCents, computeQuote, formatCents, parseCalcSearch, parseSeats, serializeCalc, summaryText,
  type Addons, type Billing,
} from "../../src/lib/enterprise/pricing";

// deterministic LCG so "randomised" runs are reproducible
const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

describe("existing rules preserved", () => {
  it("matches enterpriseEstimate for monthly billing at every seat count 1..600", () => {
    for (let s = 1; s <= 600; s++) {
      const e = enterpriseEstimate(s);
      const q = computeQuote({ seats: s });
      expect(q.seatsCents / 100, `seats ${s}`).toBe(e.monthly);
      expect(q.seatListCents / 100).toBe(e.list);
      expect(q.includedPool).toBe(e.pool);
      expect(q.individualCents / 100).toBe(e.individual);
      expect(q.savingsCents / 100).toBe(e.savings);
      expect(q.pct).toBe(e.pct);
      expect(q.custom).toBe(e.custom);
    }
  });
  it("annual rule is the Pro yearly/monthly ratio (12/15 = 20% off)", () => {
    expect(ANNUAL_DISCOUNT_PCT).toBe(20);
    expect(annualCents(1500)).toBe(1200);
    expect(annualCents(0)).toBe(0);
  });
});

describe("tier boundaries", () => {
  const cases: [number, number | null][] = [[1, 0], [9, 0], [10, 5], [24, 5], [25, 10], [99, 10], [100, 15], [499, 15], [500, null], [501, null], [5000, null]];
  it.each(cases)("%i seats -> %s", (seats, pct) => {
    expect(computeQuote({ seats }).pct).toBe(pct);
    expect(volumePct(seats)).toBe(pct);
  });
  it("custom tier uses the 15% indicative floor", () => {
    const q = computeQuote({ seats: 500 });
    expect(q.custom).toBe(true);
    expect(q.effPct).toBe(15);
    expect(q.seatsMonthlyCents).toBe(500 * SEAT_PRICE * 100 * 0.85);
  });
  it("supports configurable tiers", () => {
    const tiers = [{ min: 0, pct: 0, label: "a" }, { min: 5, pct: 50, label: "b" }];
    expect(computeQuote({ seats: 4, tiers }).pct).toBe(0);
    expect(computeQuote({ seats: 5, tiers }).pct).toBe(50);
    expect(computeQuote({ seats: 5, tiers }).seatsCents).toBe(5 * 1900 * 0.5);
  });
});

describe("billing", () => {
  it("annual is 80% of monthly and annual total = 12 x monthly effective", () => {
    const m = computeQuote({ seats: 25, billing: "monthly" });
    const a = computeQuote({ seats: 25, billing: "annual" });
    expect(m.seatsCents).toBe(25 * 1900 * 0.9);
    expect(a.seatsCents).toBe(annualCents(m.seatsCents));
    expect(a.annualTotalCents).toBe(a.monthlyTotalCents * 12);
    expect(m.annualTotalCents).toBe(m.monthlyTotalCents * 12);
    expect(a.annualSavingsCents).toBe((m.monthlyTotalCents - a.monthlyTotalCents) * 12);
    expect(m.annualBillingTotalCents).toBe(a.annualTotalCents);
  });
});

describe("add-ons", () => {
  it("are priced at the Pro credit rate", () => {
    for (const p of ADDON_PACKS) expect(addonPackCents(p.credits)).toBe((p.credits / 1000) * INDIVIDUAL_PRO_PER_1000_CREDITS * 100);
    expect(addonPackCents(5000)).toBe(7500);
    expect(addonPackCents(20000)).toBe(30000);
    expect(addonPackCents(100000)).toBe(150000);
  });
  it("add credits and cost, with the annual rule applied", () => {
    const addons: Addons = { "5k": 2, "20k": 1 };
    const m = computeQuote({ seats: 10, addons });
    expect(m.addonCredits).toBe(30000);
    expect(m.addonsCents).toBe(2 * 7500 + 30000);
    expect(m.monthlyTotalCents).toBe(m.seatsCents + m.addonsCents);
    expect(m.totalPool).toBe(10 * CREDITS_PER_SEAT + 30000);
    const a = computeQuote({ seats: 10, addons, billing: "annual" });
    expect(a.addonsCents).toBe(annualCents(m.addonsMonthlyCents));
  });
  it("ignores unknown ids and clamps absurd quantities", () => {
    const q = computeQuote({ seats: 5, addons: { "5k": 9999, bogus: 3, "20k": -2 } as unknown as Addons });
    expect(q.addons.map((a) => a.id)).toEqual(["5k"]);
    expect(q.addons[0].qty).toBe(50);
  });
});

describe("credits headroom", () => {
  it("shows headroom or shortfall against the expected credits", () => {
    expect(computeQuote({ seats: 10 }).headroom).toBe(0);
    expect(computeQuote({ seats: 10, expectedCredits: 10000 }).headroom).toBe(5000);
    const s = computeQuote({ seats: 10, expectedCredits: 20000 });
    expect(s.shortfall).toBe(5000);
    expect(s.headroom).toBe(0);
    expect(computeQuote({ seats: 10, addons: { "5k": 1 }, expectedCredits: 20000 }).shortfall).toBe(0);
  });
});

describe("properties (table-driven + randomised)", () => {
  it("never negative, always whole cents, annual <= monthly x 12, monotone in seats within a tier", () => {
    const r = rng(42);
    for (let i = 0; i < 3000; i++) {
      const seats = 1 + Math.floor(r() * MAX_SEATS);
      const billing: Billing = r() < 0.5 ? "monthly" : "annual";
      const addons: Addons = {};
      for (const p of ADDON_PACKS) if (r() < 0.5) addons[p.id] = Math.floor(r() * 10);
      const q = computeQuote({ seats, billing, addons, expectedCredits: r() < 0.5 ? Math.floor(r() * 1e6) : null });
      const nums = [q.seatListCents, q.volumeDiscountCents, q.seatsCents, q.addonsCents, q.monthlyTotalCents, q.annualTotalCents, q.savingsCents, q.headroom, q.shortfall, q.annualSavingsCents, q.totalPool, q.individualCents];
      for (const n of nums) {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(n)).toBe(true);
      }
      expect(q.annualBillingTotalCents).toBeLessThanOrEqual(q.monthlyBillingTotalCents * 12);
      expect(q.monthlyTotalCents).toBe(q.seatsCents + q.addonsCents);
      expect(q.seatListCents - q.volumeDiscountCents).toBe(q.seatsMonthlyCents);
      expect(q.headroom * q.shortfall).toBe(0);
    }
  });
  it("monthly total never decreases as seats grow inside the same tier, and a bigger tier is never pricier per seat", () => {
    for (let s = 1; s < 600; s++) {
      const a = computeQuote({ seats: s }), b = computeQuote({ seats: s + 1 });
      if (a.pct === b.pct) expect(b.seatsCents).toBeGreaterThanOrEqual(a.seatsCents);
      expect(b.perSeatCents).toBeLessThanOrEqual(a.perSeatCents + 1e-9);
    }
  });
  it("adding an add-on pack never lowers the total", () => {
    const r = rng(7);
    for (let i = 0; i < 500; i++) {
      const seats = 1 + Math.floor(r() * 800);
      const base = computeQuote({ seats, billing: r() < 0.5 ? "annual" : "monthly" });
      const more = computeQuote({ seats, billing: base.billing, addons: { "5k": 1 } });
      expect(more.monthlyTotalCents).toBeGreaterThan(base.monthlyTotalCents);
    }
  });
  it("clamps nonsense seat input rather than returning NaN", () => {
    for (const s of [NaN, -5, 0, 1e12, Infinity, 2.6] as number[]) {
      const q = computeQuote({ seats: s });
      expect(Number.isFinite(q.monthlyTotalCents)).toBe(true);
      expect(q.seats).toBeGreaterThanOrEqual(1);
      expect(q.seats).toBeLessThanOrEqual(MAX_SEATS);
    }
  });
});

describe("parseSeats", () => {
  it.each([
    ["25", 25, "ok"], [" 1,250 ", 1250, "ok"], ["", null, "empty"], ["   ", null, "empty"], ["abc", null, "invalid"], ["12abc", null, "invalid"],
    ["0", 1, "clamped"], ["-4", 1, "clamped"], ["9999", 5000, "clamped"], ["12.4", 12, "rounded"], ["12.6", 13, "rounded"], ["1e3", null, "invalid"], ["+7", 7, "ok"],
  ])("%j -> %s (%s)", (raw, seats, status) => {
    const p = parseSeats(raw);
    expect(p.seats).toBe(seats);
    expect(p.status).toBe(status);
    if (status !== "ok") expect(p.message.length).toBeGreaterThan(0);
  });
  it("handles non-string input", () => {
    expect(parseSeats(undefined).status).toBe("empty");
    expect(parseSeats(null).status).toBe("empty");
    expect(parseSeats(NaN).status).toBe("empty");
    expect(parseSeats(40).seats).toBe(40);
  });
});

describe("URL state", () => {
  it("round-trips", () => {
    const s = { seats: 120, billing: "annual" as const, addons: { "5k": 2, "100k": 1 }, expectedCredits: 250000 };
    expect(parseCalcSearch(serializeCalc(s))).toEqual(s);
  });
  it("defaults and clamps defensively", () => {
    expect(parseCalcSearch("")).toEqual(DEFAULT_CALC);
    expect(parseCalcSearch("?seats=abc&billing=weekly&addons=zzz:9,5k:x&credits=-3")).toEqual(DEFAULT_CALC);
    expect(parseCalcSearch("?seats=99999&addons=5k:999").seats).toBe(MAX_SEATS);
    expect(parseCalcSearch("?addons=5k:999").addons).toEqual({ "5k": 50 });
    expect(parseCalcSearch("?seats=-2").seats).toBe(1);
  });
});

describe("formatting", () => {
  it("formats cents", () => {
    expect(formatCents(0)).toBe("$0");
    expect(formatCents(1805)).toBe("$18.05");
    expect(formatCents(123456700)).toBe("$1,234,567");
    expect(formatCents(5)).toBe("$0.05");
  });
  it("copy summary is honest about being indicative", () => {
    const t = summaryText(computeQuote({ seats: 25, addons: { "5k": 1 } }));
    expect(t).toMatch(/not a quote/i);
    expect(t).toMatch(/Seats: 25/);
  });
});
