"use client";
import Link from "next/link";
import { Coins, Zap } from "lucide-react";
import { useStore } from "@/lib/store";
import { ThemeMenu } from "@/components/ui/ThemeToggle";
import { ColorPopover } from "@/components/color/ColorPopover";
import { SearchTrigger, HelpMenu } from "@/components/guide";
import { JobPill } from "@/components/jobs";
import { UserMenu } from "@/components/growth/UserMenu";
import { WelcomeBanner } from "@/components/growth/WelcomeBanner";
import { ServerSync } from "@/components/growth/ServerSync";
import { RefCapture } from "@/components/growth/RefCapture";
import { useNarrow } from "@/components/growth/hooks";

export function Header() {
  const credits = useStore((s: { credits?: number }) => s.credits ?? 0);
  const narrow = useNarrow();
  return (
    <>
      <RefCapture />
      <ServerSync />
      <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-1 border-b border-line bg-bg/75 px-2 pt-safe shadow-[0_10px_30px_-24px_var(--glow)] backdrop-blur-xl sm:gap-2 sm:px-5">
        <Link href="/" aria-label="Kinetic home" className="flex min-h-11 shrink-0 items-center gap-1.5 font-bold tracking-tight max-[479px]:hidden lg:hidden">
          <Zap className="size-5 text-accent-text" aria-hidden />
          <span className="text-shine">Kinetic</span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center justify-start gap-1 sm:justify-center">
          <SearchTrigger />
          <JobPill />
        </div>
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {!narrow && <HelpMenu />}
          <ThemeMenu className="max-[359px]:hidden" />
          <ColorPopover />
          <Link
            href="/pricing"
            data-testid="credits-chip"
            aria-label={`${credits} credits`}
            className="flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-sm font-semibold tabular-nums transition-[border-color,box-shadow,transform] hover:border-accent hover:shadow-[0_0_22px_-6px_var(--glow)] active:scale-95 sm:px-3"
          >
            <Coins className="size-4 text-accent-text" aria-hidden />
            {credits}
          </Link>
          <div className="max-[479px]:hidden"><UserMenu /></div>
        </div>
      </header>
      <WelcomeBanner />
    </>
  );
}
