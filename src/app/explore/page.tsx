import type { Metadata } from "next";
import { ExploreFeed } from "@/components/features/explore-feed";

export const metadata: Metadata = { title: "Explore" };

export default function ExplorePage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tighter text-fg sm:text-4xl">
          Explore <span className="text-shine">what&rsquo;s being made</span>
        </h1>
        <p className="mt-1 text-sm text-muted">Hover a card to see its prompt. One tap remixes it.</p>
      </div>
      <ExploreFeed />
    </div>
  );
}
