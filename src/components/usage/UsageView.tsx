"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Download, Film, Flame, ImageIcon, Info, Plug, Sparkles, Wand2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useServerInfo } from "@/lib/server-info";
import { Button, Card, Skeleton } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { useMounted, useNow } from "@/components/growth/hooks";
import { guestEntries, insights, isEmpty, RANGES, RANGE_DAYS, smoothPath, summarize, toCsv, TOOL_LABEL, type Range, type Tool, type ToolStat, type UsageSummary } from "@/lib/usage";
import { AreaChart } from "./AreaChart";
import { useBudget, useCountUp, useEntered } from "./hooks";

const ICON: Record<string, typeof ImageIcon> = { image: ImageIcon, video: Film, enhance: Wand2, mcp: Plug };
const NOTE: Record<string, string> = { enhance: "Always free", mcp: "Billed as Image/Video runs" };
const nf = (n: number) => n.toLocaleString("en");

export function UsageView() {
  const mounted = useMounted();
  const user = useStore((s) => s.user);
  const server = !!user?.server;
  const dbKnown = useServerInfo((s) => s.db);
  const credits = useStore((s) => s.credits);
  const streak = useStore((s) => s.streak);
  const library = useStore((s) => s.library);
  const now = useNow(60_000);
  const [range, setRangeState] = useState<Range>("30d");
  const [cache, setCache] = useState<Partial<Record<Range, UsageSummary>>>({});
  const [failed, setFailed] = useState(false);

  const setRange = setRangeState;

  useEffect(() => {
    if (!mounted || !server) return;
    let live = true;
    fetch(`/api/me/usage?range=${range}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<UsageSummary>) : Promise.reject(new Error(String(r.status)))))
      .then((s) => live && (setFailed(false), setCache((c) => ({ ...c, [range]: s }))))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [mounted, server, range, credits]);

  const guestSummary = useMemo(
    () => (mounted && !server && now ? summarize(guestEntries(library), { range, nowMs: now, balance: credits, streak, guest: true }) : null),
    [mounted, server, now, library, range, credits, streak],
  );
  const base = server ? (cache[range] ?? null) : guestSummary;
  const summary = base ? { ...base, balance: credits, streak: server ? base.streak : streak } : null;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Your usage</h1>
          <p className="mt-1 text-sm text-muted">Where your credits go. Days are counted in UTC.</p>
        </div>
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Date range" className="flex rounded-full border border-line bg-surface p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                role="tab"
                type="button"
                aria-selected={range === r}
                data-testid={`usage-range-${r}`}
                onClick={() => setRange(r)}
                className={cn("min-h-11 rounded-full px-3.5 text-sm font-medium transition", range === r ? "bg-accent text-accent-fg" : "text-muted hover:text-fg")}
              >
                {r}
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            data-testid="usage-export"
            disabled={!summary || isEmpty(summary)}
            onClick={() => summary && download(summary)}
            aria-label="Export CSV"
          >
            <Download className="size-4" aria-hidden /> <span className="max-sm:sr-only">Export CSV</span>
          </Button>
        </div>
      </header>

      {!summary ? (
        failed ? <Card role="alert" className="text-sm text-muted">Could not load your usage right now. Try again in a moment.</Card> : <Loading />
      ) : (
        <Dashboard s={summary} credits={credits} />
      )}
      {mounted && !server && (
        <p data-testid="usage-guest-note" className="flex items-start gap-2 text-xs text-muted">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Showing what this browser knows about.{" "}
            {dbKnown === false ? "Accounts are off in this demo deployment." : <><Link href="/signup" className="text-accent-text underline-offset-2 hover:underline">Sign in</Link> to keep history on every device.</>}
          </span>
        </p>
      )}
      <p className="flex items-start gap-2 text-xs text-muted">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>Usage is measured in credits, this app&apos;s spend unit. Model tokens are not tracked.</span>
      </p>
    </>
  );
}

function download(s: UsageSummary) {
  const url = URL.createObjectURL(new Blob([toCsv(s)], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `usage-${s.range}-${s.to}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Loading() {
  return (
    <div aria-busy data-testid="usage-loading" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <Skeleton className="h-72" /><Skeleton className="h-72" />
      <Skeleton className="h-32 lg:col-span-2" />
    </div>
  );
}

function Dashboard({ s, credits }: { s: UsageSummary; credits: number }) {
  const empty = isEmpty(s);
  const tips = insights(s);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Hero s={s} credits={credits} />
        <Card className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Spent vs earned</h2>
          {empty ? (
            <div data-testid="usage-empty" className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
              <Sparkles className="size-8 text-accent-text" aria-hidden />
              <p className="font-semibold">No activity in the last {RANGE_DAYS[s.range]} days</p>
              <p className="max-w-sm text-sm text-muted">Once you create something, your spend, favourite models and streaks show up here.</p>
              <Link href="/create" className="inline-flex min-h-11 items-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg">Make your first creation</Link>
            </div>
          ) : (
            <AreaChart days={s.days} />
          )}
        </Card>
      </div>

      {!empty && (
        <>
          <section aria-label="Insights" className="flex flex-col gap-2 rounded-2xl border border-line bg-surface-2/50 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-accent-text" aria-hidden />Insights</h2>
            <ul className="grid gap-2 md:grid-cols-3">
              {tips.map((t) => (<li key={t} data-testid="usage-insight" className="rounded-xl bg-surface p-3 text-sm leading-snug">{t}</li>))}
            </ul>
          </section>

          <section aria-label="By tool">
            <h2 className="mb-2 text-sm font-semibold">By tool</h2>
            <div className="grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 xl:grid-cols-4">
              {s.tools.filter((t) => t.tool !== "other").map((t) => (<ToolCard key={t.tool} t={t} s={s} />))}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Models s={s} />
            <div className="flex flex-col gap-4">
              <Budget s={s} />
              {s.grants.length > 0 && <Grants s={s} />}
            </div>
          </div>
        </>
      )}
      {empty && <Budget s={s} />}
    </div>
  );
}

function Hero({ s, credits }: { s: UsageSummary; credits: number }) {
  const shown = useCountUp(credits);
  const entered = useEntered();
  const R = 54, C = 2 * Math.PI * R;
  const frac = credits + s.spent > 0 ? credits / (credits + s.spent) : 1;
  const low = credits < 10;
  return (
    <Card className="relative flex flex-col items-center gap-4 overflow-hidden text-center">
      <div aria-hidden className="pointer-events-none absolute -top-16 left-1/2 size-56 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
      <div className="relative size-44">
        <svg viewBox="0 0 128 128" className="size-full -rotate-90" aria-hidden>
          <circle cx="64" cy="64" r={R} fill="none" stroke="var(--line)" strokeWidth="10" />
          <circle cx="64" cy="64" r={R} fill="none" stroke="var(--accent)" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={entered ? C * (1 - frac) : C} className="transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span data-testid="usage-balance" aria-label={`${credits} credits`} className="text-4xl font-bold tabular-nums tracking-tight">{nf(shown)}</span>
          <span className="text-xs text-muted">credits left</span>
        </div>
      </div>
      <p className="text-xs text-muted">{Math.round(frac * 100)}% of your credits are still unspent over the last {RANGE_DAYS[s.range]} days</p>
      <dl className="grid w-full grid-cols-3 gap-2 text-center">
        <Stat label="Spent" value={nf(s.spent)} />
        <Stat label="Creations" value={nf(s.generations)} />
        <Stat label="Avg cost" value={s.generations ? String(s.avgCost) : "-"} />
      </dl>
      {s.streak > 0 && <p className="flex items-center gap-1.5 text-sm"><Flame className="size-4 text-accent-text" aria-hidden />{s.streak}-day streak</p>}
      {low && (
        <div data-testid="usage-low-balance" className="w-full rounded-xl border border-line bg-surface-2 p-3 text-left text-sm">
          <p className="text-muted">Running a little low. No pressure, here are two free ways to top up.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/" className="inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">Claim daily credits</Link>
            <Link href="/referrals" className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold hover:border-accent">Invite a friend</Link>
          </div>
        </div>
      )}
    </Card>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl bg-surface-2 px-2 py-2"><dt className="text-[11px] text-muted">{label}</dt><dd className="text-lg font-semibold tabular-nums">{value}</dd></div>
);

function Spark({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  const n = data.length;
  const pts: [number, number][] = data.map((v, i) => [n > 1 ? (i / (n - 1)) * 100 : 50, 26 - (v / max) * 24]);
  const d = smoothPath(pts);
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-8 w-full overflow-visible" aria-hidden>
      <path d={`${d}L100 28L0 28Z`} fill="var(--accent)" opacity=".12" />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
}

function ToolCard({ t, s }: { t: ToolStat; s: UsageSummary }) {
  const Icon = ICON[t.tool];
  const label = TOOL_LABEL[t.tool as Tool];
  const used = t.spent > 0 || t.count > 0;
  const up = (t.deltaPct ?? 0) > 0;
  return (
    <Card data-testid={`usage-tool-${t.tool}`} className={cn("flex flex-col gap-2 transition hover:border-accent/60", !used && "opacity-80")}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold"><span className="flex size-8 items-center justify-center rounded-lg bg-surface-2 text-accent-text"><Icon className="size-4" aria-hidden /></span>{label}</span>
        {t.deltaPct !== null ? (
          <span className="flex items-center gap-0.5 text-xs text-muted" title={`vs previous ${RANGE_DAYS[s.range]} days`}>
            {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}{Math.abs(t.deltaPct)}%
            <span className="sr-only"> {up ? "more" : "less"} than the previous period</span>
          </span>
        ) : used ? <span className="text-xs text-muted">new</span> : null}
      </div>
      <div className="flex items-baseline gap-1"><span className="text-2xl font-bold tabular-nums">{nf(t.spent)}</span><span className="text-xs text-muted">credits</span></div>
      <Spark data={t.spark} />
      <div className="flex justify-between text-xs text-muted">
        <span>{used ? `${t.count} run${t.count === 1 ? "" : "s"}` : (NOTE[t.tool] ?? "No runs yet")}</span>
        <span>{Math.round(t.share * 100)}% of spend</span>
      </div>
    </Card>
  );
}

function Models({ s }: { s: UsageSummary }) {
  const top = s.models.slice(0, 6);
  const max = Math.max(1, ...top.map((m) => m.spent));
  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">Top models</h2>
      {top.length === 0 ? <p className="text-sm text-muted">No model usage in this period.</p> : (
        <ol className="flex flex-col gap-3">
          {top.map((m, i) => (
            <li key={m.id} data-testid="usage-model-row">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate"><span className="mr-2 text-xs tabular-nums text-muted">{i + 1}</span>{m.name}<span className="ml-2 text-xs text-muted">{m.kind}</span></span>
                <span className="shrink-0 tabular-nums"><b>{nf(m.spent)}</b> <span className="text-xs text-muted">credits · {m.count} run{m.count === 1 ? "" : "s"}</span></span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${Math.max(3, (m.spent / max) * 100)}%` }} /></div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function Grants({ s }: { s: UsageSummary }) {
  return (
    <Card>
      <h2 className="mb-2 text-sm font-semibold">Where credits came from</h2>
      <ul className="flex flex-col gap-1.5 text-sm">
        {s.grants.map((g) => (<li key={g.reason} className="flex justify-between"><span className="text-muted">{g.label}</span><b className="tabular-nums">+{nf(g.amount)}</b></li>))}
      </ul>
    </Card>
  );
}

function Budget({ s }: { s: UsageSummary }) {
  const [budget, setBudget] = useBudget();
  const [draft, setDraft] = useState<string | null>(null);
  const f = budget > 0 ? s.monthSpent / budget : 0;
  const warn = budget > 0 && f >= 0.8;
  const over = budget > 0 && f >= 1;
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Monthly budget</h2>
        <label className="flex items-center gap-2 text-xs text-muted">
          <span className="sr-only sm:not-sr-only">Credits per month</span>
          <input
            data-testid="usage-budget-input"
            type="number"
            inputMode="numeric"
            min={0}
            max={1000000}
            placeholder="Set a limit"
            aria-label="Monthly budget in credits"
            value={draft ?? (budget || "")}
            onChange={(e) => {
              setDraft(e.target.value);
              setBudget(Number(e.target.value) || 0);
            }}
            onBlur={() => setDraft(null)}
            className="min-h-11 w-28 rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-accent"
          />
        </label>
      </div>
      {budget > 0 ? (
        <>
          <div role="meter" aria-label="Month-to-date spend against budget" aria-valuemin={0} aria-valuemax={budget} aria-valuenow={Math.min(budget, s.monthSpent)} className="mt-3 h-3 overflow-hidden rounded-full bg-surface-2">
            <div data-testid="usage-budget-bar" className={cn("h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none", warn ? "bg-warn" : "bg-accent")} style={{ width: `${Math.min(100, f * 100)}%` }} />
          </div>
          <p data-testid="usage-budget-text" className="mt-2 text-xs text-muted">
            {nf(s.monthSpent)} of {nf(budget)} credits used this month (UTC).{" "}
            {over ? "You are over your budget. It is only a reminder, nothing is blocked." : warn ? "Heads up: you have used over 80%." : ""}
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs text-muted">Optional. Set a monthly limit to get a gentle heads-up at 80%. Saved on this device only.</p>
      )}
    </Card>
  );
}
