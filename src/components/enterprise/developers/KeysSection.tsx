"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, KeyRound, Plug, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { showToast } from "@/components/ui/Toast";
import { StatusPill } from "../shared/StatusPill";
import { Section } from "../shared/Section";
import { LocalTime, useMounted } from "../shared/LocalTime";
import { errCls, linkCls } from "../shared/ui";
import { api } from "@/lib/server-sync";
import { useStore } from "@/lib/store";
import { useServerInfo } from "@/lib/server-info";
import { recordActing } from "@/lib/enterprise/audit";

type K = { id: string; prefix: string; createdAt: string };
const MAX_KEYS = 5;

export function KeysSection() {
  const mounted = useMounted();
  const server = useStore((s) => !!s.user?.server);
  const db = useServerInfo((s) => s.db);
  const [keys, setKeys] = useState<K[] | null>(null);
  const [fresh, setFresh] = useState<{ key: string; id: string } | null>(null); // plaintext: memory only, never persisted
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [ask, setAsk] = useState<K | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api<{ keys?: K[] }>("/api/me");
    setKeys(r.data.keys ?? []);
  }, []);

  useEffect(() => {
    if (!mounted || !server) return;
    let live = true;
    void api<{ keys?: K[] }>("/api/me").then((r) => live && setKeys(r.data.keys ?? []));
    return () => {
      live = false;
    };
  }, [mounted, server]);

  const create = async () => {
    setErr("");
    setBusy(true);
    const r = await api<{ key: string; id: string; prefix: string; createdAt: string }>("/api/me/keys", "POST");
    setBusy(false);
    if (!r.ok) return setErr(r.data.error ?? "Could not create a key.");
    setFresh({ key: r.data.key, id: r.data.id });
    setKeys((k) => [{ id: r.data.id, prefix: r.data.prefix, createdAt: r.data.createdAt }, ...(k ?? [])]);
    recordActing({ action: "api_key.created", target: r.data.prefix + "…" });
  };

  const revoke = async () => {
    if (!ask) return;
    const k = ask;
    setAsk(null);
    const r = await api(`/api/me/keys/${k.id}`, "DELETE");
    if (!r.ok && r.status !== 404) return setErr("Could not revoke the key.");
    setKeys((x) => (x ?? []).filter((y) => y.id !== k.id));
    if (fresh?.id === k.id) setFresh(null);
    recordActing({ action: "api_key.revoked", target: k.prefix + "…" });
    showToast(`Revoked ${k.prefix}…. It stops working immediately.`);
    void load();
  };

  const copy = async () => {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast("Copy failed. Select the key and copy it manually.");
    }
  };

  return (
    <Section id="keys" title="API keys" pills={<StatusPill status={server ? "active" : "not-configured"} label={server ? "Active (real)" : "Sign in required"} />} description="Real keys for the Kinetic MCP server. A key acts on your account and spends your credits. Only a short prefix is stored for display; the full key is shown once.">
      {!mounted ? (
        <div className="h-20 animate-pulse rounded-xl bg-surface-2" />
      ) : !server ? (
        <div data-testid="keys-guest" className="rounded-xl border border-dashed border-line p-5 text-sm">
          <p className="font-medium">Sign in to create API keys</p>
          <p className="mt-1 text-muted">{db === false ? "Accounts need a database, which this deployment does not have (local demo mode). Demo MCP keys are available on the Connect page." : "Keys belong to a real account so they can be revoked and billed to you."}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/login" className={`${linkCls} inline-flex min-h-11 items-center`}>Log in</Link>
            <Link href="/signup" className={`${linkCls} inline-flex min-h-11 items-center`}>Create an account</Link>
            <Link href="/connect" className={`${linkCls} inline-flex min-h-11 items-center`}>Connect page</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button data-testid="create-key" onClick={() => void create()} disabled={busy || (keys?.length ?? 0) >= MAX_KEYS}><Plus className="size-4" aria-hidden /> Create API key</Button>
            <Link href="/connect" data-testid="goto-connect" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm hover:border-accent"><Plug className="size-4" aria-hidden /> One-click MCP setup</Link>
            {(keys?.length ?? 0) >= MAX_KEYS && <span className="text-xs text-muted">Limit of {MAX_KEYS} active keys reached. Revoke one to create another.</span>}
          </div>
          {err && <p role="alert" data-testid="key-error" className={errCls}>{err}</p>}
          {fresh && (
            <div role="status" data-testid="new-key-box" className="mb-3 rounded-xl border border-accent bg-surface-2 p-3">
              <p className="text-sm font-semibold">Copy your new key now. You will not see it again.</p>
              <p className="mt-0.5 text-xs text-muted">It is held in this page&apos;s memory only; we never store the full key in your browser or show it again.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code data-testid="new-key" className="min-w-0 flex-1 basis-60 select-all break-all rounded-lg bg-bg px-3 py-2.5 font-mono text-xs">{fresh.key}</code>
                <Button data-testid="copy-key" onClick={() => void copy()}>{copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied ? "Copied" : "Copy"}</Button>
                <Button variant="secondary" data-testid="dismiss-key" onClick={() => setFresh(null)}>I have saved it</Button>
              </div>
            </div>
          )}
          {keys === null ? (
            <div className="h-16 animate-pulse rounded-xl bg-surface-2" aria-busy="true" />
          ) : (
            <ul data-testid="key-list" className="divide-y divide-line rounded-xl border border-line">
              {keys.map((k) => (
                <li key={k.id} data-testid="key-row" className="flex flex-wrap items-center gap-3 p-3">
                  <KeyRound className="size-5 shrink-0 text-muted" aria-hidden />
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="font-mono text-sm">{k.prefix}…</p>
                    <p className="text-xs text-muted">Created <LocalTime iso={k.createdAt} /></p>
                  </div>
                  <Button variant="secondary" data-testid="revoke-key" aria-label={`Revoke key ${k.prefix}`} onClick={() => setAsk(k)}><Trash2 className="size-4" aria-hidden /> Revoke</Button>
                </li>
              ))}
              {keys.length === 0 && <li data-testid="keys-empty" className="p-4 text-sm text-muted">No keys yet. Create one to connect an agent.</li>}
            </ul>
          )}
        </>
      )}
      <ConfirmDialog open={!!ask} title="Revoke this API key?" confirmLabel="Revoke key" onCancel={() => setAsk(null)} onConfirm={() => void revoke()}>
        <p>Any agent using <code className="font-mono">{ask?.prefix}…</code> stops working immediately. This changes your real account and cannot be undone; you would create a new key to reconnect.</p>
      </ConfirmDialog>
    </Section>
  );
}
