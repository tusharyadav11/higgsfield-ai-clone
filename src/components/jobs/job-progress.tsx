"use client";

import { Loader2, X } from "lucide-react";
import { STAGES, computeProgress, fmtSecs, useJobs, useNow, type Job } from "@/lib/jobs";

const TIPS = [
  "Describe lighting and lens (golden hour, 35mm) for more cinematic results.",
  "Short, concrete prompts beat long vague ones.",
  "Remix a community prompt and change just one noun.",
  "Claim your daily streak on Home for free credits.",
  "Video costs more credits. Draft the idea as an image first.",
  "You can leave this page. We will tell you the moment it is ready.",
];

export function JobProgress({ job, compact = false }: { job: Job; compact?: boolean }) {
  const running = job.status === "running";
  const now = useNow(running);
  const cancel = useJobs((s) => s.cancel);
  const p = computeProgress(job, now);
  const tip = TIPS[Math.floor(p.elapsedMs / 3000) % TIPS.length];

  return (
    <div data-testid="job-progress" role="status" aria-live="polite" className="w-full">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 font-medium text-fg">
          <Loader2 size={14} className="animate-spin text-accent motion-reduce:animate-none" aria-hidden />
          {p.stage}
        </span>
        <span className="tabular-nums text-muted">{p.pct}%</span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p.pct}
        aria-label={`${job.kind} generation progress`}
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${p.pct}%` }} />
      </div>
      {!compact && (
        <ol className="mt-3 flex gap-1 text-[11px] text-muted" aria-label="Stages">
          {STAGES.map((s, i) => (
            <li key={s} className={`flex-1 truncate border-t-2 pt-1 ${i <= p.stageIndex ? "border-accent text-fg" : "border-line"}`}>
              {s}
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-xs tabular-nums text-muted">
        {fmtSecs(p.elapsedMs)} elapsed · {p.slow ? "finishing soon" : `about ${fmtSecs(p.etaMs)} left (estimate)`}
      </p>
      {p.slow && (
        <div data-testid="job-slow" className="mt-2 rounded-xl border border-line bg-surface-2 p-3 text-xs text-fg">
          Taking longer than usual. It is still running and your credits are safe: if it fails they are refunded automatically.
        </div>
      )}
      {!compact && <p className="mt-2 text-sm text-muted">Tip: {tip}</p>}
      <button
        type="button"
        data-testid="job-cancel"
        onClick={() => cancel(job.id)}
        className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-sm text-fg hover:border-accent"
      >
        <X size={14} /> Cancel and refund
      </button>
    </div>
  );
}
