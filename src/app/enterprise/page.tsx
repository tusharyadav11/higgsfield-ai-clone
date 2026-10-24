import type { Metadata } from "next";
import { EnterpriseView } from "@/components/growth/EnterpriseView";

export const metadata: Metadata = { title: "Enterprise" };

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg">Kinetic for teams</h1>
        <p className="mt-1 text-muted">Shared credits, SSO and volume pricing.</p>
      </div>
      <EnterpriseView />
    </div>
  );
}
