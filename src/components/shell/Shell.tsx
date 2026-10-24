"use client";
import type { ReactNode } from "react";
import type { Accent } from "@/lib/theme";
import { Header } from "./Header";
import { Nav } from "./Nav";
import { GuideRoot } from "@/components/guide";
import { JobsRoot } from "@/components/jobs";
import { EngageRoot } from "@/components/engage";
import { ThemeSync } from "@/components/color/useTheme";
import { SpotlightRoot } from "@/components/ui/Spotlight";

export function Shell({ children, initialAccent }: { children: ReactNode; initialAccent: Accent }) {
  return (
    <div className="min-h-dvh sm:pl-[72px] lg:pl-56">
      <Nav />
      <Header />
      <main className="min-w-0 px-3 pb-28 pt-4 sm:px-5 sm:pb-8 lg:px-8">{children}</main>
      <ThemeSync />
      <SpotlightRoot />
      <GuideRoot />
      <JobsRoot />
      <EngageRoot />
    </div>
  );
}
