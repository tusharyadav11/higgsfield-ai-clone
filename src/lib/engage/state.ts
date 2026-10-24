"use client";
import { create } from "zustand";
import { DEFAULT_TIMING, emptySession, emptyState, sanitize, type EngageState, type Session, type Timing } from "./rules";

const KEY = "kinetic.engage.v1";
const SKEY = "kinetic.engage.session";
const DBG = "kinetic.engage.debug";

/** Debug hooks exist in dev, or in production when the URL carried ?engage-debug=1 (remembered for the tab). */
export function debugEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  try {
    if (new URLSearchParams(window.location.search).get("engage-debug") === "1") sessionStorage.setItem(DBG, "1");
    return sessionStorage.getItem(DBG) === "1";
  } catch {
    return false;
  }
}

export function getTiming(): Timing {
  if (typeof window === "undefined" || !debugEnabled()) return DEFAULT_TIMING;
  const o = (window as unknown as { __kineticEngageTiming?: Partial<Timing> }).__kineticEngageTiming;
  return { ...DEFAULT_TIMING, ...(o ?? {}) };
}

let memSession: Session = emptySession();
export function readSession(): Session {
  try {
    const raw = sessionStorage.getItem(SKEY);
    if (raw) {
      const j = JSON.parse(raw) as Partial<Session>;
      return { count: typeof j.count === "number" ? j.count : 0, lastAt: typeof j.lastAt === "number" ? j.lastAt : null };
    }
  } catch {
    /* storage unavailable: memory only */
  }
  return memSession;
}
export function writeSession(s: Session) {
  memSession = s;
  try {
    sessionStorage.setItem(SKEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

type Store = {
  s: EngageState;
  loaded: boolean;
  load: () => void;
  update: (fn: (s: EngageState) => EngageState) => void;
  reset: () => void;
};

const persist = (s: EngageState) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
};

export const useEngage = create<Store>()((set, get) => ({
  s: emptyState(),
  loaded: false,
  load: () => {
    if (get().loaded) return;
    let raw: unknown = null;
    try {
      raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    } catch {
      /* corrupt: start fresh */
    }
    set({ s: sanitize(raw), loaded: true });
  },
  update: (fn) => {
    if (!get().loaded) get().load();
    const next = fn(get().s);
    set({ s: next });
    persist(next);
  },
  reset: () => {
    memSession = emptySession();
    try {
      localStorage.removeItem(KEY);
      sessionStorage.removeItem(SKEY);
    } catch {
      /* ignore */
    }
    set({ s: emptyState(), loaded: true });
  },
}));
