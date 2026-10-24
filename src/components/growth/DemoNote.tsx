"use client";
import { useServerInfo } from "@/lib/server-info";

export function DemoNote({ children }: { children?: React.ReactNode }) {
  const serverDb = useServerInfo((s) => s.db);
  return (
    <p className="text-xs text-muted" data-testid="demo-note">
      {children ??
        (serverDb
          ? "Accounts are stored securely on our server. As a guest, your work stays in this browser until you sign up."
          : "Demo mode: no database is configured, so accounts are stored in your browser only. Clearing site data removes them.")}
    </p>
  );
}
