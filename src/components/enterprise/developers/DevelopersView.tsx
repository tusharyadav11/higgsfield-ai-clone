"use client";
import { StatusPill } from "../shared/StatusPill";
import { useStoreReady } from "@/lib/enterprise/persist";
import { useWebhooks } from "@/lib/enterprise/webhooks";
import { useInterest } from "@/lib/enterprise/integrations";
import { DocsSection } from "./DocsSection";
import { IntegrationsSection } from "./IntegrationsSection";
import { KeysSection } from "./KeysSection";
import { UsageSection } from "./UsageSection";
import { WebhooksSection } from "./WebhooksSection";

const NAV = [["keys", "API keys"], ["usage", "Usage"], ["logs", "Logs"], ["webhooks", "Webhooks"], ["integrations", "Integrations"], ["docs", "Docs"]] as const;

export function DevelopersView() {
  const a = useStoreReady(useWebhooks);
  const b = useStoreReady(useInterest);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Developers</h2>
        <StatusPill status="active" label="API keys and MCP are real" />
      </div>
      <nav aria-label="Developer sections" className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1">
        {NAV.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-line bg-surface px-4 text-sm text-muted hover:border-accent hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{label}</a>
        ))}
      </nav>
      <KeysSection />
      <UsageSection />
      {a ? <WebhooksSection /> : <div aria-busy="true" className="h-40 animate-pulse rounded-2xl bg-surface-2" />}
      {b ? <IntegrationsSection /> : <div aria-busy="true" className="h-40 animate-pulse rounded-2xl bg-surface-2" />}
      <DocsSection />
    </div>
  );
}
