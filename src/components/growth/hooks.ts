"use client";
import { useSyncExternalStore } from "react";

const noop = () => () => {};
/** false during SSR/hydration, true after mount. Gate anything read from localStorage/time. */
export function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}

/** Epoch ms ticking every `ms`; 0 on the server (so prerender never reads the clock). */
export function useNow(ms = 1000) {
  return useSyncExternalStore(
    (cb) => {
      const t = setInterval(cb, ms);
      return () => clearInterval(t);
    },
    () => Math.floor(Date.now() / ms) * ms,
    () => 0,
  );
}

export function useNarrow(maxPx = 479) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(`(max-width:${maxPx}px)`);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(`(max-width:${maxPx}px)`).matches,
    () => false,
  );
}
