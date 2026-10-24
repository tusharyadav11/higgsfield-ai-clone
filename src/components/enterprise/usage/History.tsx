"use client";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { SAMPLE_PROJECTS, SAMPLE_TOOLS, type UsageEntry } from "@/lib/enterprise/demo-data";
import { DemoBadge } from "../DemoBadge";

const PAGE = 10;
const sel = "min-h-11 min-w-0 rounded-xl border border-line bg-surface px-2 text-sm focus:border-accent focus:outline-none";

export function History({ entries, memberOptions, nameOf, projectName }: { entries: UsageEntry[]; memberOptions: [string, string][]; nameOf: (id: string) => { label: string; former: boolean }; projectName: (id: string) => string }) {
  const [member, setMember] = useState("all");
  const [project, setProject] = useState("all");
  const [tool, setTool] = useState("all");
  const [pageRaw, setPage] = useState(0);
  const rows = useMemo(
    () => entries.filter((e) => (member === "all" || e.memberId === member) && (project === "all" || e.projectId === project) && (tool === "all" || e.tool === tool)).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? -1 : 1)),
    [entries, member, project, tool],
  );
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const page = Math.min(pageRaw, pages - 1);
  const slice = rows.slice(page * PAGE, page * PAGE + PAGE);
  const reset = <T,>(f: (v: T) => void) => (v: T) => (f(v), setPage(0));

  return (
    <Card data-testid="usage-history" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">Consumption history <DemoBadge /></h3>
        <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto">
          <select aria-label="Filter by member" data-testid="history-member" className={sel} value={member} onChange={(e) => reset(setMember)(e.target.value)}>
            <option value="all">All members</option>{memberOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select aria-label="Filter by project" data-testid="history-project" className={sel} value={project} onChange={(e) => reset(setProject)(e.target.value)}>
            <option value="all">All projects</option>{SAMPLE_PROJECTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select aria-label="Filter by tool" data-testid="history-tool" className={sel} value={tool} onChange={(e) => reset(setTool)(e.target.value)}>
            <option value="all">All tools</option>{SAMPLE_TOOLS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      {!rows.length ? (
        <p data-testid="history-empty" className="py-6 text-center text-sm text-muted">No entries match these filters in this period.</p>
      ) : (
        <>
          <div aria-hidden className="hidden grid-cols-[6.5rem_minmax(0,1.2fr)_minmax(0,1.4fr)_5rem_5rem] gap-3 px-3 text-xs text-muted md:grid"><span>Date</span><span>Member</span><span>Project</span><span>Tool</span><span className="text-right">Credits</span></div>
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
            {slice.map((e) => {
              const who = nameOf(e.memberId);
              return (
                <li key={e.id} data-testid="usage-history-row" className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 px-3 py-2.5 text-sm md:grid-cols-[6.5rem_minmax(0,1.2fr)_minmax(0,1.4fr)_5rem_5rem] md:items-center">
                  <span className="tabular-nums text-muted md:order-none">{e.date}</span>
                  <span className="text-right font-semibold tabular-nums md:order-last">{e.credits.toLocaleString("en")}</span>
                  <span className="col-span-2 min-w-0 truncate md:col-span-1">{who.label}{who.former && <span className="ml-1.5 rounded-full border border-line px-1.5 py-px text-[10px] text-muted">Former member</span>}</span>
                  <span className="col-span-2 min-w-0 truncate text-muted md:col-span-1">{projectName(e.projectId)}</span>
                  <span className="col-span-2 text-xs text-muted md:col-span-1 md:text-sm">{e.tool}</span>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between gap-2 text-sm text-muted">
            <span aria-live="polite" data-testid="history-page">Page {page + 1} of {pages} · {rows.length.toLocaleString("en")} entries</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="icon" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="size-5" aria-hidden /></Button>
              <Button variant="secondary" size="icon" aria-label="Next page" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="size-5" aria-hidden /></Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
