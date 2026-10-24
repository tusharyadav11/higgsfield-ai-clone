"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
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
      <div className="mb-8 flex items-center justify-center gap-3 text-sm">
        <span className={`transition-colors ${yearly ? "text-muted" : "font-semibold text-fg"}`}>Monthly</span>
        <button
          type="button"
          role="switch"
          aria-checked={yearly}
          aria-label="Billing period"
          data-testid="billing-toggle"
          onClick={() => setYearly((v) => !v)}
          className={`relative h-9 w-16 rounded-full border transition-colors duration-300 ${yearly ? "border-accent bg-accent/25" : "border-line bg-surface-2"}`}
        >
          <span
            className={`absolute left-1 top-1 size-7 rounded-full bg-accent shadow-[0_2px_14px_var(--glow)] transition-transform duration-300 ease-[cubic-bezier(.3,1.5,.5,1)] ${yearly ? "translate-x-7" : "translate-x-0"}`}
          />
        </button>
        <span className={`transition-colors ${yearly ? "font-semibold text-fg" : "text-muted"}`}>Yearly</span>
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-accent-fg transition-transform duration-300 ${yearly ? "scale-110 shadow-[0_0_18px_var(--glow)]" : "scale-100 opacity-80"}`}
        >
          <Sparkles size={11} /> Save 20%
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
              data-spot
              className={`spot relative flex flex-col rounded-3xl border bg-surface/95 p-6 ${
                "featured" in p
                  ? "glow-border border-transparent shadow-[0_30px_80px_-40px_var(--glow)] md:-translate-y-3 md:pb-9 md:pt-8"
                  : "border-line"
              }`}
            >
              {"featured" in p && (
                <span className="absolute left-1/2 top-0 z-10 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-fg shadow-[0_6px_20px_-6px_var(--glow)]">
                  <Sparkles size={12} /> Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold text-fg">{p.name}</h3>
              <p key={`${yearly}`} className="price-in mt-3 text-5xl font-bold tracking-tighter text-fg">
                {final !== base && <s className="mr-2 text-xl font-normal tracking-normal text-muted">{money(base)}</s>}
                {money(final)}
                <span className="text-sm font-normal tracking-normal text-muted"> /mo{yearly && p.monthly ? ", billed yearly" : ""}</span>
              </p>
              {final !== base && (
                <p className="mt-1 text-xs text-accent">{source}: {pct}% off the first month</p>
              )}
              {yearly && p.monthly > 0 && (
                <p className="price-in mt-1 text-xs font-medium text-accent">You save ${(p.monthly - p.yearly) * 12} a year</p>
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
                <Link href="/create" className="inline-flex min-h-11 items-center justify-center rounded-full border border-line px-5 text-sm font-semibold text-fg transition-[border-color,transform] hover:border-accent active:scale-95">
                  {p.cta}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setNotice("Checkout is not live in this demo, so no payment is taken.")}
                  className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold ${"featured" in p ? "btn-glow bg-accent text-accent-fg" : "border border-line text-fg transition-[border-color,transform] hover:border-accent active:scale-95"}`}
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
