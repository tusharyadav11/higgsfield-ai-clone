"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownCircle, ArrowUpCircle, CreditCard, FileText, Minus, Plus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { showToast } from "@/components/ui/Toast";
import { StatusPill } from "../shared/StatusPill";
import { DemoBadge } from "../shared/DemoBadge";
import { LocalTime } from "../shared/LocalTime";
import { Section } from "../shared/Section";
import { cardCls, linkCls } from "../shared/ui";
import { useStoreReady } from "@/lib/enterprise/persist";
import { recordActing } from "@/lib/enterprise/audit";
import { useTeam } from "@/lib/enterprise/team-store";
import { can, ROLE_LABEL } from "@/lib/enterprise/roles";
import { ADDON_PACKS, ANNUAL_DISCOUNT_PCT, MAX_ADDON_QTY, addonPackCents, computeQuote, formatCents, formatNum, type Billing } from "@/lib/enterprise/pricing";
import { INTENT_LABEL, PLAN_LABEL, addonsLink, intentReason, nextPlan, useBilling, type IntentKind } from "@/lib/enterprise/billing";

const INTENT_COPY: Record<IntentKind, { title: string; body: (to: string) => string; confirm: string }> = {
  upgrade: { title: "Record an upgrade to Enterprise?", body: (to) => `This records a local intent to move this demo workspace to “${to}”. Enterprise pricing comes from a written quote, which you can request from the Enterprise page.`, confirm: "Record upgrade intent" },
  downgrade: { title: "Record a downgrade to Team?", body: (to) => `This records a local intent to move this demo workspace to “${to}”. Enterprise-only features such as SSO would no longer apply.`, confirm: "Record downgrade intent" },
  cancel: { title: "Record a cancellation?", body: (to) => `This records a local intent to move this demo workspace to “${to}”. You can record another change at any time.`, confirm: "Record cancellation" },
};

export function BillingView() {
  const ready = useStoreReady(useBilling);
  const teamReady = useStoreReady(useTeam);
  const seats = useTeam((s) => s.seats);
  const role = useTeam((s) => s.actingAs);
  const { plan, billing, addons, intents, setBilling, setAddons, recordIntent } = useBilling();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [dlg, setDlg] = useState<IntentKind | null>(null);
  const [saved, setSaved] = useState(false);

  const quoteM = useMemo(() => computeQuote({ seats, billing: "monthly" }), [seats]);
  const quoteA = useMemo(() => computeQuote({ seats, billing: "annual" }), [seats]);
  const withAddons = useMemo(() => computeQuote({ seats, billing, addons }), [seats, billing, addons]);
  const draft = useMemo(() => Object.fromEntries(ADDON_PACKS.map((p) => [p.id, qty[p.id] ?? addons[p.id] ?? 0])), [qty, addons]);
  const draftEstimate = useMemo(() => computeQuote({ seats, billing, addons: draft }), [seats, billing, draft]);

  if (!ready || !teamReady) return <div aria-busy="true" className="h-96 animate-pulse rounded-2xl bg-surface-2" />;

  const manage = can(role, "manage_billing");
  const whyNot = manage ? null : `Only the Owner can manage billing. You are acting as ${ROLE_LABEL[role]}; switch “Acting as” on the Team page.`;
  const step = (id: string, d: number) => {
    setSaved(false);
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(MAX_ADDON_QTY, (q[id] ?? addons[id as keyof typeof addons] ?? 0) + d)) }));
  };
  const hasDraft = Object.values(draft).some((v) => v > 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Billing</h2>
        <StatusPill status="needs-integration" label="No payment provider" />
      </div>
      <p className="-mt-3 text-sm text-muted">Nothing here charges money. There is no payment provider, no real subscription and no invoice. Prices are indicative and follow the same rules as the Enterprise estimator.</p>
      {whyNot && <p data-testid="billing-readonly" className="rounded-xl border border-line bg-surface-2 p-3 text-sm text-muted">{whyNot}</p>}

      <Section id="plan" title="Current plan" pills={<DemoBadge />}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Plan</p>
            <p data-testid="current-plan" className="text-lg font-semibold">{PLAN_LABEL[plan]}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Billing cycle</p>
            <p data-testid="current-cycle" className="text-lg font-semibold">{billing === "annual" ? "Annual" : "Monthly"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Seats</p>
            <p className="text-lg font-semibold">{seats}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Indicative total</p>
            <p data-testid="current-total" className="text-lg font-semibold">{plan === "free" ? "$0" : `${formatCents(withAddons.monthlyTotalCents)}/mo`}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">No subscription is active. This is the plan a written quote would start from; the figure is an estimate, never a bill.</p>
        <Link href="/enterprise#quote" className={`${linkCls} mt-1 inline-flex min-h-11 items-center text-sm`}>Request a quote</Link>
      </Section>

      <Section id="cycle" title="Monthly vs annual" description={`Annual billing uses the same rule as the yearly plans: ${ANNUAL_DISCOUNT_PCT}% below monthly.`} pills={<StatusPill status="demo" label="Indicative" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          {([["monthly", quoteM], ["annual", quoteA]] as const).map(([b, q]) => (
            <div key={b} data-testid={`cycle-${b}`} className={`rounded-xl border p-4 ${billing === b ? "border-accent" : "border-line"}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">{b === "monthly" ? "Monthly" : "Annual"}</h3>
                {b === "annual" && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-fg">Save {ANNUAL_DISCOUNT_PCT}%</span>}
              </div>
              <p className="mt-2 text-3xl font-semibold tabular-nums">{formatCents(q.monthlyTotalCents)}<span className="text-sm font-normal text-muted"> /mo</span></p>
              <p className="text-sm text-muted">{formatCents(Math.round(q.perSeatCents))} per seat · {formatCents(q.annualTotalCents)} per year</p>
              {b === "annual" && <p className="mt-1 text-sm text-success">Saves about {formatCents(quoteA.annualSavingsCents)} per year vs monthly.</p>}
              <Button className="mt-3" variant={billing === b ? "secondary" : "primary"} disabled={billing === b || !manage} title={whyNot ?? undefined} data-testid={`pick-${b}`} onClick={() => { setBilling(b as Billing); recordActing({ action: "billing.cycle_preference", target: b, detail: "local preference" }); showToast(`Preferred cycle set to ${b} (saved locally, nothing is charged).`); }}>
                {billing === b ? "Selected" : `Prefer ${b}`}
              </Button>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">Based on {seats} seats with the volume discount from the estimator ({quoteM.custom ? "custom tier, indicative floor" : `${quoteM.pct}%`}).</p>
      </Section>

      <Section id="addons" title="Credit add-on packs" pills={<StatusPill status="demo" label="Indicative" />} description="Priced at the existing Pro credit rate. Adding to a quote is not a purchase: nothing is charged.">
        <ul className="grid gap-3 sm:grid-cols-3">
          {ADDON_PACKS.map((p) => {
            const n = draft[p.id] ?? 0;
            return (
              <li key={p.id} data-testid={`addon-${p.id}`} className="rounded-xl border border-line p-3">
                <p className="font-semibold">{p.label}</p>
                <p className="text-sm text-muted">{formatCents(addonPackCents(p.credits))} per pack · {formatNum(p.credits)} credits/mo</p>
                <div className="mt-3 flex items-center gap-2" role="group" aria-label={`${p.label} quantity`}>
                  <Button variant="secondary" size="icon" aria-label={`Fewer ${p.label} packs`} disabled={n === 0} onClick={() => step(p.id, -1)}><Minus className="size-4" aria-hidden /></Button>
                  <span data-testid={`addon-qty-${p.id}`} aria-live="polite" className="min-w-8 text-center text-lg font-semibold tabular-nums">{n}</span>
                  <Button variant="secondary" size="icon" aria-label={`More ${p.label} packs`} disabled={n >= MAX_ADDON_QTY} onClick={() => step(p.id, 1)}><Plus className="size-4" aria-hidden /></Button>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p data-testid="addon-total" className="text-sm">Selection: <strong>{formatNum(draftEstimate.addonCredits)}</strong> extra credits for <strong>{formatCents(draftEstimate.addonsCents)}/mo</strong> (indicative)</p>
          <Button data-testid="add-to-quote" disabled={!hasDraft && Object.keys(addons).length === 0 ? true : !manage} title={whyNot ?? (hasDraft ? undefined : "Choose at least one pack")} onClick={() => { setAddons(draft); setSaved(true); recordActing({ action: "billing.addons_added_to_quote", target: "Credit add-ons", detail: ADDON_PACKS.filter((p) => draft[p.id]).map((p) => `${draft[p.id]}x ${p.label}`).join(", ") || "cleared" }); showToast(hasDraft ? "Add-ons saved to your local quote selection. Nothing was purchased." : "Add-on selection cleared."); }}>
            Add to quote
          </Button>
          {(hasDraft || Object.keys(addons).length > 0) && (
            <Link data-testid="addons-quote-link" href={addonsLink(seats, billing, hasDraft && saved ? draft : addons)} className={`${linkCls} inline-flex min-h-11 items-center text-sm`}>
              Open quote request with these add-ons
            </Link>
          )}
        </div>
        {saved && <p role="status" data-testid="addons-saved" className="mt-2 text-xs text-muted">Saved locally. The quote form on the Enterprise page can read this selection from the link.</p>}
      </Section>

      <Section id="invoices" title="Invoice history" pills={<StatusPill status="not-configured" label="No invoices" />}>
        <p data-testid="invoices-empty" className="rounded-xl border border-dashed border-line p-5 text-sm text-muted">No invoices: billing isn’t connected to a payment provider. Invoices will appear here only when real billing exists.</p>
        <details className="mt-4 rounded-xl border border-line p-3" data-testid="sample-invoice">
          <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-2 text-sm font-medium"><FileText className="size-4" aria-hidden /> Sample invoice layout (demo) <DemoBadge /></summary>
          <div className="relative mt-3 overflow-hidden rounded-lg border border-dashed border-line bg-surface-2 p-4 text-sm" aria-label="Sample invoice layout, not a real invoice">
            <p aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center text-center text-4xl font-black uppercase tracking-widest text-fg/10 [transform:rotate(-12deg)] sm:text-6xl">Sample · not an invoice</p>
            <div className="relative">
              <p className="font-semibold">Invoice #SAMPLE-0000 <span className="font-normal text-muted">(layout preview only)</span></p>
              <p className="text-muted">Bill to: Acme Demo Studio</p>
              <table className="mt-3 w-full text-left">
                <thead><tr className="border-b border-line text-xs uppercase text-muted"><th className="py-1 font-medium">Item</th><th className="py-1 text-right font-medium">Amount</th></tr></thead>
                <tbody>
                  <tr><td className="py-1">{seats} seats ({billing})</td><td className="py-1 text-right tabular-nums">{formatCents(withAddons.seatsCents)}</td></tr>
                  {withAddons.addons.map((a) => <tr key={a.id}><td className="py-1">Add-on {a.qty} x {formatNum(a.credits / a.qty)} credits</td><td className="py-1 text-right tabular-nums">{formatCents(a.cents)}</td></tr>)}
                  <tr className="border-t border-line font-semibold"><td className="py-1">Total per month (sample)</td><td className="py-1 text-right tabular-nums">{formatCents(withAddons.monthlyTotalCents)}</td></tr>
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted">This preview cannot be downloaded or paid. It only shows what an invoice would look like.</p>
            </div>
          </div>
        </details>
      </Section>

      <Section id="payment" title="Payment method" pills={<StatusPill status="needs-integration" label="Not connected" />}>
        <div className="flex flex-wrap items-center gap-3">
          <CreditCard className="size-5 text-muted" aria-hidden />
          <p className="min-w-0 flex-1 basis-56 text-sm text-muted">No card or bank account can be added: there is no payment provider. Enterprise teams are billed by invoice after a written quote.</p>
          <Link href="/enterprise#quote" data-testid="request-invoice" className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">Request invoice billing</Link>
        </div>
      </Section>

      <Section id="subscription" title="Subscription" description="Each action records a local demo intent after you confirm. Nothing is charged, refunded or changed with a provider.">
        <div className="flex flex-wrap gap-2">
          {([["upgrade", ArrowUpCircle], ["downgrade", ArrowDownCircle], ["cancel", XCircle]] as const).map(([k, Icon]) => {
            const why = whyNot ?? intentReason(plan, k);
            return (
              <div key={k} className="flex flex-col gap-1">
                <Button variant="secondary" data-testid={`sub-${k}`} disabled={!!why} onClick={() => setDlg(k)}><Icon className="size-4" aria-hidden /> {INTENT_LABEL[k]}</Button>
                {why && <span className="max-w-56 text-xs text-muted">{why}</span>}
              </div>
            );
          })}
        </div>
        {intents.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold">Recorded intents <span className="font-normal text-muted">(local only, nothing charged)</span></h3>
            <ul data-testid="intent-list" className="mt-2 divide-y divide-line rounded-xl border border-line text-sm">
              {intents.map((i) => <li key={i.id} data-testid="intent-row" className="flex flex-wrap gap-x-3 p-2.5"><strong>{INTENT_LABEL[i.kind]}</strong><span className="text-muted">{PLAN_LABEL[i.from]} → {PLAN_LABEL[i.to]}</span><LocalTime iso={i.at} className="ml-auto text-xs text-muted" /></li>)}
            </ul>
          </div>
        )}
      </Section>

      {dlg && (
        <ConfirmDialog
          open
          title={INTENT_COPY[dlg].title}
          confirmLabel={INTENT_COPY[dlg].confirm}
          cancelLabel="Never mind"
          onCancel={() => setDlg(null)}
          onConfirm={() => {
            const to = nextPlan(plan, dlg);
            const r = recordIntent(dlg, new Date().toISOString());
            if (r) {
              recordActing({ action: `billing.${dlg}_intent`, target: PLAN_LABEL[r.to], detail: "local demo intent, nothing charged" });
              showToast(`${INTENT_LABEL[dlg]} intent recorded locally. Nothing was charged.`);
            }
            void to;
            setDlg(null);
          }}
        >
          <p>{INTENT_COPY[dlg].body(PLAN_LABEL[nextPlan(plan, dlg) ?? plan])}</p>
          <p>No payment provider is connected, so no money moves. This only updates the plan shown in this browser.</p>
        </ConfirmDialog>
      )}
      <p className={`${cardCls} text-xs text-muted`}>Looking for invoices, tax details or a purchase order? Those need a real billing integration. <Link href="/enterprise#quote" className={linkCls}>Talk to us through the quote form.</Link></p>
    </div>
  );
}
