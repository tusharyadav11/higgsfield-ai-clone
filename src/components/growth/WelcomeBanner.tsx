"use client";
import Link from "next/link";
import { useState } from "react";
import { Gift, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { WELCOME_HOURS } from "@/lib/promo";
import { useNow } from "./hooks";

const pad = (n: number) => String(n).padStart(2, "0");

export function WelcomeBanner() {
  const user = useStore((s) => s.user);
  const welcomeAt = useStore((s) => s.welcomeAt);
  const dismissed = useStore((s) => s.welcomeDismissed);
  const dismiss = useStore((s) => s.dismissWelcome);
  const now = useNow(1000);
  const [copied, setCopied] = useState(false);
  if (!now || !user || !welcomeAt || dismissed) return null;
  const left = welcomeAt + WELCOME_HOURS * 3600_000 - now;
  if (left <= 0) return null;
  const s = Math.floor(left / 1000);
  const clock = `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return (
    <div data-testid="welcome-banner" role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-surface-2 px-3 py-2 text-sm sm:px-5">
      <Gift className="size-4 shrink-0 text-accent" aria-hidden />
      <span className="min-w-0 flex-1 text-fg">
        Welcome! <b>20% off</b> your first paid month with{" "}
        <button
          type="button"
          className="rounded bg-bg px-1.5 font-mono font-semibold text-accent"
          onClick={() => {
            navigator.clipboard?.writeText("WELCOME20").then(() => setCopied(true), () => {});
          }}
        >
          {copied ? "copied" : "WELCOME20"}
        </button>{" "}
        <span className="text-muted">ends in <span className="tabular-nums">{clock}</span></span>
      </span>
      <Link href="/pricing" className="font-semibold text-accent hover:underline">Use it</Link>
      <button type="button" aria-label="Dismiss welcome banner" onClick={dismiss} className="flex size-9 items-center justify-center rounded-full text-muted hover:text-fg">
        <X className="size-4" />
      </button>
    </div>
  );
}
