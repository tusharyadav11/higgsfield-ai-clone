"use client";
import { useRef, useState } from "react";
import { Check, Copy, Link2, MessageSquareQuote, CalendarClock } from "lucide-react";
import { ANNUAL_DISCOUNT_PCT, ADDON_PACKS, formatCents, formatNum, serializeCalc, summaryText, type CalcState, type Estimate } from "@/lib/enterprise/pricing";
import { Button } from "@/components/ui";
import { Reveal } from "./Reveal";
import { scrollToSection } from "./AnchorNav";
import { card } from "./Calculator";

/** Read-only list of the current configuration. Used in the summary section and inside the request form. */
export function ConfigList({ est, calc, compact = false, testid }: { est: Estimate; calc: CalcState; compact?: boolean; testid?: string }) {
  const addons = ADDON_PACKS.filter((p) => calc.addons[p.id]).map((p) => `${calc.addons[p.id]} x ${p.label}`).join(", ");
  const rows: [string, string][] = [
    ["Seats", `${formatNum(est.seats)}${est.custom ? " (custom tier)" : ""}`],
    ["Billing cycle", est.billing === "annual" ? `Annual (same rate as yearly plans, ${ANNUAL_DISCOUNT_PCT}% off)` : "Monthly"],
    ["Monthly credits", `${formatNum(est.totalPool)} pool${calc.expectedCredits !== null ? `, expecting ${formatNum(calc.expectedCredits)}` : ""}`],
    ["Add-ons", addons || "None"],
    ["Indicative monthly", `${est.custom ? "from " : ""}${formatCents(est.monthlyTotalCents)}`],
    ["Indicative annual", `${est.custom ? "from " : ""}${formatCents(est.annualTotalCents)}`],
  ];
  return (
    <dl data-testid={testid} className={`grid gap-x-6 ${compact ? "gap-y-1.5 text-sm" : "gap-y-3 text-sm sm:text-base"} sm:grid-cols-[max-content_minmax(0,1fr)]`}>
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="mb-2 min-w-0 font-medium tabular-nums sm:mb-0">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function QuoteSummary({ est, calc, onDemo }: { est: Estimate; calc: CalcState; onDemo: () => void }) {
  const [state, setState] = useState<"idle" | "text" | "link" | "fail">("idle");
  const t = useRef<number | undefined>(undefined);
  const flash = (s: "text" | "link" | "fail") => {
    setState(s);
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setState("idle"), 2200);
  };
  return (
    <section id="summary" aria-labelledby="sum-h" className="scroll-mt-28 py-14 sm:py-20">
      <Reveal>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">Custom quote summary</p>
        <h2 id="sum-h" className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">Your configuration, ready to share</h2>
      </Reveal>
      <Reveal className={`${card} relative mt-8 overflow-hidden`}>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(34rem_16rem_at_0%_0%,color-mix(in_oklab,var(--accent)_10%,transparent),transparent_70%)]" />
        <div className="relative grid gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="min-w-0">
            <ConfigList est={est} calc={calc} testid="ent-summary" />
            <p className="mt-5 text-sm text-muted">
              Indicative only: list prices for illustration, volume tiers and add-on packs as shown above. Billing is not live, and a written quote is the source of truth.
            </p>
          </div>
          <div className="flex min-w-0 flex-col justify-between gap-5 rounded-2xl border border-line bg-surface-2/60 p-5">
            <div>
              <p className="text-sm text-muted">{est.custom ? "From (indicative)" : "Indicative"} per month</p>
              <p className="text-4xl font-semibold tabular-nums tracking-tight" data-testid="ent-summary-monthly">{formatCents(est.monthlyTotalCents)}</p>
              <p className="mt-1 text-sm text-muted tabular-nums">{formatCents(est.annualTotalCents)} per year</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button size="lg" data-testid="ent-summary-quote" onClick={() => scrollToSection("quote", true)}>
                <MessageSquareQuote className="size-4" aria-hidden /> Request a quote with this
              </Button>
              <Button variant="secondary" data-testid="demo-open-summary" onClick={onDemo}>
                <CalendarClock className="size-4" aria-hidden /> Book a demo
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" data-testid="ent-copy" onClick={async () => flash((await copy(summaryText(est))) ? "text" : "fail")}>
                  {state === "text" ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} Copy summary
                </Button>
                <Button variant="secondary" data-testid="ent-copy-link" onClick={async () => flash((await copy(`${location.origin}${location.pathname}?${serializeCalc(calc)}#calculator`)) ? "link" : "fail")}>
                  {state === "link" ? <Check className="size-4" aria-hidden /> : <Link2 className="size-4" aria-hidden />} Copy link
                </Button>
              </div>
              <p role="status" aria-live="polite" data-testid="ent-copy-status" className="min-h-5 text-xs text-muted">
                {state === "text" ? "Summary copied to the clipboard." : state === "link" ? "Link to this configuration copied." : state === "fail" ? "Copy is blocked in this browser; select the text instead." : ""}
              </p>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
