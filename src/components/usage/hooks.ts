"use client";
import { useEffect, useState, useSyncExternalStore } from "react";


export function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(prefers-reduced-motion: reduce)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
}

/** Eases from 0 to `value` once (and again on change); jumps straight there with reduced motion. */
export function useCountUp(value: number, ms = 900) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms, reduced]);
  return reduced || shown === null ? value : shown;
}

/** True one frame after mount, so CSS transitions have a start state. */
export function useEntered() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(r);
  }, []);
  return on;
}

/* ---- monthly budget, stored locally (per browser) ---- */
const KEY = "kn-usage-budget";
const listeners = new Set<() => void>();
const read = () => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};
export function useBudget(): [number, (n: number) => void] {
  const raw = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      window.addEventListener("storage", cb);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", cb);
      };
    },
    read,
    () => "",
  );
  const n = Math.max(0, Math.floor(Number(raw) || 0));
  return [
    n,
    (v) => {
      try {
        if (v > 0) localStorage.setItem(KEY, String(Math.min(1_000_000, Math.floor(v))));
        else localStorage.removeItem(KEY);
      } catch {}
      listeners.forEach((f) => f());
    },
  ];
}
