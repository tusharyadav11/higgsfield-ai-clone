"use client";

import Image from "next/image";
import { useState } from "react";
import { Activity, ChevronsLeftRight } from "lucide-react";
import { CountUp } from "@/components/ui/CountUp";
import { useNow } from "@/components/growth/hooks";

const BASE = 12480;

/** Live-feeling stats. The number is a pure function of the UTC clock (read after mount), never random. */
export function LiveStats({ remixes, models }: { remixes: number; models: number }) {
  const now = useNow(10_000);
  const sinceMidnight = now ? (now % 86_400_000) / 1000 : 0;
  const today = BASE + Math.floor(sinceMidnight * 0.12);
  return (
    <section
      data-spot
      className="spot spot-fill relative overflow-hidden rounded-3xl border border-line bg-surface/90 p-5"
      aria-label="Live activity"
    >
      <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
          <span className="relative inline-flex size-2 rounded-full bg-accent" />
        </span>
        Live now
      </p>
      <p className="text-4xl font-bold tracking-tighter text-fg">
        <CountUp value={today} from={0} />
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
        <Activity size={14} className="text-accent-text" /> creations made today
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
        <div>
          <p className="text-xl font-semibold tabular-nums text-fg">
            <CountUp value={remixes} from={0} ms={1400} />
          </p>
          <p className="text-xs text-muted">remixes this week</p>
        </div>
        <div>
          <p className="text-xl font-semibold tabular-nums text-fg">
            <CountUp value={models} from={0} ms={700} />
          </p>
          <p className="text-xs text-muted">models, one credit pool</p>
        </div>
      </div>
    </section>
  );
}

/** Prompt -> picture before/after reveal. Auto-sweeps until the visitor grabs it. */
export function CompareSlider({ src, blur, prompt, title }: { src: string; blur?: string; prompt: string; title: string }) {
  const [pos, setPos] = useState<number | null>(null);
  return (
    <section
      data-spot
      className="spot flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface/90"
      aria-labelledby="cmp-h"
    >
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
        <h2 id="cmp-h" className="text-xl font-semibold text-fg">
          Prompt in. Magic out.
        </h2>
        <span className="inline-flex items-center gap-1 text-xs text-muted">
          <ChevronsLeftRight size={14} className="text-accent-text" /> drag to reveal
        </span>
      </div>
      <div
        className={`cmp relative mx-3 mb-3 aspect-[4/3] min-h-0 flex-1 touch-pan-y overflow-hidden rounded-2xl bg-surface-2 sm:aspect-[16/10] ${pos === null ? "auto" : ""}`}
        style={pos === null ? undefined : ({ "--pos": `${pos}%` } as React.CSSProperties)}
      >
        <Image src={src} alt={title} fill sizes="(min-width:1024px) 640px, 100vw" placeholder={blur ? "blur" : "empty"} blurDataURL={blur} className="object-cover" />
        <div className="cmp-top absolute inset-0 bg-bg">
          <Image
            src={src}
            alt=""
            fill
            sizes="(min-width:1024px) 640px, 100vw"
            className="scale-110 object-cover opacity-40 blur-2xl grayscale"
          />
          <div className="absolute inset-0 grid place-items-center p-5">
            <p className="max-w-[80%] font-mono text-xs leading-relaxed text-fg/90 sm:text-sm">
              <span className="text-accent-text">&gt; </span>
              {prompt}
              <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 bg-accent motion-safe:animate-[blink_1s_steps(1)_infinite]" />
            </p>
          </div>
        </div>
        <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">Prompt</span>
        <span className="absolute right-3 top-3 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-fg">Result</span>
        <div className="cmp-line pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-accent shadow-[0_0_18px_var(--accent)]">
          <span className="absolute left-1/2 top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent text-accent-fg shadow-lg">
            <ChevronsLeftRight size={18} />
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={pos ?? 50}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Reveal result"
          className="absolute inset-0 z-10 size-full cursor-ew-resize opacity-0"
        />
      </div>
    </section>
  );
}
