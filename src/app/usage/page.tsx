import type { Metadata } from "next";
import { UsageView } from "@/components/usage/UsageView";

export const metadata: Metadata = { title: "Your usage" };

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 2xl:max-w-[1400px]">
      <UsageView />
    </div>
  );
}
