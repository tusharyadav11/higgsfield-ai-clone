import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Aspect, Kind } from "./models";

export type LibraryItem = {
  id: string;
  url: string;
  kind: Kind;
  prompt: string;
  model: string;
  aspect: Aspect;
  createdAt: string;
};

type State = {
  credits: number;
  streak: number;
  lastClaim: string | null;
  likes: Record<string, true>;
  library: LibraryItem[];
  claimDaily: () => { ok: boolean; gained: number };
  spend: (n: number) => boolean;
  like: (id: string) => void;
  addToLibrary: (item: LibraryItem) => void;
  removeFromLibrary: (id: string) => void;
};

const day = (d = new Date()) => d.toISOString().slice(0, 10);
export const claimBonus = (streak: number) => 10 + 5 * Math.min(Math.max(streak - 1, 0), 6);

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      credits: 50,
      streak: 0,
      lastClaim: null,
      likes: {},
      library: [],
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
      }),
    },
  ),
);
