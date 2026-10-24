import type { Metadata } from "next";
import { UsageView } from "@/components/usage/UsageView";

export const metadata: Metadata = { title: "Your usage" };

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <UsageView />
    </div>
  );
}
