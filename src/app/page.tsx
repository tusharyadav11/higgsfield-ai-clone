import { ModelsStrip, PromptTicker, ToolsGrid } from "@/components/features/home-extras";
import { HeroVideo, Showcase } from "@/components/features/hero-video";
import { CompareSlider, LiveStats } from "@/components/features/home-live";
import { StreakCard } from "@/components/features/streak-card";
import { TrendingRail } from "@/components/features/trending-rail";
import { MODELS } from "@/lib/models";
import { getPosts } from "@/lib/seed";

export default function Home() {
  const posts = getPosts();
  const showcase = posts.filter((p) => p.kind === "image" && (p.aspect === "16:9" || p.aspect === "4:3")).slice(0, 3);
  const top = [...posts].sort((a, b) => b.remixes - a.remixes);
  const ticker = top.slice(0, 12).map(({ id, prompt, model, remixes }) => ({ id, prompt, model, remixes }));
  const week = top.slice(0, 10).reduce((n, p) => n + p.remixes, 0);
  const cmp = showcase[0];
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6">
      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="lg:col-span-8">
          <HeroVideo />
        </div>
        <div className="flex flex-col gap-4 lg:col-span-4 lg:gap-5">
          <StreakCard />
          <LiveStats remixes={week} models={MODELS.length} />
        </div>
      </div>
      <PromptTicker items={ticker} />
      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="lg:col-span-7">
          {cmp && <CompareSlider src={cmp.poster} blur={cmp.blur} prompt={cmp.prompt} title={cmp.title} />}
        </div>
        <div className="lg:col-span-5">
          <ToolsGrid />
        </div>
      </div>
      <TrendingRail />
      <Showcase posts={showcase} />
      <ModelsStrip />
    </div>
  );
}
