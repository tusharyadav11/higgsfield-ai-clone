"use client";

import { create } from "zustand";
import { useEffect, useState } from "react";
import { getModel, type Aspect, type Kind } from "./models";
import type { Generation } from "./generate";
import { useStore } from "./store";
import { hydrate } from "./server-sync";

export type JobInput = { kind: Kind; model: string; prompt: string; aspect: Aspect };
export type JobStatus = "running" | "done" | "error" | "cancelled";

export type Job = JobInput & {
  id: string;
  modelName: string;
  cost: number;
  status: JobStatus;
  startedAt: number;
  estMs: number;
  finishedAt?: number;
  result?: Generation;
  error?: string;
};

export type Toast = { id: string; jobId: string; type: "done" | "error"; text: string };

type JobsState = {
  jobs: Job[];
  toasts: Toast[];
  start: (input: JobInput) => { id: string } | "insufficient" | "invalid";
  cancel: (id: string) => void;
  retry: (id: string) => { id: string } | "insufficient" | "invalid";
  dismiss: (id: string) => void;
  clearFinished: () => void;
  dismissToast: (id: string) => void;
};

/** Honest time estimate from model speed (ms). Used only for the progress curve and ETA. */
export function estimateMs(kind: Kind, speed: "fast" | "balanced" | "quality"): number {
  const img = { fast: 4000, balanced: 6000, quality: 9000 };
  const vid = { fast: 12000, balanced: 20000, quality: 30000 };
  return (kind === "image" ? img : vid)[speed];
}

const controllers = new Map<string, AbortController>();
const inflightKeys = new Set<string>();
const keyOf = (i: JobInput) => `${i.kind}|${i.model}|${i.aspect}|${i.prompt}`;
const uid = () => `job_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

export const useJobs = create<JobsState>()((set, get) => {
  const patch = (id: string, p: Partial<Job>) =>
    set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...p } : j)) }));
  const toast = (t: Omit<Toast, "id">) =>
    set((s) => ({ toasts: [...s.toasts, { ...t, id: uid() }].slice(-3) }));
  const serverUser = () => !!useStore.getState().user?.server;
  const refund = (cost: number) => useStore.setState((s) => ({ credits: s.credits + cost }));
  const setBalance = (b: unknown) => typeof b === "number" && useStore.setState({ credits: b });

  async function run(job: Job) {
    const ctl = new AbortController();
    controllers.set(job.id, ctl);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: job.kind, model: job.model, prompt: job.prompt, aspect: job.aspect }),
        signal: ctl.signal,
      });
      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        /* non-JSON body */
      }
      const body = data as { error?: string; balance?: number } | null;
      if (!res.ok) throw Object.assign(new Error(body?.error ?? "Generation failed"), { balance: body?.balance, status: res.status });
      const gen = data as Generation & { balance?: number };
      if (get().jobs.find((j) => j.id === job.id)?.status !== "running") return;
      if (serverUser()) {
        if (typeof gen.balance === "number") setBalance(gen.balance);
        else void hydrate(); // no balance in the response: the session is gone or the server is older, resync
      }
      useStore.getState().addToLibrary({
        id: gen.id, url: gen.url, kind: gen.kind, prompt: gen.prompt, model: gen.model, aspect: gen.aspect, poster: gen.poster, createdAt: gen.createdAt,
      });
      patch(job.id, { status: "done", result: gen, finishedAt: Date.now() });
      toast({ jobId: job.id, type: "done", text: `Your ${job.kind} is ready` });
    } catch (e) {
      if (get().jobs.find((j) => j.id === job.id)?.status !== "running") return; // cancelled
      const info = e as { balance?: number; status?: number };
      if (serverUser()) {
        // the server already charged/refunded atomically: just show its balance
        if (typeof info.balance === "number") setBalance(info.balance);
        else void hydrate();
      } else refund(job.cost);
      const msg = e instanceof Error && e.message ? e.message : "Something went wrong";
      patch(job.id, { status: "error", error: info.status === 402 ? msg : `${msg}. Credits refunded.`, finishedAt: Date.now() });
      toast({ jobId: job.id, type: "error", text: `${job.kind} failed, credits refunded` });
    } finally {
      controllers.delete(job.id);
      inflightKeys.delete(keyOf(job));
    }
  }

  const start: JobsState["start"] = (input) => {
    const m = getModel(input.model);
    const prompt = input.prompt.trim();
    if (!m || m.kind !== input.kind || !prompt) return "invalid";
    const clean = { ...input, prompt };
    const k = keyOf(clean);
    // double-submit protection: an identical in-flight job is reused, never charged twice
    if (inflightKeys.has(k)) {
      const ex = get().jobs.find((j) => j.status === "running" && keyOf(j) === k);
      if (ex) return { id: ex.id };
    }
    if (serverUser()) {
      // server users are charged by /api/generate; locally we only show the expected balance meanwhile
      if (useStore.getState().credits < m.credits) return "insufficient";
      useStore.setState((st) => ({ credits: st.credits - m.credits }));
    } else if (!useStore.getState().spend(m.credits)) return "insufficient";
    inflightKeys.add(k);
    const job: Job = {
      ...clean,
      id: uid(),
      modelName: m.name,
      cost: m.credits,
      status: "running",
      startedAt: Date.now(),
      estMs: estimateMs(m.kind, m.speed),
    };
    set((s) => ({ jobs: [job, ...s.jobs].slice(0, 30) }));
    void run(job);
    return { id: job.id };
  };

  return {
    jobs: [],
    toasts: [],
    start,
    cancel: (id) => {
      const j = get().jobs.find((x) => x.id === id);
      if (!j || j.status !== "running") return;
      patch(id, { status: "cancelled", finishedAt: Date.now(), error: "Cancelled. Credits refunded." });
      if (serverUser()) setTimeout(() => void hydrate(), 4000); // the server refunds an abandoned request; resync
      else refund(j.cost);
      controllers.get(id)?.abort();
    },
    retry: (id) => {
      const j = get().jobs.find((x) => x.id === id);
      if (!j) return "invalid";
      return start({ kind: j.kind, model: j.model, prompt: j.prompt, aspect: j.aspect });
    },
    dismiss: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id || j.status === "running") })),
    clearFinished: () => set((s) => ({ jobs: s.jobs.filter((j) => j.status === "running") })),
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  };
});

export const STAGES = ["Queued", "Understanding prompt", "Rendering", "Finishing"] as const;

export type Progress = {
  pct: number;
  stage: (typeof STAGES)[number];
  stageIndex: number;
  elapsedMs: number;
  etaMs: number;
  slow: boolean;
};

/**
 * Truthful, time-based progress. Reaches ~90% at the estimate, then creeps asymptotically toward 98%.
 * 100% is only ever shown for a finished job.
 */
export function computeProgress(job: Job, now: number): Progress {
  if (job.status === "done") {
    const el = (job.finishedAt ?? now) - job.startedAt;
    return { pct: 100, stage: "Finishing", stageIndex: 3, elapsedMs: el, etaMs: 0, slow: false };
  }
  const elapsedMs = Math.max(0, (job.finishedAt ?? now) - job.startedAt);
  const r = elapsedMs / job.estMs;
  const pct = r < 1 ? r * 90 : 90 + 8 * (1 - Math.exp(-(r - 1) * 1.5));
  const stageIndex = elapsedMs < 600 ? 0 : pct < 20 ? 1 : pct < 85 ? 2 : 3;
  return {
    pct: Math.min(98, Math.round(pct)),
    stage: STAGES[stageIndex],
    stageIndex,
    elapsedMs,
    etaMs: Math.max(0, job.estMs - elapsedMs),
    slow: r > 1.5,
  };
}

/** Ticking clock; only runs while `active`. */
export function useNow(active: boolean, every = 250) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t0 = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), every);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, [active, every]);
  return now;
}

export const fmtSecs = (ms: number) => `${Math.max(0, Math.round(ms / 1000))}s`;

/* ---------------- sync status ---------------- */

export type SyncState = "saved" | "saving" | "offline";
const PERSIST_KEY = "kinetic-store";

export const useSync = create<{ state: SyncState; set: (s: SyncState) => void }>()((set) => ({
  state: "saved",
  set: (state) => set({ state }),
}));

let syncWired = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

function verifyPersisted() {
  const setS = useSync.getState().set;
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) throw new Error("offline");
    const raw = localStorage.getItem(PERSIST_KEY);
    const saved = raw ? JSON.parse(raw)?.state : null;
    const cur = useStore.getState();
    if (!saved || saved.credits !== cur.credits || (saved.library?.length ?? 0) !== cur.library.length) throw new Error("pending");
    setS("saved");
  } catch (e) {
    const offline = e instanceof Error && e.message === "offline";
    setS(offline ? "offline" : "saving");
    clearTimeout(retryTimer);
    retryTimer = setTimeout(verifyPersisted, 2000);
  }
}

function wireSync() {
  if (syncWired || typeof window === "undefined") return;
  syncWired = true;
  let t: ReturnType<typeof setTimeout> | undefined;
  useStore.subscribe((s, p) => {
    if (s.credits === p.credits && s.library === p.library) return;
    useSync.getState().set(navigator.onLine === false ? "offline" : "saving");
    clearTimeout(t);
    t = setTimeout(verifyPersisted, 350);
  });
  window.addEventListener("online", verifyPersisted);
  window.addEventListener("offline", () => useSync.getState().set("offline"));
  if (navigator.onLine === false) useSync.getState().set("offline");
}

/** Persistence status for credits + library. */
export function useSyncStatus(): SyncState {
  useEffect(() => {
    wireSync();
  }, []);
  return useSync((s) => s.state);
}
