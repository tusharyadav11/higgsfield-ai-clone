"use client";
import { useMemo } from "react";
import { StatusPill } from "../shared/StatusPill";
import { DemoBadge } from "../shared/DemoBadge";
import { Section } from "../shared/Section";
import { LocalTime } from "../shared/LocalTime";
import { prng, hash } from "@/lib/enterprise/demo-data";

const DAYS = 14;
const BASE = Date.parse("2026-10-10T00:00:00.000Z");

/** Deterministic sample: fictional request counts per day. Never real traffic. */
function sampleDays() {
  const r = prng(hash("dev-usage-sample"));
  return Array.from({ length: DAYS }, (_, i) => ({ date: new Date(BASE + i * 86_400_000).toISOString().slice(0, 10), calls: Math.round(40 + r() * 160) }));
}
const SAMPLE_LOGS = [
  { at: "2026-10-23T09:14:02.000Z", method: "POST", path: "/api/mcp  tools/call generate_image", status: 200, ms: 1840 },
  { at: "2026-10-23T09:12:47.000Z", method: "POST", path: "/api/mcp  tools/list", status: 200, ms: 38 },
  { at: "2026-10-23T08:58:11.000Z", method: "POST", path: "/api/mcp  tools/call generate_video", status: 402, ms: 52 },
  { at: "2026-10-22T17:03:30.000Z", method: "POST", path: "/api/mcp  tools/call search_community", status: 200, ms: 91 },
  { at: "2026-10-22T16:40:09.000Z", method: "POST", path: "/api/mcp  tools/call generate_image", status: 429, ms: 12 },
];

export function UsageSection() {
  const days = useMemo(() => sampleDays(), []);
  const max = Math.max(...days.map((d) => d.calls));
  const W = 560;
  const H = 140;
  const bw = W / DAYS;
  return (
    <>
      <Section id="usage" title="API usage statistics" pills={<StatusPill status="not-enabled" label="Not enabled" />} description="Usage stats need request logging that is not enabled. Credit spend is tracked in the ledger, but it is not attributed per API key, so no real per-key count can be shown.">
        <div className="mb-2 flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">Sample chart: requests per day</h3><DemoBadge /></div>
        <figure data-testid="usage-sample-chart" className="rounded-xl border border-dashed border-line p-3">
          <svg viewBox={`0 0 ${W} ${H + 22}`} role="img" aria-label={`Sample chart of fictional daily API requests over ${DAYS} days, from ${Math.min(...days.map((d) => d.calls))} to ${max}. Demo data, not real traffic.`} className="h-auto w-full">
            {[0.25, 0.5, 0.75, 1].map((g) => <line key={g} x1="0" x2={W} y1={H - g * H} y2={H - g * H} stroke="var(--line)" strokeWidth="1" strokeDasharray="3 4" />)}
            {days.map((d, i) => {
              const h = (d.calls / max) * (H - 8);
              return <rect key={d.date} x={i * bw + 6} y={H - h} width={bw - 12} height={h} rx="4" fill="var(--accent)" opacity="0.85" />;
            })}
            {days.map((d, i) => (i % 3 === 0 ? <text key={d.date} x={i * bw + bw / 2} y={H + 16} textAnchor="middle" fontSize="11" fill="var(--muted)">{d.date.slice(5)}</text> : null))}
          </svg>
          <figcaption className="mt-1 text-xs text-muted">Demo data: fictional numbers generated locally. Peak {max} requests/day.</figcaption>
        </figure>
      </Section>
      <Section id="logs" title="Request logs" pills={<StatusPill status="not-enabled" label="Not enabled" />} description="Request logging is not enabled, so there are no real logs to show. The table below only illustrates the layout.">
        <div className="mb-2"><DemoBadge label="Demo data: sample rows" /></div>
        <div className="-mx-1 overflow-x-auto px-1">
          <table data-testid="sample-logs" className="w-full min-w-[34rem] border-collapse text-sm">
            <caption className="sr-only">Sample request log rows (demo data)</caption>
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted"><th scope="col" className="py-2 pr-3 font-medium">Time</th><th scope="col" className="px-2 py-2 font-medium">Request</th><th scope="col" className="px-2 py-2 font-medium">Status</th><th scope="col" className="px-2 py-2 text-right font-medium">Latency</th></tr></thead>
            <tbody>
              {SAMPLE_LOGS.map((l) => (
                <tr key={l.at} className="border-b border-line/60 last:border-0">
                  <td className="whitespace-nowrap py-2 pr-3 text-xs text-muted"><LocalTime iso={l.at} /></td>
                  <td className="px-2 py-2 font-mono text-xs"><span className="text-muted">{l.method}</span> {l.path}</td>
                  <td className="px-2 py-2 tabular-nums">{l.status}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted">{l.ms} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
