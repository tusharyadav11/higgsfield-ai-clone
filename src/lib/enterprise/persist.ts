"use client";
import { useEffect, useSyncExternalStore } from "react";

type Persisted = {
  persist: { rehydrate: () => Promise<void> | void; hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void };
};

/**
 * Stores in this folder use `skipHydration: true` so the first client render matches the server
 * (which cannot see localStorage). This hook rehydrates after mount and says when state is real.
 */
export function useStoreReady(store: Persisted): boolean {
  useEffect(() => {
    if (!store.persist.hasHydrated()) void store.persist.rehydrate();
  }, [store]);
  return useSyncExternalStore(
    (cb) => store.persist.onFinishHydration(cb),
    () => store.persist.hasHydrated(),
    () => false,
  );
}

export const safeStorage = () => {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
};
