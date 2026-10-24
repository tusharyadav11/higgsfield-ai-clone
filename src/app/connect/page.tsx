import type { Metadata } from "next";
import { ConnectView } from "@/components/connect/connect-view";

export const metadata: Metadata = { title: "Connect your agent" };

export default function ConnectPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-1 py-4 sm:px-6">
      <ConnectView />
    </div>
  );
}
