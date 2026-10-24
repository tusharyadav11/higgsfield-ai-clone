import { Hero, ModelsStrip, ToolsGrid } from "@/components/features/home-extras";
import { StreakCard } from "@/components/features/streak-card";
import { TrendingRail } from "@/components/features/trending-rail";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6">
      <Hero />
      <StreakCard />
      <TrendingRail />
      <ToolsGrid />
      <ModelsStrip />
    </div>
  );
}
