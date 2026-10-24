"use client";

import { useState, useSyncExternalStore } from "react";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { useServerInfo } from "@/lib/server-info";
import { api } from "@/lib/server-sync";
import Link from "next/link";
import { Check, Copy, KeyRound, Loader2, Plug, RefreshCw, Trash2, XCircle } from "lucide-react";

const LS = "kinetic-mcp-key";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};
const readKey = () => {
  try {
    return localStorage.getItem(LS) ?? "";
  } catch {
    return "";
  }
};
const newKey = () => {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return "kn_" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
};
const writeKey = (k: string) => {
  try {
    if (k) localStorage.setItem(LS, k);
    else localStorage.removeItem(LS);
  } catch {
    /* storage blocked */
  }
  emit();
};
const noop = () => () => {};

type Tool = { name: string; description: string };
type TestState = { ok: boolean; ms: number; tools?: Tool[]; error?: string } | "running" | null;

const PROMPTS = [
  "Search Kinetic's community for cyberpunk prompts and show me the top 3.",
  "Generate a 16:9 image of a chrome whale over a neon city with Kinetic.",
  "Remix post <id> but make it golden hour, then generate a video from it.",
  "How many credits would 5 videos with Veo Lite cost on Kinetic?",
];

function CopyCard({ id, title, hint, text, extra }: { id: string; title: string; hint: string; text: string; extra?: React.ReactNode }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      /* clipboard blocked: text is selectable below */
    }
  };
  return (
    <section className="flex flex-col rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      <p className="mb-2 text-xs text-muted">{hint}</p>
      <pre className="max-h-40 min-h-16 flex-1 overflow-auto rounded-xl bg-bg p-3 text-xs text-fg whitespace-pre-wrap break-all select-all">{text}</pre>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid={`mcp-copy-${id}`}
          onClick={copy}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg"
        >
          {done ? <Check size={16} /> : <Copy size={16} />} {done ? "Copied" : "Copy"}
        </button>
        {extra}
      </div>
    </section>
  );
}

export function ConnectView() {
  const server = useStore((s) => !!s.user?.server);
  const serverDb = useServerInfo((s) => s.db);
  const localKey = useSyncExternalStore(subscribe, readKey, () => "");
  // server accounts: the plaintext exists only in memory, right after creation
  const [fresh, setFresh] = useState("");
  const [keys, setKeys] = useState<{ id: string; prefix: string }[]>([]);
  const [keyErr, setKeyErr] = useState("");
  const key = server ? fresh : localKey;
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const [test, setTest] = useState<TestState>(null);

  useEffect(() => {
    if (server) {
      let live = true;
      void api<{ keys?: { id: string; prefix: string }[] }>("/api/me").then((r) => live && setKeys(r.data.keys ?? []));
      return () => {
        live = false;
      };
    }
    if (!readKey()) writeKey(newKey());
  }, [server]);

  async function createServerKey() {
    setKeyErr("");
    const r = await api<{ key: string; id: string; prefix: string }>("/api/me/keys", "POST");
    if (!r.ok) return setKeyErr(r.data.error ?? "Could not create a key.");
    setFresh(r.data.key);
    setKeys((k) => [{ id: r.data.id, prefix: r.data.prefix }, ...k]);
    setTest(null);
  }
  async function revokeServerKey(id: string) {
    const r = await api(`/api/me/keys/${id}`, "DELETE");
    if (!r.ok && r.status !== 404) return setKeyErr("Could not revoke the key.");
    setKeys((k) => k.filter((x) => x.id !== id));
    setFresh("");
    setTest(null);
  }

  const url = `${origin || "https://<your-host>"}/api/mcp`;
  const k = key || (server ? "kn_<create-a-key-above>" : "kn_<creating>");
  const auth = `Bearer ${k}`;
  const remote = { url, headers: { Authorization: auth } };
  const cc = `claude mcp add --transport http kinetic ${url} --header "Authorization: ${auth}"`;
  const desktop = JSON.stringify({ mcpServers: { kinetic: { command: "npx", args: ["-y", "mcp-remote", url, "--header", `Authorization:${auth}`] } } }, null, 2);
  const cursor = JSON.stringify({ mcpServers: { kinetic: remote } }, null, 2);
  const vscode = JSON.stringify({ servers: { kinetic: { type: "http", ...remote } } }, null, 2);
  const curl = `curl -s ${url} \\\n  -H "Authorization: ${auth}" -H "Content-Type: application/json" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;
  const b64 = typeof btoa === "function" ? btoa(JSON.stringify(remote)) : "";
  const cursorLink = `cursor://anysphere.cursor-deeplink/mcp/install?name=kinetic&config=${encodeURIComponent(b64)}`;
  const vscodeLink = `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: "kinetic", type: "http", ...remote }))}`;
  const linkCls = "inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-fg hover:border-accent";

  const runTest = async () => {
    setTest("running");
    const t0 = performance.now();
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });
      const data = await res.json();
      const ms = Math.round(performance.now() - t0);
      if (data?.error) setTest({ ok: false, ms, error: data.error.message });
      else setTest({ ok: true, ms, tools: data.result.tools });
    } catch (e) {
      setTest({ ok: false, ms: Math.round(performance.now() - t0), error: e instanceof Error ? e.message : "Request failed" });
    }
  };

  return (
    <>
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-fg"><Plug className="text-accent" size={22} /> Connect your agent</h1>
        <p className="mt-1 text-sm text-muted">Let Claude, Cursor or any MCP client search the community and generate with Kinetic. Pick your client, copy, paste.</p>
      </header>

      {server ? (
        <section data-testid="mcp-server-keys" className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <KeyRound size={16} className="text-accent" aria-hidden />
            <h2 className="flex-1 text-sm font-semibold text-fg">Your API keys</h2>
            <button type="button" data-testid="mcp-create" onClick={createServerKey} className={linkCls}>Create key</button>
          </div>
          {fresh && (
            <div className="mt-3 rounded-xl bg-bg p-3">
              <code data-testid="mcp-key" className="block break-all text-sm text-fg select-all">{fresh}</code>
              <p className="mt-1 text-xs text-accent">Copy it now: this is the only time the full key is shown. We store only a hash.</p>
            </div>
          )}
          <ul className="mt-3 divide-y divide-line">
            {keys.map((x) => (
              <li key={x.id} className="flex items-center gap-3 py-2 text-sm">
                <code className="flex-1 text-muted">{x.prefix}…</code>
                <button type="button" data-testid="mcp-revoke" onClick={() => revokeServerKey(x.id)} className={linkCls}>
                  <Trash2 size={14} className="mr-2" /> Revoke
                </button>
              </li>
            ))}
            {!keys.length && <li className="py-2 text-sm text-muted">No keys yet. Create one to connect your agent.</li>}
          </ul>
          <p role="alert" className="mt-1 min-h-4 text-xs text-red-400">{keyErr}</p>
          <p className="mt-1 text-xs text-muted">Real keys: calls with these keys act on your account and spend your credits. Revoking takes effect immediately. Endpoint: <code>{url}</code></p>
        </section>
      ) : (
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <KeyRound size={16} className="text-accent" aria-hidden />
          <code data-testid="mcp-key" className="min-w-0 flex-1 break-all text-sm text-fg select-all">{key || "…"}</code>
          <button type="button" data-testid="mcp-regenerate" onClick={() => { writeKey(newKey()); setTest(null); }} className={linkCls}>
            <RefreshCw size={14} className="mr-2" /> Regenerate
          </button>
          <button type="button" data-testid="mcp-revoke" onClick={() => { writeKey(""); setTest(null); }} className={linkCls} disabled={!key}>
            <Trash2 size={14} className="mr-2" /> Revoke
          </button>
          {!key && <button type="button" onClick={() => writeKey(newKey())} className={linkCls}>Create key</button>}
        </div>
        <p className="mt-2 text-xs text-muted">
          {serverDb ? (
            <>This is a <b>demo key</b> made in your browser: it can list tools and call them against the demo (nothing is charged). <Link href="/login" className="text-accent hover:underline">Sign in</Link> to create a key that works against your real account and credits. </>
          ) : (
            <>No database is configured, so this is a demo key: it is generated and stored in this browser, and the server accepts any well-formed <code>kn_…</code> key. Revoking only removes it here. </>
          )}
          Endpoint: <code>{url}</code>
        </p>
      </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <CopyCard id="claude-code" title="Claude Code" hint="Run in your terminal. One command." text={cc} />
        <CopyCard id="claude-desktop" title="Claude Desktop" hint="Paste into claude_desktop_config.json (uses mcp-remote)." text={desktop} />
        <CopyCard id="cursor" title="Cursor" hint="One click, or paste into .cursor/mcp.json." text={cursor}
          extra={<a href={cursorLink} className={linkCls}>Add to Cursor</a>} />
        <CopyCard id="vscode" title="VS Code" hint="One click, or paste into .vscode/mcp.json." text={vscode}
          extra={<a href={vscodeLink} className={linkCls}>Add to VS Code</a>} />
        <CopyCard id="curl" title="cURL" hint="Try it from any shell." text={curl} />

        <section className="flex flex-col rounded-2xl border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-fg">Test connection</h2>
          <p className="mb-3 text-xs text-muted">Calls tools/list on this server with your key.</p>
          <button type="button" data-testid="mcp-test" onClick={runTest} disabled={test === "running" || !key}
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-60">
            {test === "running" && <Loader2 size={16} className="animate-spin" />} Test connection
          </button>
          <div data-testid="mcp-test-result" role="status" className="mt-3 text-sm">
            {test && test !== "running" && (test.ok ? (
              <div>
                <p className="flex items-center gap-2 font-medium text-fg"><Check size={16} className="text-green-400" /> Connected · {test.tools?.length} tools · {test.ms} ms</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {test.tools?.map((t) => <li key={t.name} title={t.description} className="rounded-full border border-line px-2.5 py-1 text-xs text-muted">{t.name}</li>)}
                </ul>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-red-400"><XCircle size={16} /> Failed: {test.error} ({test.ms} ms)</p>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">What you can say to your agent</h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {PROMPTS.map((p) => <li key={p} className="rounded-xl bg-bg p-3 text-sm text-muted">&ldquo;{p}&rdquo;</li>)}
        </ul>
      </section>
    </>
  );
}
