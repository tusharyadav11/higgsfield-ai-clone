"use client";

import { Check, CloudOff, Loader2 } from "lucide-react";
import { useSyncStatus } from "@/lib/jobs";

export function SyncBadge({ className = "" }: { className?: string }) {
  const s = useSyncStatus();
  const label = s === "saved" ? "Saved" : s === "saving" ? "Saving…" : "Offline – will retry";
  return (
    <span data-testid="sync-badge" role="status" aria-live="polite" className={`inline-flex items-center gap-1.5 text-xs text-muted ${className}`}>
      {s === "saved" && <Check size={12} className="text-accent" aria-hidden />}
      {s === "saving" && <Loader2 size={12} className="animate-spin motion-reduce:animate-none" aria-hidden />}
      {s === "offline" && <CloudOff size={12} className="text-red-400" aria-hidden />}
      {label}
    </span>
  );
}
