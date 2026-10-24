import { getPosts } from "@/lib/seed";
import { PostCard } from "./post-card";
import { Flame } from "lucide-react";

export function TrendingRail() {
  const top = [...getPosts()].sort((a, b) => b.remixes - a.remixes).slice(0, 10);
  const total = top.reduce((n, p) => n + p.remixes, 0);
  return (
    <section aria-labelledby="trending-h">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 id="trending-h" className="flex items-center gap-2 text-xl font-semibold text-fg">
          <Flame size={18} className="text-accent" /> Trending now
        </h2>
        <p className="text-xs text-muted">{total.toLocaleString("en-US")} people remixed these today</p>
      </div>
      <div className="scrollbar-none -mx-4 flex snap-x items-start gap-4 overflow-x-auto px-4 pb-2 pt-1 sm:mx-0 sm:px-0">
        {top.map((p, i) => (
          <div key={p.id} className="w-56 shrink-0 snap-start sm:w-64">
            <PostCard post={p} priority={i < 2} />
          </div>
        ))}
      </div>
    </section>
  );
}
