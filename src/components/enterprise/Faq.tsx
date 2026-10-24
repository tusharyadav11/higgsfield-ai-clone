"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { scrollToSection } from "./AnchorNav";

type Item = { q: string; a: React.ReactNode };

export const FAQ_ITEMS: Item[] = [
  { q: "Is billing live?", a: "No. Payments are not implemented in this product. Prices on this page are indicative list prices for illustration, and a written quote is the source of truth. Nothing here charges a card." },
  { q: "What is the demo workspace?", a: <>A sample workspace (team, usage, projects, security, billing, developers) with sample data stored in your browser. It shows how an admin area could work. Sections marked “Needs integration” are not active. <Link href="/enterprise/workspace/team" className="text-accent-text underline underline-offset-2">Open the workspace demo</Link>.</> },
  { q: "Is SSO available?", a: "SSO (SAML / OIDC) is available on request for Enterprise and needs configuration with your identity provider. It is not switched on for anyone by default, and it is not active in this demo." },
  { q: "Where is our data stored?", a: "In demo mode, your inputs stay in your browser. When a deployment has a database configured, requests and accounts are stored in that Postgres database, in the region its operator chose. This page makes no data-residency commitment; ask in your quote request if you need one." },
  { q: "What is the security and compliance status?", a: "We do not claim any certification (such as SOC 2 or ISO 27001) and no audit-log or SLA is active in this demo. If you need security documentation, put it in your request and a person will tell you what exists today." },
  { q: "Do you support the API and MCP?", a: "Yes, in the product: API keys and an MCP server for agents exist, and the demo workspace has a Developers tab. Limits, access scopes and any enterprise terms are agreed in your quote." },
  { q: "How reliable is the volume pricing?", a: "Volume pricing is indicative. The tiers (5% from 10 seats, 10% from 25, 15% from 100) and the add-on packs, priced at the Pro credit rate, are shown so you can plan. 500+ seats is a custom tier: the calculator uses the 15% tier as an indicative floor, and your quote may differ." },
  { q: "What happens after I submit a request?", a: <>The request is saved on the server if a database is connected, or the form tells you it was not stored (demo mode). No email is sent and no calendar is connected: a person would follow up from the saved request. <a href="#quote" onClick={(e) => { e.preventDefault(); scrollToSection("quote", true); }} className="text-accent-text underline underline-offset-2">Go to the form</a>.</> },
];

/** Accessible accordion: each trigger is a real button with aria-expanded/aria-controls; arrow keys, Home and End move between triggers. */
export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const onKey = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = FAQ_ITEMS.length;
    const to = e.key === "ArrowDown" ? (i + 1) % n : e.key === "ArrowUp" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    document.getElementById(`faq-btn-${to}`)?.focus();
  };
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface/80">
      {FAQ_ITEMS.map((it, i) => {
        const on = open === i;
        return (
          <div key={i}>
            <h3>
              <button
                id={`faq-btn-${i}`}
                type="button"
                data-testid={`ent-faq-${i}`}
                aria-expanded={on}
                aria-controls={`faq-panel-${i}`}
                onClick={() => setOpen(on ? null : i)}
                onKeyDown={(e) => onKey(e, i)}
                className="flex min-h-14 w-full items-center justify-between gap-4 px-4 py-3 text-left text-base font-medium text-fg hover:bg-surface-2/60 sm:px-6"
              >
                <span>{it.q}</span>
                <ChevronDown aria-hidden className={`size-5 shrink-0 text-muted transition-transform duration-300 ${on ? "rotate-180 text-accent-text" : ""}`} />
              </button>
            </h3>
            <div id={`faq-panel-${i}`} role="region" aria-labelledby={`faq-btn-${i}`} hidden={!on} data-testid={`ent-faq-panel-${i}`} className="px-4 pb-5 text-sm leading-relaxed text-muted sm:px-6 sm:text-base">
              {it.a}
            </div>
          </div>
        );
      })}
    </div>
  );
}
