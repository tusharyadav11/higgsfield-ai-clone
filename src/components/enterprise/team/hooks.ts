"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTeam } from "@/lib/enterprise/team-store";

/**
 * Rehydrates the demo team store after mount, seeds it on first visit, and applies the demo debug query
 * (?demo_used=<percent of pool consumed>, ?demo_seats=<total seats>, ?demo_reset=1). Returns true when ready.
 */
export function useTeamReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.resolve(useTeam.persist.rehydrate()).then(() => {
      const now = Date.now();
      const st = useTeam.getState();
      const q = new URLSearchParams(window.location.search);
      if (q.get("demo_reset") === "1") st.reset(now);
      else st.ensureSeed(now);
      const used = q.get("demo_used");
      const seats = q.get("demo_seats");
      if (used !== null || seats !== null) {
        useTeam.getState().setDebug({
          pct: used === null ? undefined : Number.isFinite(Number(used)) ? Number(used) : undefined,
          seats: seats === null ? undefined : Number.isFinite(Number(seats)) ? Number(seats) : undefined,
        });
      }
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);
  return ready;
}

/** matchMedia after mount; false on the server (phone layout first). */
export function useMedia(q: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(q);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(q).matches,
    () => false,
  );
}

/** Instant for small lists, debounced for big ones. */
export function useSmartDebounce(value: string, listSize: number, ms = 200) {
  const [d, setD] = useState(value);
  useEffect(() => {
    if (listSize <= 60) return;
    const t = setTimeout(() => setD(value), ms);
    return () => clearTimeout(t);
  }, [value, listSize, ms]);
  return listSize <= 60 ? value : d;
}
