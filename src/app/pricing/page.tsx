import type { Metadata } from "next";
import { PricingView } from "@/components/growth/PricingView";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6">
      <div className="text-center">
        <h1 className="text-balance text-4xl font-bold tracking-tighter text-fg sm:text-5xl">Simple pricing. <span className="text-shine">Zero lock-in.</span></h1>
        <p className="mt-2 text-muted">Start free. Upgrade when you outgrow it.</p>
      </div>
      <PricingView />
    </div>
  );
}
