"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Download, Lock, OctagonAlert } from "lucide-react";
import { Button, Card, CountUp, Skeleton } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { useNow } from "@/components/growth/hooks";
import { useEntered } from "@/components/usage/hooks";
import { CREDITS_PER_SEAT } from "@/lib/plans";
import { can } from "@/lib/enterprise/roles";
import { useTeam } from "@/lib/enterprise/team-store";
import { aggregate, dayKey, generateUsage, groupBy, inWindow, monthStartKey, poolFor, projectRunOut, RANGE_META, SAMPLE_MEMBERS, SAMPLE_PROJECTS, scaleForPct, severityOf, sumCredits, USAGE_MEMBERS, windowOf, type RangeId, type Severity } from "@/lib/enterprise/demo-data";
import { DemoBadge } from "../DemoBadge";
import { useTeamReady } from "../team/hooks";
import { Breakdown } from "./Breakdown";
import { History } from "./History";
import { LiveAccount } from "./LiveAccount";
import { WsChart } from "./WsChart";

const nf = (n: number) => n.toLocaleString("en");
const RANGE_IDS: RangeId[] = ["daily", "weekly", "monthly"];
const fmtDate = (key: string) => new Date(key + "T00:00:00Z").toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
const csvCell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

export function UsageView() {
  const ready = useTeamReady();
  const now = useNow(60_000);
  if (!ready || !now) return <Loading />;
  return <Loaded now={now} />;
}

function Loading() {
  return (
    <div aria-busy data-testid="usage-loading" className="flex flex-col gap-4">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      <Skeleton className="h-72" />
    </div>
  );
}

const SEV: Record<Severity, { color: string; bar: string; border: string }> = {
  ok: { color: "text-success", bar: "var(--success)", border: "border-line" },
  warn: { color: "text-warn", bar: "var(--warn)", border: "border-warn/50" },
  high: { color: "text-danger", bar: "var(--danger)", border: "border-danger-line" },
  full: { color: "text-danger", bar: "var(--danger)", border: "border-danger-line" },
};

function Loaded({ now }: { now: number }) {
  const members = useTeam((s) => s.members);
  const seats = useTeam((s) => s.seats);
  const usagePct = useTeam((s) => s.usagePct);
  const actingAs = useTeam((s) => s.actingAs);
  const [range, setRange] = useState<RangeId>("daily");
  const entered = useEntered();
  const dayNow = Math.floor(now / 86_400_000);

  const entries = useMemo(() => {
    const t = dayNow * 86_400_000;
    return generateUsage(t, usagePct === null ? 1 : scaleForPct(t, usagePct, seats));
  }, [dayNow, usagePct, seats]);

  // KPIs: current billing month (UTC) against the pool
  const pool = poolFor(seats);
  const consumed = useMemo(() => sumCredits(inWindow(entries, monthStartKey(now), dayKey(now))), [entries, now]);
  const remaining = Math.max(0, pool - consumed);
  const pct = pool ? (consumed / pool) * 100 : 0;
  const sev = severityOf(pct);
  const runOut = useMemo(() => projectRunOut(entries, remaining, now), [entries, remaining, now]);
  const monthEnd = (() => { const d = new Date(now); return dayKey(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)); })();

  // Selected range
  const win = windowOf(range, now);
  const inRange = useMemo(() => inWindow(entries, win.from, win.to), [entries, win.from, win.to]);
  const buckets = useMemo(() => aggregate(entries, range, now), [entries, range, now]);
  const total = sumCredits(inRange);

  const nameOf = (id: string) => {
    const m = members.find((x) => x.id === id);
    if (m) return { label: m.name, former: false };
    return { label: SAMPLE_MEMBERS.find((x) => x.id === id)?.name ?? "Unknown", former: true };
  };
  const projectName = (id: string) => SAMPLE_PROJECTS.find((p) => p.id === id)?.name ?? id;
  const memberRows = groupBy(inRange, "memberId").map((g) => ({ ...g, label: nameOf(g.id).label, former: nameOf(g.id).former }));
  const projectRows = groupBy(inRange, "projectId").map((g) => ({ ...g, label: projectName(g.id) }));
  const memberOptions = USAGE_MEMBERS.map((m) => [m.id, nameOf(m.id).label + (nameOf(m.id).former ? " (former)" : "")] as [string, string]);
  const canExport = can(actingAs, "export_usage");

  const exportCsv = () => {
    const rows: (string | number)[][] = [["period_from", "period_to", "credits"], ...buckets.map((b) => [b.from, b.to, b.credits])];
    rows.push([], ["member", "former_member", "credits", "runs"], ...memberRows.map((r) => [r.label, r.former ? "yes" : "no", r.credits, r.count]));
    rows.push([], ["project", "credits", "runs"], ...projectRows.map((r) => [r.label, r.credits, r.count]));
    rows.unshift(["# Demo data: sample figures generated in this browser, not real usage"]);
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n"], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `workspace-usage-demo-${range}-${win.to}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">Credit usage <DemoBadge /></h2>
          <p className="mt-1 max-w-xl text-sm text-muted">Workspace pool = {nf(seats)} seats × {nf(CREDITS_PER_SEAT)} credits. Figures are generated sample data; days are counted in UTC.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Date range" className="flex rounded-full border border-line bg-surface p-1">
            {RANGE_IDS.map((r) => (
              <button key={r} role="tab" type="button" aria-selected={range === r} data-testid={`usage-range-${r}`} title={RANGE_META[r].hint} onClick={() => setRange(r)} className={cn("min-h-11 rounded-full px-3.5 text-sm font-medium transition-colors", range === r ? "bg-accent text-accent-fg" : "text-muted hover:text-fg")}>
                {RANGE_META[r].label}
              </button>
            ))}
          </div>
          <Button variant="secondary" data-testid="usage-export" disabled={!canExport} title={canExport ? undefined : "Only Owners and Admins can export"} onClick={exportCsv}>
            {canExport ? <Download className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />} <span className="max-sm:sr-only">Export CSV</span>
          </Button>
        </div>
      </header>

      {sev !== "ok" && <Banner sev={sev} pct={pct} remaining={remaining} />}

      <section aria-label="Workspace pool this month" className="flex flex-col gap-3">
        <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted">Workspace (demo data) · this billing month <DemoBadge /></h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi id="pool" label="Total pool" value={pool} sub={`${nf(seats)} seats × ${nf(CREDITS_PER_SEAT)}`} />
          <Kpi id="consumed" label="Consumed" value={consumed} sub={`since ${fmtDate(monthStartKey(now))}`} />
          <Kpi id="remaining" label="Remaining" value={remaining} sub={pct >= 100 ? "Pool exhausted" : `${nf(remaining)} credits left`} tone={SEV[sev].color} />
          <Card data-testid="usage-kpi-percent" data-severity={sev} className={cn("flex flex-col justify-between gap-2 transition-colors", SEV[sev].border)}>
            <p className="text-xs text-muted">Used</p>
            <p className={cn("text-2xl font-semibold tabular-nums sm:text-3xl", SEV[sev].color)}><span data-testid="usage-percent-value">{Math.round(pct)}</span>%</p>
            <div role="progressbar" aria-label="Pool used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(pct))} className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out" style={{ width: `${entered ? Math.min(100, pct) : 0}%`, background: SEV[sev].bar }} />
            </div>
          </Card>
        </div>
        <p data-testid="usage-runout" className="flex items-start gap-2 text-sm text-muted">
          <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
          {remaining <= 0 ? "The pool is exhausted for this billing month." : runOut ? (runOut.date <= monthEnd ? <span>At the trailing 7-day pace, the pool runs out around <b className="text-fg">{fmtDate(runOut.date)}</b> (in {runOut.days} day{runOut.days === 1 ? "" : "s"}), before the month ends.</span> : <span>At the trailing 7-day pace, the pool lasts beyond this billing month.</span>) : "Not enough recent activity to project a run-out date."}
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">Consumption · {RANGE_META[range].hint} <DemoBadge /></h3>
            <p className="text-xs text-muted" data-testid="usage-range-total">{nf(total)} credits in period</p>
          </div>
          <WsChart key={range} range={range} buckets={buckets} />
        </Card>
        <LiveAccount />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown testid="usage-by-member" title="By member" unitLabel="Member" rows={memberRows} total={total} />
        <Breakdown testid="usage-by-project" title="By project" unitLabel="Project" rows={projectRows} total={total} />
      </div>

      <History entries={inRange} memberOptions={memberOptions} nameOf={nameOf} projectName={projectName} />
      <p className="text-xs text-muted">Removed members keep their historical usage, labelled “Former member”. Everything on this page except “Your account (live data)” is sample data generated in this browser.</p>
    </div>
  );
}

function Kpi({ id, label, value, sub, tone }: { id: string; label: string; value: number; sub: string; tone?: string }) {
  return (
    <Card data-testid={`usage-kpi-${id}`} data-value={value} className="flex flex-col gap-1">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("text-2xl font-semibold sm:text-3xl", tone)}><CountUp value={value} from={0} ms={700} /></p>
      <p className="text-xs text-muted">{sub}</p>
    </Card>
  );
}

function Banner({ sev, pct, remaining }: { sev: Severity; pct: number; remaining: number }) {
  const full = sev === "full";
  const Icon = full || sev === "high" ? OctagonAlert : AlertTriangle;
  const title = full ? "The credit pool is used up" : sev === "high" ? "Almost out of credits" : "Credits are running low";
  const body = full
    ? "No pooled credits remain this billing month. Add credits so the team can keep generating."
    : `${Math.round(pct)}% of the pool is consumed and ${nf(remaining)} credits remain. Add credits before the team hits the limit.`;
  return (
    <div role={full || sev === "high" ? "alert" : "status"} data-testid="usage-low-credit-banner" data-severity={sev} className={cn("flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center", full || sev === "high" ? "border-danger-line bg-danger-bg" : "border-warn/50 bg-warn/10")}>
      <Icon className={cn("size-6 shrink-0", full || sev === "high" ? "text-danger" : "text-warn")} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted">{body}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/enterprise/workspace/billing" data-testid="usage-cta-billing" className="inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg active:scale-95">Add credits in Billing</Link>
        <Link href="/enterprise#quote" data-testid="usage-cta-contact" className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold hover:border-accent active:scale-95">Contact us</Link>
      </div>
    </div>
  );
}
