import { SEAT_PRICE } from "@/lib/plans";
import { ANNUAL_DISCOUNT_PCT, formatCents, type Estimate } from "@/lib/enterprise/pricing";

/** Stacked bar + table. The segments always add up to the list price (seats list + add-ons) per month. */
export function Breakdown({ est }: { est: Estimate }) {
  const annual = est.billing === "annual";
  const rows: { key: string; label: string; cents: number; swatch: string; sign?: "-" }[] = [
    { key: "seats", label: `Seats after volume discount (${est.seats} x ${formatCents(SEAT_PRICE * 100)} list)`, cents: est.seatsMonthlyCents, swatch: "bg-accent" },
    { key: "addons", label: "Credit add-ons", cents: est.addonsMonthlyCents, swatch: "bg-[color-mix(in_oklab,var(--accent)_45%,var(--surface-2))]" },
  ];
  const savings = [
    { key: "volume", label: `Volume discount (${est.custom ? `${est.effPct}% indicative` : `${est.pct}%`})`, cents: est.volumeDiscountCents },
    { key: "annual", label: `Annual rate (-${ANNUAL_DISCOUNT_PCT}%)`, cents: est.annualSeatAdjustCents + est.annualAddonAdjustCents },
  ];
  // bar (per month, list basis): what you pay vs what is saved
  const pay = annual ? [est.seatsCents, est.addonsCents] : [est.seatsMonthlyCents, est.addonsMonthlyCents];
  const segs = [
    { key: "seats", cents: pay[0], cls: "bg-accent", label: "Seats" },
    { key: "addons", cents: pay[1], cls: "bg-[color-mix(in_oklab,var(--accent)_45%,var(--surface-2))]", label: "Add-ons" },
    { key: "volume", cents: est.volumeDiscountCents, cls: "bg-[repeating-linear-gradient(135deg,var(--line)_0_4px,transparent_4px_8px)]", label: "Volume discount" },
    { key: "annual", cents: est.annualSeatAdjustCents + est.annualAddonAdjustCents, cls: "bg-[repeating-linear-gradient(135deg,var(--muted)_0_2px,transparent_2px_7px)]", label: "Annual rate" },
  ];
  const total = segs.reduce((a, s) => a + s.cents, 0) || 1;
  return (
    <div data-testid="ent-breakdown">
      <h4 className="text-sm font-semibold">Cost breakdown per month</h4>
      <div role="img" aria-label={segs.filter((s) => s.cents).map((s) => `${s.label} ${formatCents(s.cents)}`).join(", ")} className="mt-3 flex h-3 w-full overflow-hidden rounded-full border border-line bg-surface-2">
        {segs.filter((s) => s.cents > 0).map((s) => (
          <span key={s.key} className={`${s.cls} h-full transition-[width] duration-500`} style={{ width: `${(s.cents / total) * 100}%` }} />
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">Solid = what you pay. Hatched = what the discounts take off the list price.</p>
      <table className="mt-3 w-full text-sm">
        <caption className="sr-only">Cost breakdown per month</caption>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={r.key}>
              <th scope="row" className="py-2 pr-3 text-left font-normal text-muted">
                <span aria-hidden className={`mr-2 inline-block size-2.5 rounded-sm align-middle ${r.swatch}`} />
                {r.label}
              </th>
              <td className="py-2 text-right font-medium tabular-nums">{formatCents(i === 0 ? est.seatsMonthlyCents : est.addonsMonthlyCents)}</td>
            </tr>
          ))}
          {savings.filter((s) => s.cents > 0).map((s) => (
            <tr key={s.key}>
              <th scope="row" className="py-2 pr-3 text-left font-normal text-muted">{s.key === "annual" ? "Annual rate (same as yearly plans)" : s.label} <span className="sr-only">(saving)</span></th>
              <td className="py-2 text-right font-medium tabular-nums text-earn">-{formatCents(s.cents)}</td>
            </tr>
          ))}
          <tr>
            <th scope="row" className="py-2 pr-3 text-left font-semibold">Monthly total</th>
            <td className="py-2 text-right font-semibold tabular-nums">{formatCents(est.monthlyTotalCents)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
