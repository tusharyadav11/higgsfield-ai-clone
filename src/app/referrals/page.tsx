import type { Metadata } from "next";
import { ReferralsView } from "@/components/growth/ReferralsView";

export const metadata: Metadata = { title: "Referrals" };

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg">Invite friends, earn credits</h1>
        <p className="mt-1 text-muted">Share your code. Demo ledger: stored in your browser.</p>
      </div>
      <ReferralsView />
    </div>
  );
}
