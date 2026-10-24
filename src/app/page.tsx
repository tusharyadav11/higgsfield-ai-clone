import { ModelsStrip, ToolsGrid } from "@/components/features/home-extras";
import { HeroVideo, Showcase } from "@/components/features/hero-video";
import { StreakCard } from "@/components/features/streak-card";
import { TrendingRail } from "@/components/features/trending-rail";
import { getPosts } from "@/lib/seed";

export default function Home() {
  const showcase = getPosts()
    .filter((p) => p.kind === "image" && (p.aspect === "16:9" || p.aspect === "4:3"))
    .slice(0, 3);
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6">
      <HeroVideo />
      <StreakCard />
      <TrendingRail />
      <Showcase posts={showcase} />
      <ToolsGrid />
      <ModelsStrip />
    </div>
  );
}
