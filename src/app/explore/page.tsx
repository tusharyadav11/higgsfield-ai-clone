import type { Metadata } from "next";
import { ExploreFeed } from "@/components/features/explore-feed";

export const metadata: Metadata = { title: "Explore" };

export default function ExplorePage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold text-fg">Explore</h1>
      <ExploreFeed />
    </div>
  );
}
