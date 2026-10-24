import { describe, expect, it } from "vitest";
import { rateLimit, validateQuote, isFreeMail, LIMITS } from "../../src/lib/enterprise/quote";

const base = { name: "Ada Lovelace", email: "ada@studio.co", company: "Studio", teamSize: 25, useCaseKind: "agency" };

describe("validateQuote", () => {
  it("accepts a minimal valid quote and recomputes the indicative config", () => {
    const r = validateQuote({ ...base, billingCycle: "annual", config: { addons: { "5k": 2 } }, expectedCredits: "40000" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.kind).toBe("quote");
    expect(r.value.useCase).toBe("Creative agency");
    expect(r.value.expectedCredits).toBe(40000);
    expect(r.value.config.addons).toEqual({ "5k": 2 });
    expect(r.value.config.indicative.monthlyTotalCents).toBeGreaterThan(0);
    expect(r.value.config.indicative.annualTotalCents).toBe(r.value.config.indicative.monthlyTotalCents * 12);
  });
  it("does not trust client-sent totals", () => {
    const r = validateQuote({ ...base, config: { indicative: { monthlyTotalCents: 1 } } });
    expect(r.ok && r.value.config.indicative.monthlyTotalCents).toBe(25 * 1900 * 0.9);
  });
  it.each([
    [{ name: "A" }, "name"], [{ email: "nope" }, "email"], [{ email: "a@b" }, "email"], [{ company: "  " }, "company"],
    [{ teamSize: 0 }, "teamSize"], [{ teamSize: 2.5 }, "teamSize"], [{ teamSize: "x" }, "teamSize"], [{ teamSize: 100001 }, "teamSize"],
    [{ expectedCredits: -1 }, "expectedCredits"], [{ expectedCredits: "1.5" }, "expectedCredits"],
    [{ useCaseKind: "other", useCaseOther: "" }, "useCaseOther"], [{ useCaseKind: "bogus" }, "useCase"],
    [{ message: "x".repeat(LIMITS.message + 1) }, "message"],
  ])("rejects %j on %s", (patch, field) => {
    const r = validateQuote({ ...base, ...patch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveProperty(field as string);
  });
  it("accepts free-mail (format only) but flags it as a soft hint", () => {
    expect(validateQuote({ ...base, email: "ada@gmail.com" }).ok).toBe(true);
    expect(isFreeMail("ada@gmail.com")).toBe(true);
    expect(isFreeMail("ada@studio.co")).toBe(false);
  });
  it("accepts the legacy size/useCase fields", () => {
    const r = validateQuote({ name: "Ada L", email: "a@b.co", company: "X", size: 10, useCase: "Brand campaigns at scale" });
    expect(r.ok).toBe(true);
  });
  it("sanitises control characters and caps lengths", () => {
    const r = validateQuote({ ...base, name: "Ada\u0000 \u0007Lovelace" + "x".repeat(500) });
    expect(r.ok && r.value.name.length).toBeLessThanOrEqual(LIMITS.name);
    expect(r.ok && /[\u0000-\u0008]/.test(r.value.name)).toBe(false);
  });
  it("demo requires a time window; team size is optional", () => {
    expect(validateQuote({ kind: "demo", name: "Ada L", email: "a@b.co", company: "X" }).ok).toBe(false);
    const r = validateQuote({ kind: "demo", name: "Ada L", email: "a@b.co", company: "X", window: "flexible", timezone: "Europe/London" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.config.demo).toEqual({ window: "flexible", timezone: "Europe/London" });
  });
  it("never throws on junk input", () => {
    for (const j of [null, undefined, 5, "x", [], {}]) expect(validateQuote(j).ok).toBe(false);
  });
});

describe("rateLimit", () => {
  it("allows max hits per window then blocks with Retry-After, then recovers", () => {
    const store = new Map<string, number[]>();
    for (let i = 0; i < 3; i++) expect(rateLimit("1.1.1.1", 1000 + i, { max: 3, windowMs: 10_000, store }).ok).toBe(true);
    const blocked = rateLimit("1.1.1.1", 2000, { max: 3, windowMs: 10_000, store });
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(rateLimit("2.2.2.2", 2000, { max: 3, windowMs: 10_000, store }).ok).toBe(true);
    expect(rateLimit("1.1.1.1", 12_000, { max: 3, windowMs: 10_000, store }).ok).toBe(true);
  });
});
