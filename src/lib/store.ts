import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Aspect, Kind } from "./models";
import { codeFor, normalizeRef, REFEREE_BONUS, REFERRER_BONUS, REWARD_TIERS } from "./referral";

export type SessionUser = { id: string; email: string; name: string };
export type Invitee = { id: string; at: string };
export const SIGNUP_BONUS = 25;
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
export const claimBonus = (streak: number) => 10 + 5 * Math.min(Math.max(streak - 1, 0), 6);

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
      signOut: () => set({ user: null }),
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
      like: (id) =>
        set((s) => {
          const likes = { ...s.likes };
          if (likes[id]) delete likes[id];
          else likes[id] = true;
          return { likes };
        }),
      addToLibrary: (item) =>
        set((s) => ({ library: [item, ...s.library.filter((i) => i.id !== item.id)].slice(0, 60) })),
      removeFromLibrary: (id) => set((s) => ({ library: s.library.filter((i) => i.id !== id) })),
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
      }),
    },
  ),
);
