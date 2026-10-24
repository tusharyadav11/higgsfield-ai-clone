"use client";
import { useMemo, useState } from "react";
import { Download, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { showToast } from "@/components/ui/Toast";
import { StatusPill } from "../shared/StatusPill";
import { Section } from "../shared/Section";
import { LocalTime } from "../shared/LocalTime";
import { fieldCls } from "../shared/ui";
import { AUDIT_DISCLAIMER, auditToCsv, clearAudit, filterAudit, recordActing, useAuditEvents } from "@/lib/enterprise/audit";
import Link from "next/link";

const PAGE = 50;

export function AuditSection() {
  const events = useAuditEvents();
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [confirm, setConfirm] = useState(false);

  const actions = useMemo(() => [...new Set(events.map((e) => e.action))].sort(), [events]);
  const actors = useMemo(() => [...new Set(events.map((e) => e.actor))].sort(), [events]);
  const list = useMemo(() => filterAudit(events, { q, action, actor }), [events, q, action, actor]);

  const exportCsv = () => {
    const blob = new Blob([auditToCsv(list)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kinetic-demo-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    recordActing({ action: "audit.exported", target: "Demo audit log", detail: `${list.length} events as CSV` });
    showToast(`Exported ${list.length} demo event${list.length === 1 ? "" : "s"} as CSV.`);
  };

  return (
    <Section
      id="audit"
      title="Audit log"
      pills={<StatusPill status="demo" label="Local demo log" />}
      description={
        <>
          Events are recorded in this browser when you act in the workspace UI (projects, SSO draft, domains, API keys, webhooks, sessions). <strong className="text-fg">{AUDIT_DISCLAIMER}</strong> There is no audit-log backend.
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="relative min-w-0 flex-1 basis-48">
          <label htmlFor="audit-q" className="sr-only">Search audit events</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input id="audit-q" data-testid="audit-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events" className={`${fieldCls} pl-9`} />
        </div>
        <div>
          <label htmlFor="audit-action" className="sr-only">Filter by action</label>
          <select id="audit-action" data-testid="audit-action" value={action} onChange={(e) => setAction(e.target.value)} className={`${fieldCls} w-auto max-w-52`}>
            <option value="">All actions</option>
            {actions.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="audit-actor" className="sr-only">Filter by actor</label>
          <select id="audit-actor" value={actor} onChange={(e) => setActor(e.target.value)} className={`${fieldCls} w-auto`}>
            <option value="">All actors</option>
            {actors.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
        <Button variant="secondary" data-testid="audit-export" disabled={!list.length} onClick={exportCsv} title={list.length ? undefined : "Nothing to export yet"}>
          <Download className="size-4" aria-hidden /> Export CSV
        </Button>
        <Button variant="ghost" data-testid="audit-clear" disabled={!events.length} onClick={() => setConfirm(true)}>
          <Trash2 className="size-4" aria-hidden /> Clear
        </Button>
      </div>
      {!list.length && <p className="mb-2 text-xs text-muted">Export is disabled because there are no matching events.</p>}

      {events.length === 0 ? (
        <div data-testid="audit-empty" className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
          No events yet. Approve a project in <Link href="/enterprise/workspace/projects" className="text-accent-text underline">Projects</Link>, invite someone in <Link href="/enterprise/workspace/team" className="text-accent-text underline">Team</Link>, or save the organization profile above, and it will appear here.
        </div>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <table data-testid="audit-table" className="w-full min-w-[38rem] border-collapse text-sm">
            <caption className="sr-only">Local demo audit events, newest first</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="py-2 pr-3 font-medium">Time</th>
                <th scope="col" className="px-2 py-2 font-medium">Actor</th>
                <th scope="col" className="px-2 py-2 font-medium">Action</th>
                <th scope="col" className="px-2 py-2 font-medium">Target</th>
                <th scope="col" className="px-2 py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, limit).map((e) => (
                <tr key={e.id} data-testid="audit-row" className="border-b border-line/60 align-top last:border-0">
                  <td className="whitespace-nowrap py-2 pr-3 text-xs text-muted"><LocalTime iso={e.at} /></td>
                  <td className="px-2 py-2">{e.actor} <span className="text-xs text-muted">({e.role})</span></td>
                  <td className="px-2 py-2 font-mono text-xs">{e.action}</td>
                  <td className="max-w-48 break-words px-2 py-2">{e.target}</td>
                  <td className="max-w-56 break-words px-2 py-2 text-muted">{e.detail ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <p className="p-4 text-center text-sm text-muted">No events match these filters.</p>}
          {list.length > limit && <div className="py-3 text-center"><Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>Show more ({list.length - limit} left)</Button></div>}
        </div>
      )}
      <p className="mt-2 text-xs text-muted" role="status">{list.length} of {events.length} event{events.length === 1 ? "" : "s"} shown.</p>

      <ConfirmDialog open={confirm} title="Clear the local demo log?" confirmLabel="Clear log" onCancel={() => setConfirm(false)} onConfirm={() => { clearAudit(); setConfirm(false); showToast("Local demo log cleared."); }}>
        <p>This deletes every event recorded in this browser. There is no server copy, so it cannot be undone.</p>
      </ConfirmDialog>
    </Section>
  );
}
