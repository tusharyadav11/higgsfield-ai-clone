"use client";

import { Flame, Gift } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { claimBonus, useStore } from "@/lib/store";
import { claimServer } from "@/lib/server-sync";
import { useMounted } from "@/components/growth/hooks";

type Bit = { id: number; dx: string; dy: string; rot: string; color: string; w: number; h: number };
const COLORS = ["var(--accent)", "#ffffff", "#7c3aed", "#22d3ee", "#f472b6", "#fbbf24"];

/** Small custom confetti: ~34 absolutely positioned CSS-animated bits, removed after the burst. */
function makeBurst(): Bit[] {
  return Array.from({ length: 34 }, (_, i) => {
    const a = Math.random() * Math.PI * 2;
    const d = 70 + Math.random() * 150;
    return {
      id: i,
      dx: `${Math.round(Math.cos(a) * d)}px`,
      dy: `${Math.round(Math.sin(a) * d - 60)}px`,
      rot: `${Math.round((Math.random() - 0.5) * 900)}deg`,
      color: COLORS[i % COLORS.length],
      w: 5 + Math.round(Math.random() * 5),
      h: 8 + Math.round(Math.random() * 6),
    };
  });
}

export function StreakCard() {
  const streak = useStore((s) => s.streak);
  const lastClaim = useStore((s) => s.lastClaim);
  const claimDaily = useStore((s) => s.claimDaily);
  const serverUser = useStore((s) => !!s.user?.server);
  const [flash, setFlash] = useState<number | null>(null);
  const [bits, setBits] = useState<Bit[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mounted = useMounted();
  useEffect(() => () => clearTimeout(timer.current), []);
  // "today" is read after mount so the prerender never bakes in a date
  const [today, setToday] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setToday(new Date().toISOString().slice(0, 10)), []);
  const claimed = today !== null && lastClaim === today;
  const nextBonus = claimBonus(claimed ? streak + 1 : lastClaim && streak ? streak + 1 : 1);
  const filled = mounted && streak > 0 ? ((streak - 1) % 7) + 1 : 0;

  return (
    <section
      data-spot
      className="spot spot-fill relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-line bg-surface/90 p-5"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full bg-[radial-gradient(closest-side,var(--glow),transparent)] opacity-70"
      />
      <div className="relative flex items-center gap-4">
        <div className="relative grid size-16 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent">
          <Flame size={34} className={`fill-accent ${filled ? "animate-flame" : "opacity-60"}`} />
          {bits && (
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-10">
              {bits.map((b) => (
                <i
                  key={b.id}
                  className="absolute rounded-[2px]"
                  style={
                    {
                      width: b.w,
                      height: b.h,
                      background: b.color,
                      "--dx": b.dx,
                      "--dy": b.dy,
                      "--rot": b.rot,
                      animation: "confetti 1.1s cubic-bezier(.15,.7,.3,1) forwards",
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted">Daily streak</p>
          <p className="text-3xl font-bold tracking-tighter text-fg">
            <span data-testid="streak-count" suppressHydrationWarning>
              {streak}
            </span>{" "}
            <span className="text-base font-normal tracking-normal text-muted">day{streak === 1 ? "" : "s"}</span>
          </p>
        </div>
      </div>
      <div className="relative flex gap-1.5" aria-hidden>
        {Array.from({ length: 7 }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${i < filled ? "bg-accent shadow-[0_0_10px_var(--glow)]" : "bg-surface-2"}`}
            style={{ transitionDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
      <div className="relative flex flex-col gap-2">
        <button
          type="button"
          data-testid="streak-claim"
          disabled={claimed}
          suppressHydrationWarning
          onClick={async () => {
            const r = serverUser ? await claimServer() : claimDaily();
            if (r.ok) {
              setFlash(r.gained);
              if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                setBits(makeBurst());
                clearTimeout(timer.current);
                timer.current = setTimeout(() => setBits(null), 1300);
              }
            }
          }}
          className="btn-glow inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          <Gift size={16} />
          <span suppressHydrationWarning>{claimed ? "Claimed today" : `Claim +${nextBonus} credits`}</span>
        </button>
        <p className="text-xs text-muted" role="status" suppressHydrationWarning>
          {flash !== null ? `+${flash} credits added. Come back tomorrow to grow your streak.` : claimed ? "Come back tomorrow for a bigger bonus." : "Bonus grows with your streak."}
        </p>
      </div>
    </section>
  );
}
