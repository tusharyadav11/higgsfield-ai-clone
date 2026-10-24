"use client";
import { useState } from "react";
import { Minus, Plus, RotateCcw, Info } from "lucide-react";
import { CREDITS_PER_SEAT, PRESETS, VOLUME_TIERS } from "@/lib/plans";
import {
  ADDON_PACKS, ANNUAL_DISCOUNT_PCT, MAX_ADDON_QTY, MAX_SEATS, SLIDER_MAX, activeTierMin, addonPackCents, customFloorPct, formatCents, formatNum, parseSeats, suggestAddons,
  type CalcState, type Estimate,
} from "@/lib/enterprise/pricing";
import { Reveal } from "./Reveal";
import { Breakdown } from "./Breakdown";

export const card = "rounded-2xl border border-line bg-surface/80 shadow-[0_1px_0_var(--hl)_inset]";
const label = "text-sm font-medium text-fg";

export function Calculator({ calc, setCalc, est }: { calc: CalcState; setCalc: (f: (s: CalcState) => CalcState) => void; est: Estimate }) {
  const [text, setText] = useState(String(calc.seats));
  const [prev, setPrev] = useState(calc.seats);
  const [msg, setMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  if (prev !== calc.seats) {
    setPrev(calc.seats);
    if (parseSeats(text).seats !== calc.seats) setText(String(calc.seats));
  }

  const onSeatsInput = (raw: string) => {
    setText(raw);
    const p = parseSeats(raw);
    if (p.seats === null) {
      setMsg({ tone: "error", text: p.message });
      return;
    }
    setMsg(p.status === "ok" ? null : { tone: "info", text: p.message });
    setCalc((s) => ({ ...s, seats: p.seats! }));
  };
  const setSeats = (n: number) => {
    setMsg(null);
    setText(String(n));
    setCalc((s) => ({ ...s, seats: n }));
  };
  const onBlur = () => {
    const p = parseSeats(text);
    setText(String(p.seats ?? calc.seats));
    if (p.seats === null) setMsg(null);
  };

  const poolMax = Math.max(10000, Math.ceil((est.totalPool * 2) / 5000) * 5000, (calc.expectedCredits ?? 0) + 5000);
  const expected = calc.expectedCredits ?? est.totalPool;
  const setAddon = (id: (typeof ADDON_PACKS)[number]["id"], d: number) =>
    setCalc((s) => {
      const q = Math.min(MAX_ADDON_QTY, Math.max(0, (s.addons[id] ?? 0) + d));
      const a = { ...s.addons };
      if (q) a[id] = q;
      else delete a[id];
      return { ...s, addons: a };
    });
  const activeMin = activeTierMin(est.seats);

  return (
    <section id="calculator" aria-labelledby="calc-h" className="scroll-mt-28 py-14 sm:py-20">
      <Reveal>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">Pricing calculator</p>
        <h2 id="calc-h" className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">Size your team and see an indicative price</h2>
        <p className="mt-3 max-w-2xl text-base text-muted sm:text-lg">Every number updates as you change it, and the configuration lives in the page URL so you can share it. Indicative list prices only; a written quote is the source of truth.</p>
      </Reveal>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          {/* team size */}
          <Reveal className={`${card} p-5 sm:p-6`}>
            <h3 className="text-lg font-semibold">Team size</h3>
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Team size presets">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  data-testid={`ent-preset-${p}`}
                  aria-pressed={calc.seats === p}
                  onClick={() => setSeats(p)}
                  className={`min-h-11 min-w-11 rounded-full border px-4 text-sm font-semibold transition-colors ${calc.seats === p ? "border-accent bg-accent text-accent-fg" : "border-line hover:border-accent"}`}
                >
                  {p === 500 ? "500+" : p}
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-end">
              <div>
                <label htmlFor="ent-seats-input" className={label}>Seats</label>
                <input
                  id="ent-seats-input"
                  data-testid="ent-seats-input"
                  inputMode="numeric"
                  autoComplete="off"
                  value={text}
                  onChange={(e) => onSeatsInput(e.target.value)}
                  onBlur={onBlur}
                  aria-invalid={msg?.tone === "error"}
                  aria-describedby="ent-seats-msg"
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-base font-semibold tabular-nums text-fg outline-none focus:border-accent aria-[invalid=true]:border-danger"
                />
              </div>
              <div>
                <label htmlFor="ent-slider" className="flex justify-between text-sm text-muted">
                  <span>Drag to adjust</span>
                  <span data-testid="ent-seats" className="font-semibold tabular-nums text-fg">{est.seats}{est.seats >= 500 ? "+" : ""}</span>
                </label>
                <input
                  id="ent-slider"
                  data-testid="ent-slider"
                  type="range"
                  min={1}
                  max={SLIDER_MAX}
                  value={Math.min(est.seats, SLIDER_MAX)}
                  aria-valuetext={`${est.seats} seats`}
                  onChange={(e) => setSeats(Number(e.target.value))}
                  className="mt-1 h-11 w-full accent-[var(--accent)]"
                />
              </div>
            </div>
            <p id="ent-seats-msg" role="status" data-testid="ent-seats-msg" className={`mt-1 min-h-5 text-xs ${msg?.tone === "error" ? "text-danger" : "text-muted"}`}>
              {msg?.text ?? `Whole numbers from 1 to ${formatNum(MAX_SEATS)}. Paste is fine.`}
            </p>
            {est.custom && (
              <p className="mt-2 flex gap-2 rounded-xl bg-surface-2 p-3 text-sm text-muted" data-testid="ent-custom-note">
                <Info className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden />
                <span>500+ seats is a custom tier. Figures below use the {customFloorPct()}% tier as an indicative floor; your quote may be lower.</span>
              </p>
            )}
          </Reveal>

          {/* billing */}
          <Reveal className={`${card} p-5 sm:p-6`}>
            <h3 className="text-lg font-semibold">Billing</h3>
            <div role="group" aria-label="Billing cycle" className="mt-4 inline-flex rounded-full border border-line bg-surface-2 p-1">
              {(["monthly", "annual"] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  data-testid={`ent-billing-${b}`}
                  aria-pressed={calc.billing === b}
                  onClick={() => setCalc((s) => ({ ...s, billing: b }))}
                  className={`min-h-11 rounded-full px-5 text-sm font-semibold capitalize transition-colors ${calc.billing === b ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}
                >
                  {b}{b === "annual" ? ` (-${ANNUAL_DISCOUNT_PCT}%)` : ""}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted">Annual billing: same rate as the yearly plans (Pro is $12 a month billed yearly instead of $15, so {ANNUAL_DISCOUNT_PCT}% off). That is the only annual rule used here, applied to seats and add-ons.</p>
          </Reveal>

          {/* credits */}
          <Reveal className={`${card} p-5 sm:p-6`}>
            <h3 className="text-lg font-semibold">Shared monthly credits</h3>
            <p className="mt-1 text-sm text-muted">Every seat adds {formatNum(CREDITS_PER_SEAT)} credits to one pool the whole team draws from.</p>
            <label htmlFor="ent-credits" className="mt-4 flex justify-between text-sm">
              <span className={label}>Expected monthly credits</span>
              <span className="font-semibold tabular-nums" data-testid="ent-expected">{formatNum(expected)}</span>
            </label>
            <input
              id="ent-credits"
              data-testid="ent-credits-slider"
              type="range"
              min={0}
              max={poolMax}
              step={500}
              value={Math.min(expected, poolMax)}
              onChange={(e) => setCalc((s) => ({ ...s, expectedCredits: Number(e.target.value) }))}
              className="mt-1 h-11 w-full accent-[var(--accent)]"
            />
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <p data-testid="ent-headroom" role="status" className={`text-sm ${est.shortfall ? "text-warn" : "text-muted"}`}>
                {est.shortfall
                  ? `Shortfall of ${formatNum(est.shortfall)} credits a month against a pool of ${formatNum(est.totalPool)}.`
                  : est.headroom
                    ? `${formatNum(est.headroom)} credits of headroom in a pool of ${formatNum(est.totalPool)}.`
                    : `Pool of ${formatNum(est.totalPool)} credits a month, no spare.`}
              </p>
              <div className="flex gap-2">
                {est.shortfall > 0 && (
                  <button type="button" data-testid="ent-cover" onClick={() => setCalc((s) => ({ ...s, addons: suggestAddons(est.shortfall) }))} className="min-h-11 rounded-full border border-line px-4 text-sm font-medium hover:border-accent">
                    Cover with add-ons
                  </button>
                )}
                {calc.expectedCredits !== null && (
                  <button type="button" data-testid="ent-credits-reset" onClick={() => setCalc((s) => ({ ...s, expectedCredits: null }))} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-muted hover:text-fg">
                    <RotateCcw className="size-3.5" aria-hidden /> Use pool
                  </button>
                )}
              </div>
            </div>
          </Reveal>

          {/* add-ons */}
          <Reveal className={`${card} p-5 sm:p-6`}>
            <h3 className="text-lg font-semibold">Credit add-on packs</h3>
            <p className="mt-1 text-sm text-muted">Indicative add-on packs priced at the Pro credit rate ({formatCents(addonPackCents(1000))} per 1,000 credits), billed each month you keep them.</p>
            <ul className="mt-4 divide-y divide-line">
              {ADDON_PACKS.map((p) => {
                const q = calc.addons[p.id] ?? 0;
                return (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium">{p.label}</p>
                      <p className="text-sm tabular-nums text-muted">{formatCents(addonPackCents(p.credits))} per pack, per month</p>
                    </div>
                    <div className="flex items-center gap-1" role="group" aria-label={`${p.label} quantity`}>
                      <button type="button" data-testid={`ent-addon-${p.id}-minus`} aria-label={`Remove one ${p.label} pack`} disabled={q === 0} onClick={() => setAddon(p.id, -1)} className="inline-flex size-11 items-center justify-center rounded-full border border-line hover:border-accent disabled:opacity-40">
                        <Minus className="size-4" aria-hidden />
                      </button>
                      <output data-testid={`ent-addon-${p.id}`} aria-label={`${p.label} packs`} className="w-10 text-center text-base font-semibold tabular-nums">{q}</output>
                      <button type="button" data-testid={`ent-addon-${p.id}-plus`} aria-label={`Add one ${p.label} pack`} disabled={q >= MAX_ADDON_QTY} onClick={() => setAddon(p.id, 1)} className="inline-flex size-11 items-center justify-center rounded-full border border-line hover:border-accent disabled:opacity-40">
                        <Plus className="size-4" aria-hidden />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Reveal>
        </div>

        {/* results */}
        <Reveal className="min-w-0 lg:sticky lg:top-32">
          <Results est={est} />
        </Reveal>
      </div>

      {/* tiers */}
      <Reveal className="mt-10">
        <h3 className="text-lg font-semibold">Volume discounts</h3>
        <p className="mt-1 text-sm text-muted">Indicative tiers by seat count. Your active tier is highlighted.</p>
        <ul className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-5" data-testid="ent-tiers">
          {VOLUME_TIERS.map((t) => {
            const on = t.min === activeMin;
            return (
              <li key={t.min} data-testid={`ent-tier-${t.min}`} aria-current={on ? "true" : undefined} className={`${card} p-4 transition-colors ${on ? "border-accent ring-1 ring-accent" : ""}`}>
                <p className="text-2xl font-semibold tabular-nums">{t.pct === null ? "Custom" : `${t.pct}%`}</p>
                <p className="text-sm text-muted">{t.label}</p>
                {t.pct === null && <p className="mt-1 text-xs text-muted">Calculated with a {customFloorPct()}% indicative floor.</p>}
                {on && <p className="mt-1 text-xs font-semibold text-accent-text">Your tier</p>}
              </li>
            );
          })}
        </ul>
      </Reveal>
    </section>
  );
}

function Results({ est }: { est: Estimate }) {
  const per = formatCents(Math.round(est.perSeatCents));
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="relative border-b border-line p-5 sm:p-6">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(30rem_14rem_at_100%_0%,color-mix(in_oklab,var(--accent)_14%,transparent),transparent_70%)]" />
        <p className="relative text-sm text-muted">Indicative monthly total, {est.billing} billing</p>
        <p className="relative mt-1 flex flex-wrap items-baseline gap-x-2 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
          <span key={est.monthlyTotalCents} data-testid="ent-total-monthly" className="price-in">{formatCents(est.monthlyTotalCents)}</span>
          <span className="text-base font-normal text-muted">/ month</span>
        </p>
        <p className="relative mt-2 text-sm text-muted">
          <span data-testid="ent-total-annual" className="font-semibold tabular-nums text-fg">{formatCents(est.annualTotalCents)}</span> per year (12 x the monthly figure){est.custom ? ", from" : ""}
        </p>
        <p className="relative mt-1 text-sm text-muted">
          <span className="font-semibold tabular-nums text-fg">{per}</span> per seat per month after discount{est.billing === "annual" ? " and annual rate" : ""}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 p-5 sm:p-6">
        <Stat label="Monthly credit pool" value={formatNum(est.includedPool)} sub={`${formatNum(CREDITS_PER_SEAT)} per seat, shared`} testid="ent-pool" />
        <Stat label="Volume discount" value={est.custom ? "Custom" : `${est.pct}%`} sub={`list ${formatCents(est.perSeatListCents)}/seat/mo${est.custom ? `, ${est.effPct}% floor` : ""}`} testid="ent-discount" />
        <Stat label={est.custom ? "Seats from (indicative)" : "Seats per month"} value={formatCents(est.seatsCents)} sub={est.volumeDiscountCents ? `was ${formatCents(est.seatListCents)}` : "no discount yet"} testid="ent-monthly" />
        <Stat label="Est. savings vs individual" value={formatCents(est.savingsCents)} sub={`vs ${formatCents(est.individualCents)} on Pro plans`} testid="ent-savings" />
        <Stat label="Discount amount" value={formatCents(est.volumeDiscountCents + est.annualSeatAdjustCents + est.annualAddonAdjustCents)} sub="volume + annual rate, per month" testid="ent-discount-amount" />
        <Stat label="Add-ons" value={formatCents(est.addonsCents)} sub={est.addonCredits ? `${formatNum(est.addonCredits)} credits a month` : "none selected"} testid="ent-addons-subtotal" />
      </dl>
      <div className="border-t border-line p-5 sm:p-6">
        <Breakdown est={est} />
      </div>
      <p className="border-t border-line bg-surface-2/50 px-5 py-3 text-xs text-muted sm:px-6">
        Indicative list prices for illustration; your quote is the source of truth. Savings assume the same credits bought through individual Pro plans. Billing is not live.
      </p>
      <p className="sr-only" aria-live="polite" role="status" data-testid="ent-live">
        {`${est.seats} seats, ${est.billing} billing. Monthly total ${formatCents(est.monthlyTotalCents)}, annual total ${formatCents(est.annualTotalCents)}, credit pool ${formatNum(est.totalPool)}.`}
      </p>
    </div>
  );
}

function Stat({ label, value, sub, testid }: { label: string; value: string; sub: string; testid: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface-2 p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd data-testid={testid} className="truncate text-xl font-semibold tabular-nums">{value}</dd>
      <dd className="text-xs text-muted">{sub}</dd>
    </div>
  );
}
