"use client";
import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { smoothPath } from "@/lib/usage";
import { RANGE_META, type Bucket, type RangeId } from "@/lib/enterprise/demo-data";
import { cn } from "@/components/ui/cn";

const W = 600, H = 220, PAD = 10;
const nf = (n: number) => n.toLocaleString("en");

function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

export function WsChart({ range, buckets }: { range: RangeId; buckets: Bucket[] }) {
  const gid = useId().replace(/:/g, "");
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const n = buckets.length;
  const area = range === "daily";
  const max = niceMax(Math.max(0, ...buckets.map((b) => b.credits)));
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const slot = W / n;
  const x = (i: number) => (area ? (n > 1 ? (i / (n - 1)) * W : W / 2) : slot * i + slot / 2);
  const pctX = (i: number) => (x(i) / W) * 100;
  const line = smoothPath(buckets.map((b, i) => [x(i), y(b.credits)]));
  const at = active === null ? null : buckets[Math.min(n - 1, active)];
  const span = (b: Bucket) => (b.from === b.to ? b.label : `${b.from} to ${b.to}`);
  const unit = RANGE_META[range].hint.toLowerCase();

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = (e.clientX - r.left) / r.width;
    setActive(Math.max(0, Math.min(n - 1, area ? Math.round(f * (n - 1)) : Math.floor(f * n))));
  };
  const key = (e: KeyboardEvent) => {
    const cur = active ?? n - 1;
    const next = e.key === "ArrowLeft" ? cur - 1 : e.key === "ArrowRight" ? cur + 1 : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : e.key === "Escape" ? -1 : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next < 0 ? null : Math.max(0, Math.min(n - 1, next)));
  };
  const labelEvery = n > 12 ? 2 : 1;

  return (
    <div data-testid="usage-chart-ws" data-range={range} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-accent-text" aria-hidden />Credits consumed · {unit} · UTC</span>
        <button type="button" data-testid="usage-chart-toggle" aria-pressed={table} onClick={() => setTable((v) => !v)} className="min-h-11 rounded-full border border-line px-3 hover:border-accent hover:text-fg">
          {table ? "Show chart" : "View as table"}
        </button>
      </div>
      {table ? (
        <div className="max-h-64 overflow-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm tabular-nums">
            <caption className="sr-only">Credits consumed per {range === "daily" ? "day" : range === "weekly" ? "week" : "month"} (demo data)</caption>
            <thead className="sticky top-0 bg-surface-2 text-xs text-muted"><tr><th className="px-3 py-2 font-medium">Period</th><th className="px-3 py-2 text-right font-medium">Credits</th></tr></thead>
            <tbody>{buckets.map((b) => <tr key={b.key} className="border-t border-line"><td className="px-3 py-1.5">{span(b)}</td><td className="px-3 py-1.5 text-right">{nf(b.credits)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="flex w-10 flex-col justify-between py-1 text-right text-[10px] tabular-nums text-muted" aria-hidden>
            <span>{nf(max)}</span><span>{nf(Math.round(max / 2))}</span><span>0</span>
          </div>
          <div
            role="group"
            tabIndex={0}
            aria-roledescription="chart"
            aria-label={`Credits consumed, ${unit}. ${n} points. Use left and right arrow keys to read each one.`}
            onPointerMove={move}
            onPointerDown={move}
            onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
            onKeyDown={key}
            onBlur={() => setActive(null)}
            className="relative h-48 min-w-0 flex-1 touch-pan-y rounded-lg outline-offset-4 sm:h-60"
          >
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="size-full overflow-visible" aria-hidden>
              <defs>
                <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".45" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient>
              </defs>
              {[0, 0.5, 1].map((f) => <line key={f} x1="0" x2={W} y1={y(max * f)} y2={y(max * f)} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray={f ? "3 4" : undefined} />)}
              {area ? (
                <>
                  <path d={`${line}L${x(n - 1)} ${H}L${x(0)} ${H}Z`} fill={`url(#g${gid})`} />
                  <path d={line} fill="none" stroke="var(--accent-text)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                </>
              ) : (
                buckets.map((b, i) => {
                  const h = Math.max(b.credits > 0 ? 2 : 0, H - PAD - y(b.credits));
                  return <rect key={b.key} x={slot * i + slot * 0.14} width={slot * 0.72} y={H - PAD - h} height={h} fill={i === active ? "var(--accent-text)" : "var(--accent)"} opacity={active === null || i === active ? 1 : 0.55} className="motion-safe:transition-opacity" />;
                })
              )}
              {at && active !== null && area && <line x1={x(active)} x2={x(active)} y1="0" y2={H} stroke="var(--muted)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="2 3" />}
            </svg>
            {at && active !== null && (
              <>
                {area && <span className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-accent" style={{ left: `${pctX(active)}%`, top: `${(y(at.credits) / H) * 100}%` }} aria-hidden />}
                <div data-testid="usage-tooltip" className={cn("pointer-events-none absolute top-0 z-10 w-40 rounded-xl border border-line bg-surface-2/95 p-2 text-xs shadow-xl backdrop-blur", pctX(active) > 55 ? "-translate-x-[calc(100%+12px)]" : "translate-x-3")} style={{ left: `${pctX(active)}%` }}>
                  <div className="font-semibold">{span(at)}</div>
                  <div className="mt-1 flex justify-between text-muted"><span>Consumed</span><b className="tabular-nums text-accent-text">{nf(at.credits)}</b></div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <div className="relative ml-12 h-4 text-[10px] text-muted" aria-hidden>
        {buckets.map((b, i) => (i % labelEvery === 0 || i === n - 1) && (
          <span key={b.key} className={cn("absolute top-0 -translate-x-1/2 whitespace-nowrap", n > 8 && "max-[420px]:hidden")} style={{ left: `${pctX(i)}%` }}>{b.label}</span>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">{at ? `${span(at)}: ${at.credits} credits consumed` : ""}</p>
    </div>
  );
}
