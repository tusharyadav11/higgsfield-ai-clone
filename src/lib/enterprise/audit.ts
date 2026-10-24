// LOCAL DEMO AUDIT LOG. Events are recorded in this browser's localStorage from actions taken in the
// workspace UI. It is not tamper-proof, not shared between people, and not a compliance audit trail.
import { useSyncExternalStore } from "react";
import { useTeam } from "./team-store";

export const AUDIT_KEY = "kinetic-ws-audit";
export const AUDIT_MAX = 500;
export const AUDIT_DISCLAIMER = "Local demo log: not tamper-proof, not a compliance audit trail.";

export type AuditEvent = {
  id: string;
  at: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  detail?: string;
};

const listeners = new Set<() => void>();
let seq = 0;
let memory: AuditEvent[] | null = null; // fallback when storage is blocked / absent (tests, private mode)
let cache: { raw: string | null; list: AuditEvent[] } = { raw: null, list: [] };
const EMPTY: AuditEvent[] = [];

const storage = () => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

export function readAudit(): AuditEvent[] {
  const s = storage();
  if (!s) return memory ?? EMPTY;
  let raw: string | null = null;
  try {
    raw = s.getItem(AUDIT_KEY);
  } catch {
    return memory ?? EMPTY;
  }
  if (raw === cache.raw) return cache.list;
  let list: AuditEvent[] = EMPTY;
  try {
    const v = raw ? JSON.parse(raw) : [];
    if (Array.isArray(v)) list = v.filter((e) => e && typeof e.id === "string" && typeof e.at === "string" && typeof e.action === "string");
  } catch {
    list = EMPTY;
  }
  cache = { raw, list };
  return list;
}

function write(list: AuditEvent[]) {
  const s = storage();
  if (s) {
    try {
      s.setItem(AUDIT_KEY, JSON.stringify(list));
    } catch {
      memory = list;
    }
  } else memory = list;
  listeners.forEach((l) => l());
}

export type AuditInput = { action: string; target: string; detail?: string; actor?: string; role?: string; at?: string };

/** Records one event (newest first). Safe to call from any handler; never throws. */
export function record(e: AuditInput): AuditEvent {
  const ev: AuditEvent = {
    id: `ev_${Date.now().toString(36)}${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    at: e.at ?? new Date().toISOString(),
    actor: e.actor ?? "You",
    role: e.role ?? "owner",
    action: e.action,
    target: e.target,
    ...(e.detail ? { detail: e.detail } : {}),
  };
  write([ev, ...readAudit()].slice(0, AUDIT_MAX));
  return ev;
}

export function clearAudit() {
  write([]);
}

/** Record an event as the current demo "acting as" role (read from the team store; Owner if unknown). */
export function recordActing(e: Omit<AuditInput, "role" | "actor">): AuditEvent {
  return record({ ...e, actor: "You", role: useTeam.getState().actingAs });
}

export const audit = { record, list: readAudit, clear: clearAudit, recordActing };

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};
export const useAuditEvents = () => useSyncExternalStore(subscribe, readAudit, () => EMPTY);

export type AuditFilter = { q?: string; action?: string; actor?: string };
export function filterAudit(list: AuditEvent[], f: AuditFilter): AuditEvent[] {
  const q = f.q?.trim().toLowerCase();
  return list.filter(
    (e) =>
      (!f.action || e.action === f.action) &&
      (!f.actor || e.actor === f.actor) &&
      (!q || `${e.action} ${e.target} ${e.detail ?? ""} ${e.actor}`.toLowerCase().includes(q)),
  );
}

const csvCell = (v: string) => {
  // neutralise spreadsheet formula injection, then quote
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
};
export function auditToCsv(list: AuditEvent[]): string {
  const head = ["time", "actor", "role", "action", "target", "detail"].map(csvCell).join(",");
  const rows = list.map((e) => [e.at, e.actor, e.role, e.action, e.target, e.detail ?? ""].map(csvCell).join(","));
  return [head, ...rows].join("\n") + "\n";
}

/** Test helper: forget cached state. */
export function __resetAuditForTests() {
  memory = null;
  cache = { raw: null, list: [] };
  const s = storage();
  try {
    s?.removeItem(AUDIT_KEY);
  } catch {}
}
