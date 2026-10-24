"use client";
import { useState } from "react";
import { Check, Copy, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { showToast } from "@/components/ui/Toast";
import { StatusPill } from "../shared/StatusPill";
import { DemoBadge } from "../shared/DemoBadge";
import { Section } from "../shared/Section";
import { errCls, fieldCls, hintCls, labelCls } from "../shared/ui";
import { recordActing } from "@/lib/enterprise/audit";
import {
  MAX_ENDPOINTS, WEBHOOK_EVENTS, buildTestEvent, generateSecret, secretPreview, sessionSecrets, signPayload, useWebhooks, validateEndpoint, type Endpoint, type WebhookEventId,
} from "@/lib/enterprise/webhooks";

const DEMO_NOTE = "Demo: events are not delivered, no secret is registered with any server.";

export function WebhooksSection() {
  const endpoints = useWebhooks((s) => s.endpoints);
  const add = useWebhooks((s) => s.add);
  const remove = useWebhooks((s) => s.remove);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEventId[]>(["generation.completed"]);
  const [errs, setErrs] = useState<{ url?: string; events?: string }>({});
  const [secret, setSecret] = useState<{ id: string; value: string } | null>(null); // shown once
  const [copied, setCopied] = useState(false);
  const [del, setDel] = useState<Endpoint | null>(null);
  const [test, setTest] = useState<{ id: string; body: string; header: string; throwaway: boolean; type: string } | null>(null);
  const [seq, setSeq] = useState(1);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = validateEndpoint(url);
    const ev = events.length ? undefined : "Choose at least one event.";
    const full = endpoints.length >= MAX_ENDPOINTS ? `Demo limit: ${MAX_ENDPOINTS} endpoints. Remove one first.` : undefined;
    setErrs({ url: u ?? full ?? undefined, events: ev });
    if (u || ev || full) return;
    const value = generateSecret();
    const id = `wh-${endpoints.length + 1}-${Date.now().toString(36)}`;
    sessionSecrets.set(id, value);
    add({ id, url: url.trim(), events, createdAt: new Date().toISOString(), secretPreview: secretPreview(value) });
    setSecret({ id, value });
    setCopied(false);
    setUrl("");
    recordActing({ action: "webhook.endpoint_added_demo", target: url.trim(), detail: `${events.length} events, not delivered` });
  };

  const sendTest = async (ep: Endpoint) => {
    const type = ep.events[0] ?? "generation.completed";
    const now = Math.floor(new Date().getTime() / 1000);
    const body = JSON.stringify(buildTestEvent(type, now, seq));
    setSeq((n) => n + 1);
    let s = sessionSecrets.get(ep.id);
    const throwaway = !s;
    s ??= generateSecret();
    const sig = await signPayload(s, now, body);
    setTest({ id: ep.id, body, header: sig.header, throwaway, type });
  };

  return (
    <Section id="webhooks" title="Webhooks" pills={<><StatusPill status="needs-integration" label="Needs integration" /><DemoBadge label="Demo" /></>} description={DEMO_NOTE + " Configure an endpoint and inspect exactly what a signed test event would look like."}>
      <form onSubmit={submit} noValidate className="space-y-3">
        <div>
          <label htmlFor="wh-url" className={labelCls}>Endpoint URL (https only)</label>
          <input id="wh-url" data-testid="wh-url" inputMode="url" autoCapitalize="none" spellCheck={false} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/webhooks/kinetic" aria-invalid={!!errs.url} className={fieldCls} />
          {errs.url && <p role="alert" data-testid="wh-url-error" className={errCls}>{errs.url}</p>}
        </div>
        <fieldset>
          <legend className={labelCls}>Events</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {WEBHOOK_EVENTS.map((e) => (
              <label key={e.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-surface-2">
                <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={events.includes(e.id)} onChange={(ev) => setEvents((x) => (ev.target.checked ? [...x, e.id] : x.filter((y) => y !== e.id)))} />
                <span>{e.label}</span><code className="ml-auto text-xs text-muted">{e.id}</code>
              </label>
            ))}
          </div>
          {errs.events && <p role="alert" className={errCls}>{errs.events}</p>}
        </fieldset>
        <Button type="submit" data-testid="wh-add"><Plus className="size-4" aria-hidden /> Add endpoint</Button>
      </form>

      {secret && (
        <div role="status" data-testid="wh-secret-box" className="mt-4 rounded-xl border border-accent bg-surface-2 p-3">
          <p className="text-sm font-semibold">Signing secret (shown once)</p>
          <p className="mt-0.5 text-xs text-muted" data-testid="wh-demo-note">{DEMO_NOTE} It was generated in your browser with crypto.getRandomValues; only a preview is kept.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code data-testid="wh-secret" className="min-w-0 flex-1 basis-60 select-all break-all rounded-lg bg-bg px-3 py-2.5 font-mono text-xs">{secret.value}</code>
            <Button variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(secret.value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { showToast("Copy failed. Select the secret manually."); } }}>{copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied ? "Copied" : "Copy"}</Button>
            <Button variant="secondary" data-testid="wh-secret-dismiss" onClick={() => setSecret(null)}>Hide</Button>
          </div>
        </div>
      )}

      <h3 className="mb-2 mt-5 text-sm font-semibold">Endpoints <span className="font-normal text-muted">({endpoints.length}/{MAX_ENDPOINTS}, saved in this browser)</span></h3>
      {endpoints.length === 0 ? (
        <p data-testid="wh-empty" className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-muted">No endpoints configured.</p>
      ) : (
        <ul data-testid="wh-list" className="space-y-3">
          {endpoints.map((ep) => (
            <li key={ep.id} data-testid="wh-row" className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 break-all font-mono text-sm">{ep.url}</span>
                <StatusPill status="needs-integration" label="Not delivered" />
              </div>
              <p className="mt-1 text-xs text-muted">Secret <code className="font-mono">{ep.secretPreview}</code> · {ep.events.length} event{ep.events.length === 1 ? "" : "s"}: {ep.events.join(", ")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="secondary" data-testid="wh-test" onClick={() => void sendTest(ep)}><Send className="size-4" aria-hidden /> Send test event</Button>
                <Button variant="ghost" data-testid="wh-remove" aria-label={`Remove endpoint ${ep.url}`} onClick={() => setDel(ep)}><Trash2 className="size-4" aria-hidden /> Remove</Button>
              </div>
              {test?.id === ep.id && (
                <div data-testid="wh-test-result" className="mt-3 rounded-lg bg-bg p-3 text-xs">
                  <p className="font-semibold text-fg" data-testid="wh-not-sent">Not sent anywhere. This is the request we would send for <code>{test.type}</code>.</p>
                  {test.throwaway && <p className="mt-1 text-muted">Signed with a throwaway demo secret: the real secret was shown once and is not stored.</p>}
                  <p className="mt-2 text-muted">Header</p>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-fg" data-testid="wh-signature">Kinetic-Signature: {test.header}</pre>
                  <p className="mt-2 text-muted">Body</p>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-fg" data-testid="wh-payload">{JSON.stringify(JSON.parse(test.body), null, 2)}</pre>
                  <p className={hintCls}>Signature = HMAC-SHA256(secret, &quot;timestamp.body&quot;), hex-encoded.</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={!!del} title="Remove this endpoint?" confirmLabel="Remove endpoint" onCancel={() => setDel(null)} onConfirm={() => { if (del) { remove(del.id); sessionSecrets.delete(del.id); recordActing({ action: "webhook.endpoint_removed_demo", target: del.url }); } setDel(null); setTest(null); showToast("Endpoint removed from this demo workspace."); }}>
        <p>This deletes the endpoint configuration saved in this browser. Nothing was ever registered with a server, so nothing else changes.</p>
      </ConfirmDialog>
    </Section>
  );
}
