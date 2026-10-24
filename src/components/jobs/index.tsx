"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles, X } from "lucide-react";
import { computeProgress, useJobs, useNow } from "@/lib/jobs";
import { JobProgress } from "./job-progress";

export { SyncBadge } from "./sync-badge";
export { JobProgress } from "./job-progress";

function Toasts() {
  const toasts = useJobs((s) => s.toasts);
  const dismiss = useJobs((s) => s.dismissToast);
  const path = usePathname();
  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => dismiss(toasts[0].id), 6000);
    return () => clearTimeout(t);
  }, [toasts, dismiss]);
  const shown = path === "/create" ? [] : toasts;
  if (!shown.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-24 z-50 flex flex-col items-center gap-2 sm:bottom-6 sm:items-end sm:pr-3">
      {shown.map((t) => (
        <div key={t.id} data-testid="job-toast" role="status" className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-xl">
          {t.type === "done" ? <CheckCircle2 size={18} className="shrink-0 text-accent" /> : <AlertTriangle size={18} className="shrink-0 text-red-400" />}
          <span className="min-w-0 flex-1 text-sm text-fg">{t.text}</span>
          <Link href={`/create?job=${t.jobId}`} onClick={() => dismiss(t.id)} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-accent">
            {t.type === "done" ? "View result" : "Open"}
          </Link>
          <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="grid size-9 place-items-center text-muted">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Mounted once in Shell: toasts + leave-page guard while any job runs. */
export function JobsRoot() {
  const running = useJobs((s) => s.jobs.some((j) => j.status === "running"));
  useEffect(() => {
    if (!running) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [running]);
  return <Toasts />;
}

/** Header pill: spinner + % + count while running; opens the tray. */
export function JobPill() {
  const jobs = useJobs((s) => s.jobs);
  const clear = useJobs((s) => s.clearFinished);
  const [open, setOpen] = useState(false);
  const running = jobs.filter((j) => j.status === "running");
  const now = useNow(running.length > 0);
  if (!jobs.length) return null;
  const lead = running.length ? Math.max(...running.map((j) => computeProgress(j, now).pct)) : 0;

  return (
    <>
      <button
        type="button"
        data-testid="job-pill"
        aria-label={running.length ? `${running.length} generation running, ${lead}%` : `${jobs.length} finished jobs`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-semibold tabular-nums hover:border-accent"
      >
        {running.length ? (
          <>
            <Loader2 className="size-4 animate-spin text-accent motion-reduce:animate-none" aria-hidden />
            {lead}%{running.length > 1 && <span className="text-muted">· {running.length}</span>}
          </>
        ) : (
          <>
            <Sparkles className="size-4 text-accent" aria-hidden />
            {jobs.length}
          </>
        )}
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50" onClick={() => setOpen(false)}>
            <div
              data-testid="job-tray"
              role="dialog"
              aria-label="Generation jobs"
              onClick={(e) => e.stopPropagation()}
              className="absolute right-3 top-14 max-h-[75dvh] w-[min(calc(100vw-1.5rem),24rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-3 shadow-2xl"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-fg">Jobs</p>
                <div className="flex gap-1">
                  {running.length !== jobs.length && (
                    <button type="button" onClick={clear} className="min-h-11 px-3 text-xs text-muted hover:text-fg">Clear finished</button>
                  )}
                  <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="grid size-11 place-items-center text-muted"><X size={16} /></button>
                </div>
              </div>
              <ul className="space-y-2">
                {jobs.map((j) => (
                  <li key={j.id} className="rounded-xl border border-line bg-bg p-3">
                    <p className="line-clamp-1 text-sm text-fg">{j.prompt}</p>
                    <p className="mb-2 text-xs text-muted">{j.modelName} · {j.kind} · {j.cost} credits</p>
                    {j.status === "running" ? (
                      <JobProgress job={j} compact />
                    ) : j.status === "done" ? (
                      <Link href={`/create?job=${j.id}`} onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent">
                        <CheckCircle2 size={14} /> View result
                      </Link>
                    ) : (
                      <p className="text-xs text-muted">{j.error}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
