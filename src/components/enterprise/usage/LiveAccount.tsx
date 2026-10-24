"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { Card, Skeleton } from "@/components/ui";
import { useStore } from "@/lib/store";
import type { UsageSummary } from "@/lib/usage";

/** The signed-in user's REAL credit usage (GET /api/me/usage). Guests only see the demo. */
export function LiveAccount() {
  const server = useStore((s) => !!s.user?.server);
  const credits = useStore((s) => s.credits);
  const [s, setS] = useState<UsageSummary | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!server) return;
    let live = true;
    fetch("/api/me/usage?range=30d", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<UsageSummary>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => live && (setS(d), setFailed(false)))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [server, credits]);

  return (
    <Card data-testid="usage-live-account" className="flex flex-col gap-2">
      <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        Your account (live data)
        <span className="inline-flex items-center gap-1 rounded-full border border-success/40 px-2 py-0.5 text-[11px] font-medium text-success"><Radio className="size-3" aria-hidden /> Live</span>
      </h3>
      {!server ? (
        <p className="text-sm text-muted">You are browsing as a guest, so only the demo workspace is shown here. <Link href="/signup" className="text-accent-text underline underline-offset-2">Sign in</Link> to see your own credit usage next to it. The workspace figures below are sample data.</p>
      ) : failed ? (
        <p role="alert" className="text-sm text-muted">Could not load your live usage right now. Try again in a moment.</p>
      ) : !s ? (
        <Skeleton className="h-14" />
      ) : (
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div><dt className="text-xs text-muted">Balance</dt><dd className="text-lg font-semibold tabular-nums">{credits.toLocaleString("en")}</dd></div>
          <div><dt className="text-xs text-muted">Spent, 30 days</dt><dd className="text-lg font-semibold tabular-nums">{s.spent.toLocaleString("en")}</dd></div>
          <div><dt className="text-xs text-muted">Creations</dt><dd className="text-lg font-semibold tabular-nums">{s.generations.toLocaleString("en")}</dd></div>
        </dl>
      )}
      <p className="text-xs text-muted">Personal credits are separate from the workspace pool, which has no backend yet.</p>
    </Card>
  );
}
