import { create } from "zustand";

/**
 * Whether this deployment has a database (accounts are real) or runs in local demo mode.
 * Deliberately NOT in the persisted app store: setting it must never rewrite the guest's localStorage.
 * null = not known yet.
 */
export const useServerInfo = create<{ db: boolean | null; setDb: (v: boolean) => void }>()((set) => ({
  db: null,
  setDb: (db) => set((s) => (s.db === db ? s : { db })),
}));
