import type { Metadata } from "next";
import { SettingsView } from "@/components/growth/SettingsView";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg">Settings</h1>
        <p className="mt-1 text-muted">Profile, accent, notifications and your data.</p>
      </div>
      <SettingsView />
    </div>
  );
}
