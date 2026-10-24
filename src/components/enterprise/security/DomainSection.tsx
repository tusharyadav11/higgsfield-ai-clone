"use client";
import { useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";
import { StatusPill } from "../shared/StatusPill";
import { Section } from "../shared/Section";
import { LocalTime } from "../shared/LocalTime";
import { errCls, fieldCls } from "../shared/ui";
import { recordActing } from "@/lib/enterprise/audit";
import { dnsRecordFor, normalizeDomain, useSecurity } from "@/lib/enterprise/security";

export function DomainSection() {
  const domains = useSecurity((s) => s.domains);
  const slug = useSecurity((s) => s.org.slug);
  const add = useSecurity((s) => s.addDomain);
  const remove = useSecurity((s) => s.removeDomain);
  const check = useSecurity((s) => s.markChecked);
  const [v, setV] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState<Record<string, string>>({});

  const copy = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
      showToast("Copied.");
    } catch {
      showToast("Copy failed. Select the text manually.");
    }
  };

  return (
    <Section
      id="domains"
      title="Domain verification"
      pills={<StatusPill status="needs-integration" />}
      description="Shows the DNS TXT record you would add to prove domain ownership. No lookup service is connected, so no domain can be verified in this demo."
    >
      <form
        noValidate
        className="flex flex-wrap items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const r = add(v, new Date().toISOString());
          setErr(r ?? "");
          if (!r) {
            recordActing({ action: "domain.added_demo", target: normalizeDomain(v) });
            setV("");
          }
        }}
      >
        <div className="min-w-0 flex-1 basis-56">
          <label htmlFor="dom" className="sr-only">Domain</label>
          <input id="dom" data-testid="domain-input" value={v} onChange={(e) => setV(e.target.value)} placeholder="example.com" autoCapitalize="none" spellCheck={false} aria-invalid={!!err} aria-describedby={err ? "dom-e" : undefined} className={fieldCls} />
          {err && <p id="dom-e" role="alert" className={errCls}>{err}</p>}
        </div>
        <Button type="submit" data-testid="domain-add"><Plus className="size-4" aria-hidden /> Add domain</Button>
      </form>

      {domains.length === 0 ? (
        <p data-testid="domains-empty" className="mt-3 rounded-xl border border-dashed border-line p-5 text-center text-sm text-muted">No domains added yet.</p>
      ) : (
        <ul data-testid="domain-list" className="mt-3 space-y-3">
          {domains.map((d) => {
            const rec = dnsRecordFor(d.domain, slug);
            return (
              <li key={d.domain} data-testid="domain-row" className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 break-all font-medium">{d.domain}</span>
                  <StatusPill status="not-configured" label="Not verified" />
                  <button type="button" aria-label={`Remove ${d.domain}`} data-testid="domain-remove" onClick={() => { remove(d.domain); recordActing({ action: "domain.removed_demo", target: d.domain }); }} className="grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-danger">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted">Record you would add (demo token derived from your org slug and this domain; it is not registered anywhere):</p>
                <dl className="mt-1 grid gap-1 text-sm sm:grid-cols-[4rem_1fr]">
                  <dt className="text-muted">Type</dt><dd className="font-mono">{rec.type}</dd>
                  <dt className="text-muted">Host</dt><dd data-testid="dns-host" className="break-all font-mono">{rec.host}</dd>
                  <dt className="text-muted">Value</dt>
                  <dd className="flex items-start gap-2"><code data-testid="dns-value" className="min-w-0 flex-1 break-all font-mono">{rec.value}</code>
                    <button type="button" aria-label="Copy TXT value" onClick={() => void copy(rec.value)} className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"><Copy className="size-4" aria-hidden /></button></dd>
                </dl>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button variant="secondary" data-testid="dns-check" onClick={() => { check(d.domain, new Date().toISOString()); setMsg((m) => ({ ...m, [d.domain]: "Verification requires a DNS check service that is not connected. No lookup was made." })); }}>Check DNS</Button>
                  {(msg[d.domain] || d.lastCheckedAt) && (
                    <p role="status" data-testid="dns-check-msg" className="text-xs text-muted">
                      {msg[d.domain] ?? "Verification requires a DNS check service that is not connected. No lookup was made."} {d.lastCheckedAt && <>Last pressed <LocalTime iso={d.lastCheckedAt} />.</>}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
