"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { useJobs } from "@/lib/jobs";
import { fetchFeedPage } from "@/lib/feed-cache";
import type { Post } from "@/lib/seed";
import { useMounted } from "@/components/growth/hooks";
import {
  GUEST_AFTER_GENS,
  isAway,
  isAuthPath,
  isPopupId,
  markShown,
  MILESTONE_ACTIONS,
  pick,
  POPUP_META,
  SHARE_AFTER_GENS,
  stillValid,
  type Ctx,
  type PopupId,
  type Snapshot,
} from "@/lib/engage/rules";
import { debugEnabled, getTiming, readSession, useEngage, writeSession } from "@/lib/engage/state";
import { Popup } from "./Popups";

export { PopupSettings } from "./PopupSettings";

const OVERLAY =
  '[role="dialog"]:not([data-engage]),[role="alertdialog"],[aria-modal="true"]:not([data-engage]),dialog[open],[data-testid="tour-overlay"],[data-testid="search-input"]';
const promptEmpty = () => {
  const el = document.querySelector<HTMLTextAreaElement | HTMLInputElement>('[data-testid="prompt-input"]');
  return !!el && el.value.trim() === "";
};

export function EngageRoot() {
  const mounted = useMounted();
  return mounted ? <Engine /> : null;
}

function Engine() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);
  const [active, setActive] = useState<PopupId | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [trending, setTrending] = useState<Post[]>([]);
  const activeRef = useRef<PopupId | null>(null);
  const closeRef = useRef<() => void>(() => {});

  useEffect(() => {
    const eng = useEngage.getState();
    eng.load();
    const visitStart = Date.now();
    const sensed = new Set<PopupId>();
    let idleSince: number | null = null;
    let trendingReady = false;
    let fetching = false;
    let live = true;

    const open = (id: PopupId | null) => {
      activeRef.current = id;
      setActive(id);
    };
    closeRef.current = () => open(null);
    const addPending = (id: PopupId) => {
      const st = useEngage.getState().s;
      if (st.pending[id] || (POPUP_META[id].once && st.done[id])) return;
      useEngage.getState().update((s) => ({ ...s, pending: { ...s.pending, [id]: true } }));
    };
    const bumpActions = () => {
      useEngage.getState().update((s) => ({ ...s, counters: { ...s.counters, actions: s.counters.actions + 1 } }));
      if (useEngage.getState().s.counters.actions >= MILESTONE_ACTIONS) addPending("remix-milestone");
    };
    const loadTrending = () => {
      if (fetching || trendingReady) return;
      fetching = true;
      fetchFeedPage("", null, 24)
        .then((pg) => {
          if (!live) return;
          const top = [...pg.items].sort((a, b) => b.remixes - a.remixes).slice(0, 3);
          trendingReady = top.length > 0;
          setTrending(top);
        })
        .catch(() => {
          /* offline: the welcome-back card simply does not show */
        })
        .finally(() => {
          fetching = false;
        });
    };

    // returning after an absence
    const now0 = Date.now();
    if (isAway(useEngage.getState().s.lastVisit, now0)) {
      sensed.add("welcome-back");
      loadTrending();
    }
    useEngage.getState().update((s) => ({ ...s, lastVisit: now0 }));

    const snapshot = (now: number): Snapshot => {
      const a = useStore.getState();
      const t = getTiming();
      return {
        now,
        hour: t.hour ?? new Date(now).getHours(),
        path: pathRef.current ?? "",
        credits: a.credits,
        baseline: useEngage.getState().s.baseline,
        streak: a.streak,
        lastClaim: a.lastClaim,
        signedIn: !!a.user,
        libraryLen: a.library.length,
        promptEmpty: (pathRef.current ?? "") === "/create" && promptEmpty(),
        trendingReady,
      };
    };

    const tick = () => {
      const now = Date.now();
      const t = getTiming();
      const path = pathRef.current ?? "";
      const app = useStore.getState();
      if (useEngage.getState().s.baseline === null) useEngage.getState().update((s) => ({ ...s, baseline: app.credits }));
      const snap = snapshot(now);

      // level-triggered sensors
      for (const id of ["credit-low", "streak-risk"] as const) if (stillValid(id, snap)) sensed.add(id);
      if (path === "/create" && snap.promptEmpty) {
        idleSince ??= now;
        if (now - idleSince >= t.idleMs) sensed.add("idle-create");
      } else {
        idleSince = null;
        sensed.delete("idle-create");
      }
      if (sensed.has("welcome-back")) loadTrending();

      const jobRunning = useJobs.getState().jobs.some((j) => j.status === "running");
      const overlay = !!document.querySelector(OVERLAY);
      setBlocked(jobRunning || overlay || isAuthPath(path));

      const cur = activeRef.current;
      if (cur) {
        if (cur === "idle-create" && !stillValid(cur, snap)) open(null);
        return;
      }
      const st = useEngage.getState().s;
      const ctx: Ctx = { now, visitStart, path, jobRunning, overlay, tipsEnabled: app.notifs.tips !== false };
      const cands: PopupId[] = [];
      for (const id of [...(Object.keys(st.pending) as PopupId[]), ...sensed]) {
        if (!isPopupId(id)) continue;
        if (stillValid(id, snap)) cands.push(id);
        else if (id === "guest-nudge") useEngage.getState().update((s) => ({ ...s, pending: Object.fromEntries(Object.entries(s.pending).filter(([k]) => k !== id)) }));
        else sensed.delete(id);
      }
      const id = pick(cands, st, readSession(), ctx, t);
      if (!id) return;
      const next = markShown(id, st, readSession(), now);
      writeSession(next.session);
      useEngage.getState().update(() => next.state);
      sensed.delete(id);
      open(id);
    };

    // observe: finished generations
    const seenDone = new Set<string>();
    const unJobs = useJobs.subscribe((s) => {
      for (const j of s.jobs) {
        if (j.status !== "done" || seenDone.has(j.id)) continue;
        seenDone.add(j.id);
        useEngage.getState().update((e) => ({ ...e, counters: { ...e.counters, gens: e.counters.gens + 1 } }));
        const gens = useEngage.getState().s.counters.gens;
        const a = useStore.getState();
        if (a.library.length === 1) addPending("first-creation");
        if (!a.user && gens >= GUEST_AFTER_GENS) addPending("guest-nudge");
        if (gens >= SHARE_AFTER_GENS) addPending("share-nudge");
      }
    });
    // observe: likes going up
    const unStore = useStore.subscribe((s, p) => {
      if (Object.keys(s.likes).length > Object.keys(p.likes).length) bumpActions();
    });
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.('[data-testid="remix-btn"]')) bumpActions();
    };
    const onRemix = () => bumpActions();
    const onEngage = (e: Event) => {
      const id = (e as CustomEvent<{ id?: unknown }>).detail?.id;
      if (isPopupId(id)) addPending(id);
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("kinetic:remix", onRemix);
    window.addEventListener("kinetic:engage", onEngage);

    if (debugEnabled())
      (window as unknown as { __kineticEngageReset?: () => void }).__kineticEngageReset = () => {
        useEngage.getState().reset();
        sensed.clear();
        idleSince = null;
        open(null);
      };

    const timer = setInterval(tick, Math.max(100, getTiming().tickMs));
    return () => {
      live = false;
      clearInterval(timer);
      unJobs();
      unStore();
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("kinetic:remix", onRemix);
      window.removeEventListener("kinetic:engage", onEngage);
      delete (window as unknown as { __kineticEngageReset?: () => void }).__kineticEngageReset;
    };
  }, []);

  if (!active || blocked) return null;
  const close = () => closeRef.current();
  return (
    <Popup
      key={active}
      id={active}
      trending={trending}
      onClose={close}
      onMute={() => {
        useEngage.getState().update((s) => ({ ...s, muted: { ...s.muted, [active]: true } }));
        close();
      }}
      onPause={() => {
        useEngage.getState().update((s) => ({ ...s, paused: true }));
        close();
      }}
    />
  );
}
