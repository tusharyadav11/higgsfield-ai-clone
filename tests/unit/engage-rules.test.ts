import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  check,
  DEFAULT_TIMING,
  emptySession,
  emptyState,
  isAway,
  isCreditLow,
  isStreakAtRisk,
  markShown,
  pick,
  POPUP_META,
  sanitize,
  stillValid,
  type Ctx,
  type Snapshot,
} from "../../src/lib/engage/rules";

const T0 = Date.UTC(2026, 9, 24, 12, 0, 0);
const ctx = (o: Partial<Ctx> = {}): Ctx => ({ now: T0 + 30_000, visitStart: T0, path: "/", jobRunning: false, overlay: false, tipsEnabled: true, ...o });
const T = DEFAULT_TIMING;

describe("engage rules", () => {
  beforeEach(() => vi.useFakeTimers({ now: T0 }));
  afterEach(() => vi.useRealTimers());

  it("allows a popup after the quiet period", () => {
    expect(check("credit-low", emptyState(), emptySession(), ctx(), T)).toEqual({ ok: true });
  });

  it("blocks during the first 20s of a visit, using the injected clock", () => {
    expect(check("credit-low", emptyState(), emptySession(), ctx({ now: T0 + 19_999 }), T)).toEqual({ ok: false, reason: "quiet" });
    vi.advanceTimersByTime(20_000);
    expect(check("credit-low", emptyState(), emptySession(), ctx({ now: Date.now() }), T).ok).toBe(true);
  });

  it("blocks on auth routes, running jobs and overlays", () => {
    const st = emptyState();
    const ss = emptySession();
    expect(check("credit-low", st, ss, ctx({ path: "/login" }), T)).toEqual({ ok: false, reason: "route" });
    expect(check("credit-low", st, ss, ctx({ path: "/signup/x" }), T)).toEqual({ ok: false, reason: "route" });
    expect(check("credit-low", st, ss, ctx({ path: "/loginx" }), T).ok).toBe(true);
    expect(check("credit-low", st, ss, ctx({ jobRunning: true }), T)).toEqual({ ok: false, reason: "job" });
    expect(check("credit-low", st, ss, ctx({ overlay: true }), T)).toEqual({ ok: false, reason: "overlay" });
  });

  it("caps at 2 per session and enforces a 60s gap", () => {
    const st = emptyState();
    let ss = emptySession();
    const a = markShown("credit-low", st, ss, T0 + 30_000);
    ss = a.session;
    expect(check("streak-risk", a.state, ss, ctx({ now: T0 + 60_000 }), T)).toEqual({ ok: false, reason: "gap" });
    expect(check("streak-risk", a.state, ss, ctx({ now: T0 + 90_000 }), T).ok).toBe(true);
    const b = markShown("streak-risk", a.state, ss, T0 + 90_000);
    expect(check("guest-nudge", b.state, b.session, ctx({ now: T0 + 10 * 60_000 }), T)).toEqual({ ok: false, reason: "cap" });
  });

  it("applies per-type cooldowns", () => {
    const { state } = markShown("credit-low", emptyState(), emptySession(), T0);
    const day = POPUP_META["credit-low"].cooldownMs;
    expect(check("credit-low", state, emptySession(), ctx({ now: T0 + day - 1 }), T)).toEqual({ ok: false, reason: "cooldown" });
    expect(check("credit-low", state, emptySession(), ctx({ now: T0 + day }), T).ok).toBe(true);
  });

  it("once-only popups never come back", () => {
    const { state } = markShown("first-creation", emptyState(), emptySession(), T0);
    expect(state.done["first-creation"]).toBe(true);
    expect(check("first-creation", state, emptySession(), ctx({ now: T0 + 400 * 86400_000 }), T)).toEqual({ ok: false, reason: "done" });
  });

  it("guest nudge repeats only after 7 days", () => {
    const { state } = markShown("guest-nudge", emptyState(), emptySession(), T0);
    expect(check("guest-nudge", state, emptySession(), ctx({ now: T0 + 6 * 86400_000 }), T).ok).toBe(false);
    expect(check("guest-nudge", state, emptySession(), ctx({ now: T0 + 7 * 86400_000 }), T).ok).toBe(true);
  });

  it("respects mute (per type), pause (global) and the Tips setting", () => {
    const st = { ...emptyState(), muted: { "credit-low": true as const } };
    expect(check("credit-low", st, emptySession(), ctx(), T)).toEqual({ ok: false, reason: "muted" });
    expect(check("streak-risk", st, emptySession(), ctx(), T).ok).toBe(true);
    expect(check("streak-risk", { ...emptyState(), paused: true }, emptySession(), ctx(), T)).toEqual({ ok: false, reason: "paused" });
    expect(check("streak-risk", emptyState(), emptySession(), ctx({ tipsEnabled: false }), T)).toEqual({ ok: false, reason: "tips-off" });
  });

  it("picks the highest priority eligible candidate", () => {
    const st = { ...emptyState(), muted: { "first-creation": true as const } };
    expect(pick(["idle-create", "credit-low", "first-creation"], st, emptySession(), ctx(), T)).toBe("credit-low");
    expect(pick(["idle-create", "credit-low"], emptyState(), emptySession(), ctx({ overlay: true }), T)).toBeNull();
    expect(pick([], emptyState(), emptySession(), ctx(), T)).toBeNull();
  });

  it("shortened timing (debug override) is honoured", () => {
    const fast = { ...T, quietMs: 100, gapMs: 200 };
    expect(check("credit-low", emptyState(), emptySession(), ctx({ now: T0 + 150 }), fast).ok).toBe(true);
  });
});

describe("sensors", () => {
  it("credit low: <=10 or <=20% of baseline", () => {
    expect(isCreditLow(10, 50)).toBe(true);
    expect(isCreditLow(11, 50)).toBe(false);
    expect(isCreditLow(40, 200)).toBe(true);
    expect(isCreditLow(41, 200)).toBe(false);
    expect(isCreditLow(11, null)).toBe(false);
  });

  it("streak at risk needs streak>=2, yesterday's claim and 18:00+", () => {
    const base = { streak: 3, lastClaim: "2026-10-23", now: T0, hour: 19 };
    expect(isStreakAtRisk(base)).toBe(true);
    expect(isStreakAtRisk({ ...base, hour: 17 })).toBe(false);
    expect(isStreakAtRisk({ ...base, streak: 1 })).toBe(false);
    expect(isStreakAtRisk({ ...base, lastClaim: "2026-10-24" })).toBe(false); // already claimed today
    expect(isStreakAtRisk({ ...base, lastClaim: "2026-10-20" })).toBe(false); // streak already lost, no false hope
  });

  it("away means 3+ days", () => {
    expect(isAway(null, T0)).toBe(false);
    expect(isAway(T0 - 3 * 86400_000 + 1, T0)).toBe(false);
    expect(isAway(T0 - 3 * 86400_000, T0)).toBe(true);
  });

  it("stillValid per popup", () => {
    const s: Snapshot = { now: T0, hour: 19, path: "/create", credits: 5, baseline: 50, streak: 0, lastClaim: null, signedIn: false, libraryLen: 1, promptEmpty: true, trendingReady: false };
    expect(stillValid("credit-low", s)).toBe(true);
    expect(stillValid("credit-low", { ...s, credits: 40 })).toBe(false);
    expect(stillValid("idle-create", { ...s, path: "/" })).toBe(false);
    expect(stillValid("idle-create", { ...s, promptEmpty: false })).toBe(false);
    expect(stillValid("guest-nudge", { ...s, signedIn: true })).toBe(false);
    expect(stillValid("welcome-back", s)).toBe(false);
    expect(stillValid("first-creation", { ...s, libraryLen: 0 })).toBe(false);
  });
});

describe("sanitize", () => {
  it("survives garbage", () => {
    expect(sanitize(null)).toEqual(emptyState());
    expect(sanitize("x")).toEqual(emptyState());
    const s = sanitize({ paused: true, muted: { "credit-low": true, bogus: true }, lastShown: { "credit-low": "no" }, counters: { gens: -4, actions: 2 } });
    expect(s.paused).toBe(true);
    expect(s.muted).toEqual({ "credit-low": true });
    expect(s.lastShown).toEqual({});
    expect(s.counters).toEqual({ gens: 0, actions: 2 });
  });
});
