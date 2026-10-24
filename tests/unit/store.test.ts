// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
  } as Storage;
}

type Action = (...a: unknown[]) => unknown;
type StoreHook = { getState: () => Record<string, unknown>; setState: (p: Record<string, unknown>) => void };
const isStoreHook = (v: unknown): v is StoreHook => typeof v === "function" && typeof (v as Partial<StoreHook>).getState === "function";

async function freshStore(): Promise<StoreHook> {
  vi.stubGlobal("localStorage", memoryStorage());
  if (typeof window !== "undefined") Object.defineProperty(window, "localStorage", { value: (globalThis as { localStorage: Storage }).localStorage, configurable: true });
  vi.resetModules();
  let mod: Record<string, unknown>;
  try {
    mod = await import("../../src/lib/store");
  } catch (e) {
    throw new Error(`Cannot import src/lib/store.ts (not implemented yet?): ${(e as Error).message}`);
  }
  const hook = Object.values(mod).find(isStoreHook);
  if (!hook) throw new Error("store.ts must export a zustand hook (with .getState)");
  return hook;
}
function act(s: StoreHook, names: string[]): Action {
  const st = s.getState();
  for (const n of names) {
    const f = st[n];
    if (typeof f === "function") return f as Action;
  }
  throw new Error(`store action not found; tried [${names.join(", ")}]. Actions present: ${Object.keys(st).filter((k) => typeof st[k] === "function").join(", ")}`);
}
const CLAIM = ["claimDaily", "claim", "claimDailyCredits", "claimStreak", "claimDailyReward"];
const SPEND = ["spend", "spendCredits", "deduct", "charge"];
const LIKE = ["toggleLike", "like", "toggleLikes"];
const at = (iso: string) => vi.setSystemTime(new Date(iso));

beforeEach(() => vi.useFakeTimers({ toFake: ["Date"] }));
afterEach(() => vi.useRealTimers());

describe("store: initial state", () => {
  it("starts with 50 credits, streak 0, empty library/likes", async () => {
    const s = await freshStore();
    const st = s.getState();
    expect(st.credits).toBe(50);
    expect(st.streak).toBe(0);
    expect(st.library).toEqual([]);
    expect(st).toHaveProperty("lastClaim");
    expect(st).toHaveProperty("likes");
  });
});

describe("store: daily claim", () => {
  it("claims once per UTC day", async () => {
    const s = await freshStore();
    at("2026-03-10T00:00:30Z");
    const claim = act(s, CLAIM);
    const before = s.getState().credits as number;
    claim();
    const after1 = s.getState().credits as number;
    expect(after1, "first claim must add credits").toBeGreaterThan(before);
    expect(s.getState().streak).toBe(1);
    at("2026-03-10T23:59:59Z");
    claim();
    expect(s.getState().credits, "second claim same UTC day must not add credits").toBe(after1);
    expect(s.getState().streak).toBe(1);
  });

  it("continues streak on consecutive UTC day, resets after a gap", async () => {
    const s = await freshStore();
    const claim = act(s, CLAIM);
    at("2026-03-10T23:59:00Z"); claim();
    at("2026-03-11T00:01:00Z"); claim();
    expect(s.getState().streak, "consecutive days across UTC midnight").toBe(2);
    at("2026-03-12T12:00:00Z"); claim();
    expect(s.getState().streak).toBe(3);
    at("2026-03-15T12:00:00Z"); claim();
    expect(s.getState().streak, "gap of 2+ days resets to 1").toBe(1);
  });

  it("persists to localStorage", async () => {
    const s = await freshStore();
    at("2026-03-10T10:00:00Z");
    act(s, CLAIM)();
    expect(localStorage.length, "persist should write localStorage").toBeGreaterThan(0);
  });
});

describe("store: spend", () => {
  it("deducts and never goes negative", async () => {
    const s = await freshStore();
    const spend = act(s, SPEND);
    const r1 = spend(20);
    expect(s.getState().credits).toBe(30);
    expect(r1, "spend should return success truthy when ok").not.toBe(false);
    const r2 = spend(100);
    expect(s.getState().credits, "insufficient spend must not change balance").toBe(30);
    expect(r2, "insufficient spend should return false").toBe(false);
    spend(30);
    expect(s.getState().credits).toBe(0);
    spend(1);
    expect(s.getState().credits).toBe(0);
    expect(s.getState().credits).toBeGreaterThanOrEqual(0);
  });
});

describe("store: likes", () => {
  it("toggles like on and off", async () => {
    const s = await freshStore();
    const like = act(s, LIKE);
    const has = () => {
      const l = s.getState().likes as string[] | Record<string, boolean>;
      return Array.isArray(l) ? l.includes("p1") : !!l["p1"];
    };
    expect(has()).toBe(false);
    like("p1");
    expect(has()).toBe(true);
    like("p1");
    expect(has()).toBe(false);
  });
});
