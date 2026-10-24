"use client";
import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { smoothPath, type DayPoint } from "@/lib/usage";
import { cn } from "@/components/ui/cn";

const W = 600, H = 200, PAD = 8;
const EARN = "#5eead4";

function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}
const fmtDay = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });

export function AreaChart({ days }: { days: DayPoint[] }) {
  const id = useId().replace(/:/g, "");
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const n = days.length;
  const max = niceMax(Math.max(0, ...days.flatMap((d) => [d.spent, d.earned])));
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * W : W / 2);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const line = (k: "spent" | "earned") => smoothPath(days.map((d, i) => [x(i), y(d[k])]));
  const area = (k: "spent" | "earned") => `${line(k)}L${x(n - 1)} ${H}L${x(0)} ${H}Z`;
  const at = active === null ? null : days[Math.min(n - 1, active)];
  const pctX = (i: number) => (n > 1 ? (i / (n - 1)) * 100 : 50);

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setActive(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
  };
  const key = (e: KeyboardEvent) => {
    const cur = active ?? n - 1;
    const next = e.key === "ArrowLeft" ? cur - 1 : e.key === "ArrowRight" ? cur + 1 : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : e.key === "Escape" ? -1 : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next < 0 ? null : Math.max(0, Math.min(n - 1, next)));
  };

  return (
    <div data-testid="usage-chart" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-accent" aria-hidden />Spent</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: EARN }} aria-hidden />Earned</span>
        </div>
        <button type="button" aria-pressed={table} onClick={() => setTable((v) => !v)} className="min-h-8 rounded-full border border-line px-3 hover:border-accent hover:text-fg">
          {table ? "Show chart" : "View as table"}
        </button>
      </div>

      {table ? (
        <div className="max-h-64 overflow-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm tabular-nums">
            <caption className="sr-only">Credits spent and earned per day (UTC)</caption>
            <thead className="sticky top-0 bg-surface-2 text-xs text-muted"><tr><th className="px-3 py-2 font-medium">Day</th><th className="px-3 py-2 font-medium">Spent</th><th className="px-3 py-2 font-medium">Earned</th></tr></thead>
            <tbody>{days.map((d) => (<tr key={d.date} className="border-t border-line"><td className="px-3 py-1.5">{fmtDay(d.date)}</td><td className="px-3 py-1.5">{d.spent}</td><td className="px-3 py-1.5">{d.earned}</td></tr>))}</tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="relative flex w-8 flex-col justify-between py-1 text-right text-[10px] tabular-nums text-muted" aria-hidden>
            <span>{max}</span><span>{Math.round(max / 2)}</span><span>0</span>
          </div>
          <div
            role="group"
            tabIndex={0}
            aria-roledescription="chart"
            aria-label={`Credits spent and earned per day, ${fmtDay(days[0].date)} to ${fmtDay(days[n - 1].date)}. Use left and right arrow keys to read each day.`}
            onPointerMove={move}
            onPointerDown={move}
            onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
            onKeyDown={key}
            onBlur={() => setActive(null)}
            className="relative h-44 min-w-0 flex-1 touch-pan-y rounded-lg outline-offset-4 sm:h-56"
          >
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="size-full overflow-visible" aria-hidden>
              <defs>
                <linearGradient id={`a${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".45" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient>
                <linearGradient id={`e${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={EARN} stopOpacity=".28" /><stop offset="1" stopColor={EARN} stopOpacity="0" /></linearGradient>
              </defs>
              {[0, 0.5, 1].map((f) => (<line key={f} x1="0" x2={W} y1={y(max * f)} y2={y(max * f)} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray={f ? "3 4" : undefined} />))}
              <path d={area("earned")} fill={`url(#e${id})`} />
              <path d={line("earned")} fill="none" stroke={EARN} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
              <path d={area("spent")} fill={`url(#a${id})`} />
              <path d={line("spent")} fill="none" stroke="var(--accent)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
              {at && active !== null && <line x1={x(active)} x2={x(active)} y1="0" y2={H} stroke="var(--muted)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="2 3" />}
            </svg>
            {at && active !== null && (
              <>
                <span className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-accent" style={{ left: `${pctX(active)}%`, top: `${(y(at.spent) / H) * 100}%` }} aria-hidden />
                <div
                  data-testid="usage-tooltip"
                  className={cn("pointer-events-none absolute top-0 z-10 w-36 rounded-xl border border-line bg-surface-2/95 p-2 text-xs shadow-xl backdrop-blur", pctX(active) > 60 ? "-translate-x-[calc(100%+12px)]" : "translate-x-3")}
                  style={{ left: `${pctX(active)}%` }}
                >
                  <div className="font-semibold">{fmtDay(at.date)}</div>
                  <div className="mt-1 flex justify-between text-muted"><span>Spent</span><b className="text-accent tabular-nums">{at.spent}</b></div>
                  <div className="flex justify-between text-muted"><span>Earned</span><b className="tabular-nums" style={{ color: EARN }}>{at.earned}</b></div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <div className="flex justify-between pl-10 text-[10px] text-muted" aria-hidden>
        <span>{fmtDay(days[0].date)}</span>{n > 14 && <span>{fmtDay(days[Math.floor(n / 2)].date)}</span>}<span>{fmtDay(days[n - 1].date)}</span>
      </div>
      <p className="sr-only" aria-live="polite">{at ? `${fmtDay(at.date)}: ${at.spent} credits spent, ${at.earned} earned` : ""}</p>
    </div>
  );
}
