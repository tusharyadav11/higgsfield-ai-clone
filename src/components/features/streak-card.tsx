"use client";

import { Flame, Gift } from "lucide-react";
import { useEffect, useState } from "react";
import { claimBonus, useStore } from "@/lib/store";

export function StreakCard() {
  const streak = useStore((s) => s.streak);
  const lastClaim = useStore((s) => s.lastClaim);
  const claimDaily = useStore((s) => s.claimDaily);
  const [flash, setFlash] = useState<number | null>(null);
  // "today" is read after mount so the prerender never bakes in a date
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(new Date().toISOString().slice(0, 10)), []);
  const claimed = today !== null && lastClaim === today;
  const nextBonus = claimBonus(claimed ? streak + 1 : lastClaim && streak ? streak + 1 : 1);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div
          className={`grid size-14 place-items-center rounded-2xl bg-accent/15 text-accent ${streak > 0 ? "motion-safe:animate-pulse" : ""}`}
        >
          <Flame size={30} className={streak > 0 ? "fill-accent" : ""} />
        </div>
        <div>
          <p className="text-sm text-muted">Daily streak</p>
          <p className="text-2xl font-semibold text-fg">
            <span data-testid="streak-count" suppressHydrationWarning>
              {streak}
            </span>{" "}
            <span className="text-base font-normal text-muted">day{streak === 1 ? "" : "s"}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1 sm:items-end">
        <button
          type="button"
          data-testid="streak-claim"
          disabled={claimed}
          suppressHydrationWarning
          onClick={() => {
            const r = claimDaily();
            if (r.ok) setFlash(r.gained);
          }}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Gift size={16} />
          <span suppressHydrationWarning>
            {claimed ? "Claimed today" : `Claim +${nextBonus} credits`}
          </span>
        </button>
        <p className="text-xs text-muted" role="status" suppressHydrationWarning>
          {flash !== null ? `+${flash} credits added. Come back tomorrow to grow your streak.` : claimed ? "Come back tomorrow for a bigger bonus." : "Bonus grows with your streak."}
        </p>
      </div>
    </section>
  );
}
