import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Aspect, Kind } from "./models";
import { claimBonus, SIGNUP_BONUS } from "./rules";
import { codeFor, normalizeRef, REFEREE_BONUS, REFERRER_BONUS, REWARD_TIERS } from "./referral";

/** `server: true` = a real account whose state lives in Postgres (the server is the source of truth). */
export type SessionUser = { id: string; email: string; name: string; server?: boolean };
export type Invitee = { id: string; at: string };
export { SIGNUP_BONUS, claimBonus };
export type Notifs = { product: boolean; tips: boolean; referrals: boolean };

export type LibraryItem = {
  id: string;
  url: string;
  kind: Kind;
  prompt: string;
  model: string;
  aspect: Aspect;
  poster?: string;
  createdAt: string;
};

export type ServerMe = {
  user: { id: string; email: string; name: string; referralCode: string; createdAt: string; referred?: boolean };
  balance: number;
  streak: number;
  lastClaim: string | null;
  library: LibraryItem[];
  likes: string[];
  referrals: { invited: Invitee[]; rewardsClaimed: number[] };
};

const isServerUser = (u: SessionUser | null) => !!u?.server;
const post = (url: string, body?: unknown, method = "POST") =>
  fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

type State = {
  credits: number;
  streak: number;
  lastClaim: string | null;
  likes: Record<string, true>;
  library: LibraryItem[];
  /** stable local id (guest id, kept when you sign up) */
  userId: string | null;
  user: SessionUser | null;
  name: string;
  bonusGiven: boolean;
  welcomeAt: number | null;
  welcomeDismissed: boolean;
  pendingRef: string | null;
  referredBy: string | null;
  invited: Invitee[];
  rewardsClaimed: number[];
  notifs: Notifs;
  referralCode: string | null;
  /** Replace local state with the server's (signed-in users). */
  applyServer: (me: ServerMe) => void;
  setBalance: (n: number) => void;
  ensureId: () => string;
  addCredits: (n: number) => void;
  setPendingRef: (code: string) => void;
  /** Called after an account was created. Grants the one-time signup bonus. */
  completeSignup: (u: SessionUser, ref?: string | null) => { gained: number; referred: boolean };
  signIn: (u: SessionUser) => void;
  signOut: () => void;
  dismissWelcome: () => void;
  addInvited: (list: Invitee[]) => number;
  claimReward: (invites: number) => boolean;
  setName: (n: string) => void;
  setNotif: (k: keyof Notifs, v: boolean) => void;
  resetLocal: () => void;
  claimDaily: () => { ok: boolean; gained: number };
  spend: (n: number) => boolean;
  like: (id: string) => void;
  addToLibrary: (item: LibraryItem) => void;
  removeFromLibrary: (id: string) => void;
};

const day = (d = new Date()) => d.toISOString().slice(0, 10);

const initial = {
  credits: 50,
  streak: 0,
  lastClaim: null as string | null,
  likes: {} as Record<string, true>,
  library: [] as LibraryItem[],
  userId: null as string | null,
  user: null as SessionUser | null,
  name: "",
  bonusGiven: false,
  welcomeAt: null as number | null,
  welcomeDismissed: false,
  pendingRef: null as string | null,
  referredBy: null as string | null,
  invited: [] as Invitee[],
  rewardsClaimed: [] as number[],
  notifs: { product: true, tips: true, referrals: true },
  referralCode: null as string | null,
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial,
      ensureId: () => {
        const cur = get().userId;
        if (cur) return cur;
        const id = (globalThis.crypto?.randomUUID?.() ?? `g${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/-/g, "").slice(0, 16);
        set({ userId: id });
        return id;
      },
      setBalance: (n) => set({ credits: n }),
      applyServer: (me) =>
        set((s) => ({
          user: { id: me.user.id, email: me.user.email, name: me.user.name, server: true },
          name: me.user.name,
          credits: me.balance,
          streak: me.streak,
          lastClaim: me.lastClaim,
          library: me.library,
          likes: Object.fromEntries(me.likes.map((id) => [id, true as const])),
          invited: me.referrals.invited,
          rewardsClaimed: me.referrals.rewardsClaimed,
          referralCode: me.user.referralCode,
          welcomeAt: new Date(me.user.createdAt).getTime(),
          bonusGiven: true,
          referredBy: me.user.referred ? (s.referredBy ?? "server") : null,
          pendingRef: null,
          userId: s.userId,
        })),
      addCredits: (n) => set((s) => ({ credits: s.credits + n })),
      setPendingRef: (code) => {
        const c = normalizeRef(code);
        if (c && !get().referredBy) set({ pendingRef: c });
      },
      completeSignup: (u, ref) => {
        const s = get();
        const code = normalizeRef(ref ?? s.pendingRef);
        const referred = !!code && !s.referredBy && code !== codeFor(u.id);
        let gained = 0;
        if (!s.bonusGiven) gained = SIGNUP_BONUS + (referred ? REFEREE_BONUS : 0);
        set({
          user: u,
          userId: u.id,
          name: s.name || u.name,
          credits: s.credits + gained,
          bonusGiven: true,
          welcomeAt: s.welcomeAt ?? Date.now(),
          referredBy: referred ? code : s.referredBy,
          pendingRef: null,
        });
        return { gained, referred: referred && gained > 0 };
      },
      signIn: (u) => set({ user: u, userId: u.id, name: get().name || u.name }),
      // A server session ends with a clean guest slate: account data must not linger as "guest" data.
      signOut: () =>
        set((s) => (isServerUser(s.user) ? { ...initial, notifs: { ...s.notifs }, userId: s.userId } : { user: null })),
      dismissWelcome: () => set({ welcomeDismissed: true }),
      addInvited: (list) => {
        const have = new Set(get().invited.map((i) => i.id));
        const fresh = list.filter((i) => !have.has(i.id));
        if (!fresh.length) return 0;
        set((s) => ({ invited: [...s.invited, ...fresh], credits: s.credits + fresh.length * REFERRER_BONUS }));
        return fresh.length * REFERRER_BONUS;
      },
      claimReward: (invites) => {
        const s = get();
        const tier = REWARD_TIERS.find((t) => t.invites === invites);
        if (!tier || s.invited.length < invites || s.rewardsClaimed.includes(invites)) return false;
        set({ credits: s.credits + tier.credits, rewardsClaimed: [...s.rewardsClaimed, invites] });
        return true;
      },
      setName: (name) => set({ name }),
      setNotif: (k, v) => set((s) => ({ notifs: { ...s.notifs, [k]: v } })),
      resetLocal: () => set({ ...initial, notifs: { ...initial.notifs } }),
      claimDaily: () => {
        const { lastClaim, streak, credits } = get();
        const today = day();
        if (lastClaim === today) return { ok: false, gained: 0 };
        const yesterday = day(new Date(Date.now() - 86400000));
        const nextStreak = lastClaim === yesterday ? streak + 1 : 1;
        const gained = claimBonus(nextStreak);
        set({ streak: nextStreak, lastClaim: today, credits: credits + gained });
        return { ok: true, gained };
      },
      spend: (n) => {
        if (get().credits < n) return false;
        set({ credits: get().credits - n });
        return true;
      },
      like: (id) => {
        set((s) => {
          const likes = { ...s.likes };
          if (likes[id]) delete likes[id];
          else likes[id] = true;
          return { likes };
        });
        // optimistic UI; the server decides, and a failed call rolls back
        if (isServerUser(get().user))
          post("/api/me/like", { postId: id }).then(
            (r) => {
              if (!r.ok) throw new Error("like failed");
              return r.json() as Promise<{ liked: boolean }>;
            },
            () => {
              throw new Error("like failed");
            },
          ).then(
            (j) => set((s) => {
              const likes = { ...s.likes };
              if (j.liked) likes[id] = true;
              else delete likes[id];
              return { likes };
            }),
            () => set((s) => {
              const likes = { ...s.likes };
              if (likes[id]) delete likes[id];
              else likes[id] = true;
              return { likes };
            }),
          );
      },
      addToLibrary: (item) =>
        set((s) => ({ library: [item, ...s.library.filter((i) => i.id !== item.id)].slice(0, 60) })),
      removeFromLibrary: (id) => {
        const prev = get().library;
        set((s) => ({ library: s.library.filter((i) => i.id !== id) }));
        if (isServerUser(get().user))
          post(`/api/me/library/${encodeURIComponent(id)}`, undefined, "DELETE").then(
            (r) => {
              if (!r.ok && r.status !== 404) set({ library: prev });
            },
            () => set({ library: prev }),
          );
      },
    }),
    {
      name: "kinetic-store",
      version: 1,
      partialize: (s) => ({
        credits: s.credits,
        streak: s.streak,
        lastClaim: s.lastClaim,
        likes: s.likes,
        library: s.library,
        userId: s.userId,
        user: s.user,
        name: s.name,
        bonusGiven: s.bonusGiven,
        welcomeAt: s.welcomeAt,
        welcomeDismissed: s.welcomeDismissed,
        pendingRef: s.pendingRef,
        referredBy: s.referredBy,
        invited: s.invited,
        rewardsClaimed: s.rewardsClaimed,
        notifs: s.notifs,
        referralCode: s.referralCode,
      }),
    },
  ),
);
