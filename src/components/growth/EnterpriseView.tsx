"use client";
import { useState } from "react";
import { Check, Minus } from "lucide-react";
import { ENTERPRISE_FEATURES, enterpriseEstimate, PRESETS, SEAT_PRICE, VOLUME_TIERS, CREDITS_PER_SEAT } from "@/lib/plans";
import { money } from "@/lib/promo";
import { QuoteForm } from "./QuoteForm";

const fmt = (n: number) => n.toLocaleString("en-US");

export function EnterpriseView() {
  const [seats, setSeats] = useState(25);
  const est = enterpriseEstimate(seats);
  const activeMin = [...VOLUME_TIERS].reverse().find((t) => seats >= t.min)!.min;
  return (
    <div className="flex flex-col gap-10">
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="calc">
        <h2 id="calc" className="text-lg font-semibold">Size your team</h2>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Team size presets">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              data-testid={`ent-preset-${p}`}
              aria-pressed={seats === p}
              onClick={() => setSeats(p)}
              className={`min-h-11 min-w-11 rounded-full border px-4 text-sm font-semibold ${seats === p ? "border-accent bg-accent text-accent-fg" : "border-line hover:border-accent"}`}
            >
              {p === 500 ? "500+" : p}
            </button>
          ))}
        </div>
        <label className="mt-5 block text-sm">
          <span className="flex justify-between"><span>Seats</span><span data-testid="ent-seats" className="font-semibold tabular-nums">{seats}{seats >= 500 ? "+" : ""}</span></span>
          <input data-testid="ent-slider" type="range" min={1} max={500} value={seats} onChange={(e) => setSeats(Number(e.target.value))} className="mt-2 h-11 w-full accent-[var(--accent)]" />
        </label>
        <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Monthly credit pool" value={fmt(est.pool)} sub={`${fmt(CREDITS_PER_SEAT)} per seat, shared`} testid="ent-pool" />
          <Stat label="Volume discount" value={est.custom ? "Custom" : `${est.pct}%`} sub={`list ${money(SEAT_PRICE)}/seat/mo`} testid="ent-discount" />
          <Stat label={est.custom ? "From (indicative)" : "Estimated monthly"} value={money(est.monthly)} sub={est.pct ? `was ${money(est.list)}` : "no discount yet"} testid="ent-monthly" />
          <Stat label="Est. savings vs individual" value={money(est.savings)} sub={`vs ${money(est.individual)} on Pro plans`} testid="ent-savings" />
        </dl>
        <p className="mt-3 text-xs text-muted">Indicative list prices for illustration. Your quote is the source of truth. Savings assume the same credits bought through individual Pro plans.</p>
      </section>

      <section aria-labelledby="tiers">
        <h2 id="tiers" className="mb-3 text-lg font-semibold">Volume discounts</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {VOLUME_TIERS.map((t) => (
            <li key={t.min} className={`rounded-2xl border p-4 ${t.min === activeMin ? "border-accent ring-1 ring-accent" : "border-line"} bg-surface`}>
              <p className="text-2xl font-semibold">{t.pct === null ? "Custom" : `${t.pct}%`}</p>
              <p className="text-sm text-muted">{t.label}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="cmp">
        <h2 id="cmp" className="mb-3 text-lg font-semibold">What you get</h2>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-muted">
              <tr><th className="px-4 py-3 font-medium">Feature</th><th className="px-4 py-3 font-medium">Team (Studio)</th><th className="px-4 py-3 font-medium">Enterprise</th></tr>
            </thead>
            <tbody>
              {ENTERPRISE_FEATURES.map((f) => (
                <tr key={f.name} className="border-t border-line">
                  <td className="px-4 py-3">{f.name}</td>
                  <td className="px-4 py-3"><Tick on={f.team} /></td>
                  <td className="px-4 py-3"><Tick on={f.enterprise} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="quote" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 id="quote" className="mb-4 text-lg font-semibold">Request a quote</h2>
        <QuoteForm seats={seats} />
      </section>
    </div>
  );
}

function Stat({ label, value, sub, testid }: { label: string; value: string; sub: string; testid: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd data-testid={testid} className="text-xl font-semibold tabular-nums">{value}</dd>
      <dd className="text-xs text-muted">{sub}</dd>
    </div>
  );
}
function Tick({ on }: { on: boolean }) {
  return on ? <Check className="size-4 text-accent-text" aria-label="Included" /> : <Minus className="size-4 text-muted" aria-label="Not included" />;
}
