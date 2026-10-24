import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DAY_MS, DEFAULT_SEATS, SAMPLE_MEMBERS } from "./demo-data";
import { isRole, type Role } from "./roles";

export type MemberStatus = "active" | "pending" | "suspended";
export type Member = { id: string; name: string; email: string; role: Role; status: MemberStatus; lastActive: string | null; joined: string | null; invitedAt: string | null };

export const MAX_INVITES = 10;
export const STORE_KEY = "kinetic-ws-team";
const EMAIL_RE = /^[^\s@,;<>()[\]]+@[^\s@,;<>()[\]]+\.[^\s@,;<>()[\]]{2,}$/;

export const isEmail = (s: string) => s.length <= 254 && EMAIL_RE.test(s);
/** Split pasted text on commas, semicolons and whitespace; trims and lowercases; drops empties. */
export const parseEmails = (raw: string): string[] => raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
export const seatsUsed = (members: Member[]) => members.length;
export const seatsFree = (members: Member[], seats: number) => Math.max(0, seats - seatsUsed(members));
export type SeatLevel = "ok" | "warn" | "full";
export const seatLevel = (used: number, total: number): SeatLevel => (total > 0 && used >= total ? "full" : total > 0 && used / total >= 0.8 ? "warn" : "ok");

export type InvitePlan = { emails: string[]; invalid: string[]; duplicates: string[]; error: string | null };
/** Validate an invite request atomically: either every address can be invited or none. */
export function planInvite(members: Member[], seats: number, raw: string): InvitePlan {
  const tokens = parseEmails(raw);
  const existing = new Set(members.map((m) => m.email.toLowerCase()));
  const seen = new Set<string>();
  const emails: string[] = [], invalid: string[] = [], duplicates: string[] = [];
  for (const t of tokens) {
    if (!isEmail(t)) invalid.push(t);
    else if (existing.has(t) || seen.has(t)) duplicates.push(t);
    else {
      seen.add(t);
      emails.push(t);
    }
  }
  let error: string | null = null;
  if (!tokens.length) error = "Enter at least one email address.";
  else if (tokens.length > MAX_INVITES) error = `You can invite up to ${MAX_INVITES} people at a time.`;
  else if (invalid.length) error = `Not a valid email: ${invalid.join(", ")}`;
  else if (duplicates.length) error = `Already in this workspace (or repeated): ${duplicates.join(", ")}`;
  else if (emails.length > seatsFree(members, seats))
    error = `Seat limit reached: ${seatsFree(members, seats)} of ${seats} seats free, but you are inviting ${emails.length}. Remove someone or add seats in Billing.`;
  return { emails, invalid, duplicates, error };
}

export const nameFromEmail = (email: string) =>
  email.split("@")[0].split(/[._-]+/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join(" ") || email;

/** Ownership rules, pure so they are unit-testable: exactly one Owner who cannot be removed or demoted. */
export function setRoleIn(members: Member[], id: string, role: Role): Member[] {
  const m = members.find((x) => x.id === id);
  if (!m || m.role === "owner" || role === "owner") return members;
  return members.map((x) => (x.id === id ? { ...x, role } : x));
}
export function removeFrom(members: Member[], ids: string[]): Member[] {
  const drop = new Set(ids.filter((id) => members.find((m) => m.id === id)?.role !== "owner"));
  return members.filter((m) => !drop.has(m.id));
}
export function transferIn(members: Member[], toId: string): Member[] {
  const to = members.find((m) => m.id === toId);
  if (!to || to.role === "owner" || to.status !== "active") return members;
  return members.map((m) => (m.role === "owner" ? { ...m, role: "admin" as Role } : m.id === toId ? { ...m, role: "owner" as Role } : m));
}
export const ownerCount = (members: Member[]) => members.filter((m) => m.role === "owner").length;

export function seedMembers(nowMs: number): Member[] {
  const iso = (ms: number) => new Date(ms).toISOString();
  return SAMPLE_MEMBERS.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    role: s.role,
    status: s.status,
    lastActive: s.activeAgoH === null ? null : iso(nowMs - s.activeAgoH * 3_600_000),
    joined: s.joinedAgoD === null ? null : iso(nowMs - s.joinedAgoD * DAY_MS),
    invitedAt: s.status === "pending" ? iso(nowMs - 2 * DAY_MS) : null,
  }));
}

type State = {
  members: Member[];
  seats: number;
  actingAs: Role;
  usagePct: number | null; // debug seed: simulate the pool being this % consumed
  seeded: boolean;
  nextId: number;
  ensureSeed: (nowMs: number) => void;
  reset: (nowMs: number) => void;
  setActingAs: (r: Role) => void;
  setDebug: (o: { seats?: number | null; pct?: number | null }) => void;
  invite: (emails: string[], role: Role, nowMs: number) => void;
  resend: (id: string, nowMs: number) => void;
  setRole: (id: string, role: Role) => void;
  setStatus: (id: string, status: MemberStatus) => void;
  remove: (ids: string[]) => Member[];
  restore: (removed: Member[], at: number[]) => void;
  transfer: (toId: string) => void;
};

export const useTeam = create<State>()(
  persist(
    (set, get) => ({
      members: [],
      seats: DEFAULT_SEATS,
      actingAs: "owner",
      usagePct: null,
      seeded: false,
      nextId: 1,
      ensureSeed: (nowMs) => {
        if (!get().seeded) set({ members: seedMembers(nowMs), seeded: true });
      },
      reset: (nowMs) => set({ members: seedMembers(nowMs), seeded: true, seats: DEFAULT_SEATS, actingAs: "owner", usagePct: null, nextId: 1 }),
      setActingAs: (actingAs) => isRole(actingAs) && set({ actingAs }),
      setDebug: ({ seats, pct }) =>
        set((s) => ({
          seats: seats === undefined ? s.seats : seats === null ? DEFAULT_SEATS : Math.max(1, Math.min(5000, Math.floor(seats))),
          usagePct: pct === undefined ? s.usagePct : pct === null ? null : Math.max(0, Math.min(150, pct)),
        })),
      invite: (emails, role, nowMs) =>
        set((s) => {
          const at = new Date(nowMs).toISOString();
          const added: Member[] = emails.map((email, i) => ({ id: `inv-${s.nextId + i}`, name: nameFromEmail(email), email, role, status: "pending", lastActive: null, joined: null, invitedAt: at }));
          return { members: [...s.members, ...added], nextId: s.nextId + emails.length };
        }),
      resend: (id, nowMs) => set((s) => ({ members: s.members.map((m) => (m.id === id && m.status === "pending" ? { ...m, invitedAt: new Date(nowMs).toISOString() } : m)) })),
      setRole: (id, role) => set((s) => ({ members: setRoleIn(s.members, id, role) })),
      setStatus: (id, status) => set((s) => ({ members: s.members.map((m) => (m.id === id && m.role !== "owner" && m.status !== "pending" ? { ...m, status } : m)) })),
      remove: (ids) => {
        const before = get().members;
        const after = removeFrom(before, ids);
        const gone = before.filter((m) => !after.includes(m));
        set({ members: after });
        return gone;
      },
      restore: (removed, at) =>
        set((s) => {
          const list = [...s.members];
          removed.forEach((m, i) => {
            if (!list.some((x) => x.id === m.id)) list.splice(Math.min(at[i] ?? list.length, list.length), 0, m);
          });
          return { members: list };
        }),
      transfer: (toId) => set((s) => ({ members: transferIn(s.members, toId), actingAs: "admin" })),
    }),
    {
      name: STORE_KEY,
      skipHydration: true, // rehydrated after mount (cacheComponents: nothing from storage in prerendered output)
      version: 1,
      partialize: ({ members, seats, actingAs, usagePct, seeded, nextId }) => ({ members, seats, actingAs, usagePct, seeded, nextId }),
    },
  ),
);
