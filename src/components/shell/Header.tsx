"use client";
import Link from "next/link";
import { Coins, Zap } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Accent } from "@/lib/theme";
import { AccentSwitcher } from "./AccentSwitcher";

export function Header({ initialAccent }: { initialAccent: Accent }) {
  const credits = useStore((s: { credits?: number }) => s.credits ?? 0);
  return (
    <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-2 border-b border-line bg-bg/85 px-3 pt-safe backdrop-blur sm:px-5">
      <Link href="/" className="flex min-h-11 items-center gap-1.5 font-bold tracking-tight lg:hidden">
        <Zap className="size-5 text-accent" aria-hidden />
        <span className="max-[380px]:hidden">Kinetic</span>
      </Link>
      <div className="hidden lg:block" />
      <div className="flex items-center gap-1">
        <AccentSwitcher initial={initialAccent} />
        <Link
          href="/pricing"
          data-testid="credits-chip"
          aria-label={`${credits} credits`}
          className="flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-semibold tabular-nums hover:border-accent"
        >
          <Coins className="size-4 text-accent" aria-hidden />
          {credits}
        </Link>
      </div>
    </header>
  );
}
