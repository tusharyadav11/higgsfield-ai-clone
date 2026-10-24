import { describe, expect, it } from "vitest";
import { ANNUAL_DISCOUNT_PCT, computeQuote, parseCalcSearch } from "../../src/lib/enterprise/pricing";
import { PLANS } from "../../src/lib/plans";
import { addonsLink, intentReason, nextPlan, useBilling, PLAN_LABEL } from "../../src/lib/enterprise/billing";

describe("billing demo rules", () => {
  it("annual billing follows the plans.ts yearly/monthly ratio, not a new constant", () => {
    const pro = PLANS.find((p) => p.id === "pro")!;
    expect(ANNUAL_DISCOUNT_PCT).toBe(Math.round((1 - pro.yearly / pro.monthly) * 100));
    const m = computeQuote({ seats: 10, billing: "monthly" });
    const a = computeQuote({ seats: 10, billing: "annual" });
    expect(a.monthlyTotalCents).toBe(Math.round((m.monthlyTotalCents * pro.yearly) / pro.monthly));
    expect(a.annualSavingsCents).toBeGreaterThan(0);
  });
  it("plan transitions", () => {
    expect(nextPlan("enterprise", "upgrade")).toBeNull();
    expect(nextPlan("enterprise", "downgrade")).toBe("team");
    expect(nextPlan("team", "upgrade")).toBe("enterprise");
    expect(nextPlan("team", "downgrade")).toBeNull();
    expect(nextPlan("team", "cancel")).toBe("free");
    expect(nextPlan("free", "cancel")).toBeNull();
    expect(intentReason("free", "cancel")).toMatch(/already cancelled/);
    expect(intentReason("enterprise", "downgrade")).toBeNull();
  });
  it("store records local intents only and defaults to Enterprise (quote pending)", () => {
    const s = useBilling.getState();
    expect(PLAN_LABEL[s.plan]).toBe("Enterprise (quote pending)");
    const i = useBilling.getState().recordIntent("downgrade", "2026-10-24T10:00:00.000Z");
    expect(i?.to).toBe("team");
    expect(useBilling.getState().plan).toBe("team");
    expect(useBilling.getState().recordIntent("downgrade", "2026-10-24T10:01:00.000Z")).toBeNull();
    expect(useBilling.getState().intents).toHaveLength(1);
    useBilling.getState().setAddons({ "5k": 2, "20k": 999, "100k": -3 } as never);
    expect(useBilling.getState().addons).toEqual({ "5k": 2, "20k": 50 });
  });
  it("add-on link round-trips through the shared quote parser", () => {
    const link = addonsLink(25, "annual", { "5k": 2, "20k": 1 });
    expect(link.endsWith("#quote")).toBe(true);
    const q = parseCalcSearch(link.slice(link.indexOf("?"), link.indexOf("#")));
    expect(q).toMatchObject({ seats: 25, billing: "annual", addons: { "5k": 2, "20k": 1 } });
  });
});
