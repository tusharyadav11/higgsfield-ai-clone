"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { MODELS } from "@/lib/models";

const PLANS = [
  { id: "free", name: "Free", monthly: 0, yearly: 0, credits: "50 credits to start + daily claim", perks: ["All image models", "Community feed", "Local library"], cta: "Start free" },
  { id: "pro", name: "Pro", monthly: 15, yearly: 12, credits: "1,000 credits / month", perks: ["Everything in Free", "All video models", "Priority queue", "No watermark"], cta: "Go Pro", featured: true },
  { id: "studio", name: "Studio", monthly: 49, yearly: 39, credits: "5,000 credits / month", perks: ["Everything in Pro", "Fastest queue", "Commercial license", "Early access models"], cta: "Go Studio" },
] as const;

export function PricingView() {
  const [yearly, setYearly] = useState(false);
  return (
    <div>
      <div className="mb-8 flex items-center justify-center gap-3 text-sm">
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
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <div
            key={p.id}
            data-testid={`plan-card-${p.id}`}
            className={`flex flex-col rounded-2xl border bg-surface p-6 ${"featured" in p ? "border-accent ring-1 ring-accent" : "border-line"}`}
          >
            <h3 className="text-lg font-semibold text-fg">{p.name}</h3>
            <p className="mt-3 text-4xl font-semibold text-fg">
              ${yearly ? p.yearly : p.monthly}
              <span className="text-sm font-normal text-muted"> /mo{yearly && p.monthly ? ", billed yearly" : ""}</span>
            </p>
            <p className="mt-2 text-sm text-accent">{p.credits}</p>
            <ul className="my-5 flex-1 space-y-2 text-sm text-muted">
              {p.perks.map((x) => (
                <li key={x} className="flex gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-accent" /> {x}
                </li>
              ))}
            </ul>
            <Link
              href={p.id === "free" ? "/create" : "/pricing"}
              className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold ${"featured" in p ? "bg-accent text-accent-fg" : "border border-line text-fg"}`}
            >
              {p.cta}
            </Link>
          </div>
        ))}
      </div>
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
