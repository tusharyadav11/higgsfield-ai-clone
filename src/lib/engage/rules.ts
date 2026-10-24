/**
 * Engagement rules engine. PURE: no DOM, no storage, no clock (the caller injects `now`), so it is unit-testable.
 *
 * Window events other code may emit (all optional, all go through the same rules):
 *   `kinetic:engage`  detail `{ id: PopupId }`   ask for a popup (it still has to pass cooldown/cap/mute/quiet rules)
 *   `kinetic:remix`   detail ignored             count one remix toward the milestone (do NOT emit for [data-testid="remix-btn"]
 *                                                clicks, those are observed automatically)
 * Debug (only when NODE_ENV !== "production" or `?engage-debug=1`):
 *   `window.__kineticEngageReset?.()`            wipe engage state + session
 *   `window.__kineticEngageTiming = { quietMs, gapMs, idleMs, maxPerSession, tickMs, hour }` shorten timers / fake local hour
 */

export const POPUP_IDS = [
  "first-creation",
  "credit-low",
  "streak-risk",
  "remix-milestone",
  "idle-create",
  "welcome-back",
  "share-nudge",
  "guest-nudge",
] as const;
export type PopupId = (typeof POPUP_IDS)[number];
export const isPopupId = (v: unknown): v is PopupId => typeof v === "string" && (POPUP_IDS as readonly string[]).includes(v);

const H = 3600_000;
const D = 24 * H;

export const POPUP_META: Record<PopupId, { label: string; priority: number; cooldownMs: number; once?: boolean }> = {
  "first-creation": { label: "First creation celebration", priority: 100, cooldownMs: Infinity, once: true },
  "streak-risk": { label: "Streak reminders", priority: 80, cooldownMs: 20 * H },
  "credit-low": { label: "Low credit help", priority: 70, cooldownMs: D },
  "guest-nudge": { label: "Save your creations", priority: 60, cooldownMs: 7 * D },
  "remix-milestone": { label: "Getting-the-hang-of-it tips", priority: 50, cooldownMs: Infinity, once: true },
  "share-nudge": { label: "Share Kinetic", priority: 40, cooldownMs: Infinity, once: true },
  "welcome-back": { label: "Welcome back", priority: 30, cooldownMs: 3 * D },
  "idle-create": { label: "Stuck on Create? help", priority: 20, cooldownMs: 6 * H },
};

export type EngageState = {
  v: 1;
  paused: boolean;
  muted: Partial<Record<PopupId, true>>;
  lastShown: Partial<Record<PopupId, number>>;
  done: Partial<Record<PopupId, true>>;
  /** event-triggered popups waiting for a quiet moment (persisted so a reload does not lose them) */
  pending: Partial<Record<PopupId, true>>;
  counters: { gens: number; actions: number };
  lastVisit: number | null;
  /** first credit balance this browser saw, the "starting balance" for the 20% rule */
  baseline: number | null;
};
export type Session = { count: number; lastAt: number | null };
export type Timing = { quietMs: number; gapMs: number; idleMs: number; maxPerSession: number; tickMs: number; hour?: number };
export type Ctx = {
  now: number;
  visitStart: number;
  path: string;
  jobRunning: boolean;
  /** assistant / palette / tour / confirm or any other dialog is open */
  overlay: boolean;
  /** Settings "Tips" notification switch */
  tipsEnabled: boolean;
};

export const DEFAULT_TIMING: Timing = { quietMs: 20_000, gapMs: 60_000, idleMs: 25_000, maxPerSession: 2, tickMs: 1000 };
export const AWAY_MS = 3 * D;
export const CREDIT_LOW_ABS = 10;
export const MILESTONE_ACTIONS = 3;
export const SHARE_AFTER_GENS = 5;
export const GUEST_AFTER_GENS = 2;
export const STREAK_HOUR = 18;

export const emptyState = (): EngageState => ({
  v: 1,
  paused: false,
  muted: {},
  lastShown: {},
  done: {},
  pending: {},
  counters: { gens: 0, actions: 0 },
  lastVisit: null,
  baseline: null,
});
export const emptySession = (): Session => ({ count: 0, lastAt: null });

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const flags = (v: unknown) => {
  const o: Partial<Record<PopupId, true>> = {};
  for (const [k, x] of Object.entries(rec(v))) if (isPopupId(k) && x === true) o[k] = true;
  return o;
};
const nums = (v: unknown) => {
  const o: Partial<Record<PopupId, number>> = {};
  for (const [k, x] of Object.entries(rec(v))) if (isPopupId(k) && typeof x === "number" && Number.isFinite(x)) o[k] = x;
  return o;
};
const nn = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);

/** Never trust localStorage: coerce anything into a valid state. */
export function sanitize(raw: unknown): EngageState {
  const r = rec(raw);
  const c = rec(r.counters);
  return {
    v: 1,
    paused: r.paused === true,
    muted: flags(r.muted),
    lastShown: nums(r.lastShown),
    done: flags(r.done),
    pending: flags(r.pending),
    counters: { gens: nn(c.gens), actions: nn(c.actions) },
    lastVisit: typeof r.lastVisit === "number" && Number.isFinite(r.lastVisit) ? r.lastVisit : null,
    baseline: typeof r.baseline === "number" && Number.isFinite(r.baseline) ? r.baseline : null,
  };
}

export type Reason = "paused" | "tips-off" | "muted" | "done" | "route" | "job" | "overlay" | "quiet" | "cap" | "gap" | "cooldown";

/** Can popup `id` be shown right now? First failing rule wins. */
export function check(id: PopupId, st: EngageState, ss: Session, ctx: Ctx, t: Timing): { ok: true } | { ok: false; reason: Reason } {
  const meta = POPUP_META[id];
  if (st.paused) return { ok: false, reason: "paused" };
  if (!ctx.tipsEnabled) return { ok: false, reason: "tips-off" };
  if (st.muted[id]) return { ok: false, reason: "muted" };
  if (meta.once && st.done[id]) return { ok: false, reason: "done" };
  if (isAuthPath(ctx.path)) return { ok: false, reason: "route" };
  if (ctx.jobRunning) return { ok: false, reason: "job" };
  if (ctx.overlay) return { ok: false, reason: "overlay" };
  if (ctx.now - ctx.visitStart < t.quietMs) return { ok: false, reason: "quiet" };
  if (ss.count >= t.maxPerSession) return { ok: false, reason: "cap" };
  if (ss.lastAt !== null && ctx.now - ss.lastAt < t.gapMs) return { ok: false, reason: "gap" };
  const last = st.lastShown[id];
  if (last !== undefined && ctx.now - last < meta.cooldownMs) return { ok: false, reason: "cooldown" };
  return { ok: true };
}

/** Highest-priority candidate that passes every rule, or null. */
export function pick(cands: Iterable<PopupId>, st: EngageState, ss: Session, ctx: Ctx, t: Timing): PopupId | null {
  let best: PopupId | null = null;
  for (const id of new Set(cands))
    if (check(id, st, ss, ctx, t).ok && (best === null || POPUP_META[id].priority > POPUP_META[best].priority)) best = id;
  return best;
}

/** Record that `id` was shown (does not touch pending/sensed sets of the caller). */
export function markShown(id: PopupId, st: EngageState, ss: Session, now: number): { state: EngageState; session: Session } {
  const pending = { ...st.pending };
  delete pending[id];
  return {
    state: { ...st, pending, lastShown: { ...st.lastShown, [id]: now }, done: POPUP_META[id].once ? { ...st.done, [id]: true } : st.done },
    session: { count: ss.count + 1, lastAt: now },
  };
}

/* ---------- pure sensors ---------- */

export const isAuthPath = (p: string) => /^\/(login|signup)(\/|$)/.test(p);
export const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const isCreditLow = (credits: number, baseline: number | null) =>
  credits <= CREDIT_LOW_ABS || (baseline !== null && baseline > 0 && credits <= baseline * 0.2);

/** Streak ≥2 that was claimed yesterday (UTC, like the store) and not yet today, after 18:00 local. */
export function isStreakAtRisk(o: { streak: number; lastClaim: string | null; now: number; hour: number }) {
  return o.streak >= 2 && o.lastClaim === dayKey(o.now - D) && o.hour >= STREAK_HOUR;
}

export const isAway = (lastVisit: number | null, now: number) => lastVisit !== null && now - lastVisit >= AWAY_MS;

export type Snapshot = {
  now: number;
  hour: number;
  path: string;
  credits: number;
  baseline: number | null;
  streak: number;
  lastClaim: string | null;
  signedIn: boolean;
  libraryLen: number;
  promptEmpty: boolean;
  trendingReady: boolean;
};

/** Is the popup's own condition still true? (Event popups stay valid until shown.) */
export function stillValid(id: PopupId, s: Snapshot): boolean {
  switch (id) {
    case "first-creation":
      return s.libraryLen > 0;
    case "credit-low":
      return isCreditLow(s.credits, s.baseline);
    case "streak-risk":
      return isStreakAtRisk({ streak: s.streak, lastClaim: s.lastClaim, now: s.now, hour: s.hour });
    case "idle-create":
      return s.path === "/create" && s.promptEmpty;
    case "welcome-back":
      return s.trendingReady;
    case "guest-nudge":
      return !s.signedIn;
    default:
      return true;
  }
}
