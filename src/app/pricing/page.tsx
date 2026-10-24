import type { Metadata } from "next";
import { PricingView } from "@/components/features/pricing-view";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-fg">Simple, credit-based pricing</h1>
        <p className="mt-2 text-muted">Start free. Upgrade when you outgrow it.</p>
      </div>
      <PricingView />
    </div>
  );
}
