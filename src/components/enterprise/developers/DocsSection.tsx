"use client";
import { useState } from "react";
import Link from "next/link";
import { BookOpen, Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";
import { Section } from "../shared/Section";
import { useOrigin } from "../shared/LocalTime";
import { linkCls } from "../shared/ui";

const REPO = "https://github.com/tusharyadav11/higgsfield-ai-clone";

export function DocsSection() {
  // live origin after mount only (cacheComponents: nothing request-specific in the prerender)
  const origin = useOrigin();
  const [done, setDone] = useState(false);
  const url = `${origin || "https://<your-host>"}/api/mcp`;
  const curl = `curl -s ${url} \\\n  -H "Authorization: Bearer kn_YOUR_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;
  return (
    <Section id="docs" title="Documentation & developer resources" description="Links go only to things that exist.">
      <ul className="grid gap-2 sm:grid-cols-3">
        <li><Link href="/connect" data-testid="doc-connect" className="flex min-h-11 items-center gap-2 rounded-xl border border-line p-3 text-sm hover:border-accent"><BookOpen className="size-4 text-accent-text" aria-hidden /> MCP setup (Connect page)</Link></li>
        <li><a href={REPO} target="_blank" rel="noopener noreferrer" data-testid="doc-readme" className="flex min-h-11 items-center gap-2 rounded-xl border border-line p-3 text-sm hover:border-accent"><ExternalLink className="size-4 text-accent-text" aria-hidden /> README on GitHub<span className="sr-only"> (opens in a new tab)</span></a></li>
        <li><a href="/api/mcp" target="_blank" rel="noopener noreferrer" data-testid="doc-mcp" className="flex min-h-11 items-center gap-2 rounded-xl border border-line p-3 text-sm hover:border-accent"><ExternalLink className="size-4 text-accent-text" aria-hidden /> /api/mcp JSON-RPC description<span className="sr-only"> (opens in a new tab)</span></a></li>
      </ul>
      <h3 className="mt-4 text-sm font-semibold">curl quickstart</h3>
      <p className="text-xs text-muted">Lists the MCP tools (this call needs no key). Use <code>kn_YOUR_KEY</code> as a placeholder: tools/call needs a real key from the API keys section.</p>
      <pre data-testid="curl-snippet" className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-bg p-3 font-mono text-xs">{curl}</pre>
      <Button variant="secondary" className="mt-2" data-testid="copy-curl" onClick={async () => { try { await navigator.clipboard.writeText(curl); setDone(true); setTimeout(() => setDone(false), 1500); } catch { showToast("Copy failed. Select the snippet manually."); } }}>
        {done ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {done ? "Copied" : "Copy snippet"}
      </Button>
      <p className="mt-3 text-xs text-muted">There is no separate API reference site. The README and the Connect page are the documentation. <Link href="/connect" className={linkCls}>Open Connect</Link></p>
    </Section>
  );
}
