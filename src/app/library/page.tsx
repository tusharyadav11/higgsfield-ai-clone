import type { Metadata } from "next";
import { LibraryView } from "@/components/features/library-view";

export const metadata: Metadata = { title: "Library" };

export default function LibraryPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold text-fg">Library</h1>
      <LibraryView />
    </div>
  );
}
