"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { MODELS } from "@/lib/models";
import { PLANS } from "@/lib/plans";
import { bestPct, discounted, money, validatePromo, WELCOME_HOURS, type PromoOk } from "@/lib/promo";
import { useStore } from "@/lib/store";
import { api } from "@/lib/server-sync";
import { useMounted } from "./hooks";

export function PricingView() {
  const [yearly, setYearly] = useState(false);
  const [input, setInput] = useState("");
  const [promo, setPromo] = useState<PromoOk | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const mounted = useMounted();
  const user = useStore((s) => s.user);
  const welcomeAt = useStore((s) => s.welcomeAt);
  const referredBy = useStore((s) => s.referredBy);
  const referral = mounted && !!referredBy;

  async function apply() {
    // signed-in (server) users: the server validates against the account's real signup time and records the redemption
    const r: ReturnType<typeof validatePromo> = user?.server
      ? await api<PromoOk>("/api/me/promo", "POST", { code: input, yearly }).then((x) => (x.ok ? x.data : { ok: false as const, error: x.data.error ?? "Could not apply code." }))
      : validatePromo(input, {
      yearly,
      signedIn: !!user,
      welcomeExpiresAt: welcomeAt ? welcomeAt + WELCOME_HOURS * 3600_000 : null,
      now: Date.now(),
    });
    if (!r.ok) {
      setError(r.error);
      setPromo(null);
      return;
    }
    setError("");
    setPromo(r);
    if (r.forceYearly) setYearly(true);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-center gap-3 text-sm">
        <span className={yearly ? "text-muted" : "text-fg"}>Monthly</span>
        <button
          type="button"
          role="switch"
          aria-checked={yearly}
          aria-label="Billing period"
          data-testid="billing-toggle"
          onClick={() => setYearly((v) => !v)}
          className={`relative h-8 w-14 rounded-full border border-line transition-colors ${yearly ? "bg-accent" : "bg-surface-2"}`}
        >
          <span className={`absolute top-1 size-6 rounded-full bg-fg transition-all ${yearly ? "left-7" : "left-1"}`} />
        </button>
        <span className={yearly ? "text-fg" : "text-muted"}>
          Yearly <span className="text-accent">save 20%</span>
        </span>
      </div>

      <div className="mx-auto mb-8 max-w-md">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void apply();
          }}
        >
          <input
            data-testid="promo-input"
            aria-label="Promo code"
            placeholder="Promo code"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoCapitalize="characters"
            className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-4 text-sm uppercase text-fg outline-none placeholder:normal-case focus:border-accent"
          />
          <button type="submit" data-testid="promo-apply" className="min-h-11 rounded-full border border-line px-5 text-sm font-semibold hover:border-accent">
            Apply
          </button>
        </form>
        <p role="alert" className="mt-2 min-h-5 text-center text-sm text-red-400">{error}</p>
        {promo && (
          <p data-testid="promo-badge" className="mt-1 text-center text-sm text-accent">
            {promo.code} applied: {promo.label}
          </p>
        )}
        {referral && !promo && (
          <p data-testid="promo-badge" className="mt-1 text-center text-sm text-accent">Referral discount: 10% off your first paid month (auto-applied)</p>
        )}
        {notice && <p className="mt-1 text-center text-sm text-muted">{notice}</p>}
        <p className="mt-1 text-center text-xs text-muted">Codes: WELCOME20, YEARLY, TEAM10. One discount per plan, best one wins.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const base = yearly ? p.yearly : p.monthly;
          const { pct, source } = bestPct(p.id, promo, referral);
          const final = pct && base ? discounted(base, pct) : base;
          return (
            <div
              key={p.id}
              data-testid={`plan-card-${p.id}`}
              className={`flex flex-col rounded-2xl border bg-surface p-6 ${"featured" in p ? "border-accent ring-1 ring-accent" : "border-line"}`}
            >
              <h3 className="text-lg font-semibold text-fg">{p.name}</h3>
              <p className="mt-3 text-4xl font-semibold text-fg">
                {final !== base && <s className="mr-2 text-xl font-normal text-muted">{money(base)}</s>}
                {money(final)}
                <span className="text-sm font-normal text-muted"> /mo{yearly && p.monthly ? ", billed yearly" : ""}</span>
              </p>
              {final !== base && (
                <p className="mt-1 text-xs text-accent">{source}: {pct}% off the first month</p>
              )}
              <p className="mt-2 text-sm text-accent">{p.credits}</p>
              <ul className="my-5 flex-1 space-y-2 text-sm text-muted">
                {p.perks.map((x) => (
                  <li key={x} className="flex gap-2">
                    <Check size={16} className="mt-0.5 shrink-0 text-accent" /> {x}
                  </li>
                ))}
              </ul>
              {p.id === "free" ? (
                <Link href="/create" className="inline-flex min-h-11 items-center justify-center rounded-full border border-line px-5 text-sm font-semibold text-fg">
                  {p.cta}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setNotice("Checkout is not live in this demo, so no payment is taken.")}
                  className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold ${"featured" in p ? "bg-accent text-accent-fg" : "border border-line text-fg"}`}
                >
                  {p.cta}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-center text-sm text-muted">
        Need seats for a team? <Link href="/enterprise" className="text-accent hover:underline">See Enterprise</Link>. Demo accounts are stored in your browser.
      </p>
      <h2 className="mb-3 mt-12 text-lg font-semibold text-fg">Credit costs</h2>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Speed</th>
              <th className="px-4 py-3 text-right font-medium">Credits</th>
            </tr>
          </thead>
          <tbody>
            {MODELS.map((m) => (
              <tr key={m.id} className="border-t border-line text-fg">
                <td className="px-4 py-3">{m.name}</td>
                <td className="px-4 py-3 capitalize">{m.kind}</td>
                <td className="px-4 py-3 capitalize text-muted">{m.speed}</td>
                <td className="px-4 py-3 text-right">{m.credits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
